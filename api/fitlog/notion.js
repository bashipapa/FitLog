// FitLog Web 版の Notion 連携エンドポイント。
// ページ側は claude.ai の MCP コネクタと同じ呼び方 (tool 名と input) で呼んでくるので、
// ここで Notion 公式 API に翻訳する。
const { authorize } = require('../../lib/auth')
const {
  MEMBER_DS,
  NOMI_DS,
  notionFetch,
  pageToRow,
  toChildren,
  toNotionProperties,
} = require('../../lib/notion-api')

const dsFromUrl = (u) => (String(u || '').match(/[0-9a-f-]{36}/) || [''])[0]

async function queryAll(ds, body) {
  const rows = []
  let cursor
  do {
    const data = await notionFetch(`/data_sources/${ds}/query`, {
      ...body,
      start_cursor: cursor,
      page_size: 100,
    })
    rows.push(...(data.results || []).map(pageToRow))
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor && rows.length < 500)
  return rows
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ code: 'bad_request', message: 'POST only' })
  if (!authorize(req))
    return res
      .status(401)
      .json({ code: 'bad_key', message: 'access key required' })
  const { tool, input } = req.body || {}
  if (tool === 'status')
    return res.status(200).json({ configured: !!process.env.NOTION_API_KEY })
  if (!process.env.NOTION_API_KEY)
    return res.status(503).json({
      code: 'server_not_connected',
      message: 'NOTION_API_KEY is not set',
    })

  try {
    if (tool === 'notion-query-data-sources') {
      const d = (input && input.data) || {}
      const ds = dsFromUrl(d.data_source_url) || NOMI_DS
      if (![NOMI_DS, MEMBER_DS].includes(ds))
        return res
          .status(400)
          .json({ code: 'bad_request', message: 'unknown data source' })
      const sorts = (d.sort || []).map((s) => ({
        property: s.property,
        direction: s.direction,
      }))
      const rows = await queryAll(ds, sorts.length ? { sorts } : {})
      return res.status(200).json({
        results: rows.slice(0, d.limit || 100),
        has_more: rows.length > (d.limit || 100),
      })
    }
    if (tool === 'notion-create-pages') {
      const page = input && input.pages && input.pages[0]
      if (!page)
        return res
          .status(400)
          .json({ code: 'bad_request', message: 'pages[0] required' })
      const created = await notionFetch('/pages', {
        parent: { type: 'data_source_id', data_source_id: NOMI_DS },
        properties: toNotionProperties(page.properties),
        children: toChildren(page.content),
      })
      return res.status(200).json({ url: created.url, id: created.id })
    }
    return res
      .status(400)
      .json({ code: 'not_in_manifest', message: `unknown tool ${tool}` })
  } catch (e) {
    const status = e.status || 502
    const code =
      status === 401
        ? 'needs_reauth'
        : status === 404 || status === 403
        ? 'blocked_by_policy'
        : status === 429
        ? 'rate_limited'
        : 'tool_error'
    return res
      .status(status >= 400 && status < 600 ? status : 502)
      .json({ code, message: String(e.message || e).slice(0, 300) })
  }
}
