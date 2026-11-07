// Notion 公式 API (インテグレーショントークン) で 🍻飲み会 DB を読み書きする。
// ブログ本体が使う NOTION_TOKEN (token_v2) とは別物なので NOTION_API_KEY を使う。
const NOTION_VERSION = '2025-09-03'
const NOMI_DS = '3cf821f3-6a98-8089-acda-000b21c8dea5'
const MEMBER_DS = '43028787-e29a-4c3d-8182-16d514a794fd'

const TYPES = {
  店の名前: 'title',
  飲み会日付: 'date',
  石橋支払い: 'number',
  タクシー費用: 'number',
  杯数: 'number',
  タクシー場所: 'rich_text',
  飲んだもの: 'rich_text',
  参加者: 'multi_select',
  参加メンバー: 'relation',
}

async function notionFetch(path, body) {
  const r = await fetch('https://api.notion.com/v1' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const err = new Error(data.message || `Notion API ${r.status}`)
    err.status = r.status
    err.notionCode = data.code
    throw err
  }
  return data
}

const plain = (arr) => (arr || []).map((t) => t.plain_text || '').join('')

/** 公式 API のページを、アプリが期待する SQLite 風の行に直す */
function pageToRow(page) {
  const row = { url: page.url || '' }
  for (const [name, prop] of Object.entries(page.properties || {})) {
    switch (prop.type) {
      case 'title':
        row[name] = plain(prop.title)
        break
      case 'rich_text':
        row[name] = plain(prop.rich_text)
        break
      case 'number':
        row[name] = prop.number
        break
      case 'date':
        row[`date:${name}:start`] = prop.date ? prop.date.start : null
        row[`date:${name}:end`] = prop.date ? prop.date.end : null
        row[`date:${name}:is_datetime`] =
          prop.date && /T/.test(prop.date.start || '') ? 1 : 0
        break
      case 'multi_select':
        row[name] = JSON.stringify((prop.multi_select || []).map((o) => o.name))
        break
      case 'relation':
        row[name] = JSON.stringify(
          (prop.relation || []).map(
            (o) => `https://www.notion.so/${String(o.id).replace(/-/g, '')}`
          )
        )
        break
      case 'select':
        row[name] = prop.select ? prop.select.name : null
        break
      case 'checkbox':
        row[name] = prop.checkbox ? '__YES__' : '__NO__'
        break
      case 'url':
        row[name] = prop.url || ''
        break
      default:
        break
    }
  }
  return row
}

const pageId = (urlOrId) => {
  const m = /([0-9a-f]{32})|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(
    String(urlOrId || '')
  )
  return m ? m[0].replace(/-/g, '') : null
}

/** アプリが送る SQLite 風のプロパティ (MCP の create-pages と同じ形) を公式 API の形に直す */
function toNotionProperties(props) {
  const out = {}
  const dates = {}
  for (const [key, value] of Object.entries(props || {})) {
    const dm = /^date:(.+):(start|end|is_datetime)$/.exec(key)
    if (dm) {
      dates[dm[1]] = dates[dm[1]] || {}
      dates[dm[1]][dm[2]] = value
      continue
    }
    const type = TYPES[key]
    if (!type || value === null || value === undefined || value === '') continue
    if (type === 'title')
      out[key] = { title: [{ type: 'text', text: { content: String(value) } }] }
    else if (type === 'rich_text')
      out[key] = {
        rich_text: [
          { type: 'text', text: { content: String(value).slice(0, 2000) } },
        ],
      }
    else if (type === 'number') out[key] = { number: Number(value) }
    else if (type === 'multi_select')
      out[key] = {
        multi_select: (Array.isArray(value) ? value : [value])
          .filter(Boolean)
          .map((name) => ({ name: String(name) })),
      }
    else if (type === 'relation')
      out[key] = {
        relation: (Array.isArray(value) ? value : [value])
          .map(pageId)
          .filter(Boolean)
          .map((id) => ({ id })),
      }
  }
  for (const [name, d] of Object.entries(dates)) {
    if (!d.start) continue
    out[name] = { date: { start: d.start, end: d.end || null } }
  }
  return out
}

/** 本文テキストを段落ブロックに */
function toChildren(content) {
  return String(content || '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 50)
    .map((line) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: line.slice(0, 2000) } }],
      },
    }))
}

module.exports = { NOMI_DS, MEMBER_DS, notionFetch, pageToRow, toNotionProperties, toChildren }
