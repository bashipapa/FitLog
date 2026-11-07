// Notion 変換と API ハンドラの最小テスト (fetch はスタブ)。`npm test` で実行。
const assert = require('assert')
const { toNotionProperties, pageToRow, toChildren } = require('../lib/notion-api')

const props = toNotionProperties({ 店の名前: 'サカバ懐', 'date:飲み会日付:start': '2026-11-07', 参加者: ['井之上', '大越'], 杯数: 5, 飲んだもの: 'ビール2、ハイボール3', 石橋支払い: 8000, タクシー場所: '', 参加メンバー: ['https://app.notion.com/p/93b4826f56024a5d84376e4e0800fd88'] })
assert.strictEqual(props['店の名前'].title[0].text.content, 'サカバ懐')
assert.strictEqual(props['飲み会日付'].date.start, '2026-11-07')
assert.deepStrictEqual(props['参加者'].multi_select.map((o) => o.name), ['井之上', '大越'])
assert.strictEqual(props['参加メンバー'].relation[0].id, '93b4826f56024a5d84376e4e0800fd88')
assert.strictEqual(props['タクシー場所'], undefined)

const row = pageToRow({ url: 'https://www.notion.so/abc', properties: { 店の名前: { type: 'title', title: [{ plain_text: 'ごく天' }] }, 飲み会日付: { type: 'date', date: { start: '2026-10-14', end: null } }, 参加者: { type: 'multi_select', multi_select: [{ name: '井之上' }] }, 杯数: { type: 'number', number: 4 } } })
assert.strictEqual(row['店の名前'], 'ごく天')
assert.strictEqual(row['date:飲み会日付:start'], '2026-10-14')
assert.strictEqual(row['参加者'], '["井之上"]')
assert.strictEqual(toChildren('a\n\nb').length, 2)

global.fetch = async (url, init) => {
  const body = JSON.parse(init.body || '{}')
  if (url.endsWith('/query')) return { ok: true, json: async () => ({ results: [{ url: 'https://www.notion.so/x', properties: { 店の名前: { type: 'title', title: [{ plain_text: 'テスト' }] } } }], has_more: false }) }
  if (url.endsWith('/pages')) { global.lastCreate = body; return { ok: true, json: async () => ({ url: 'https://www.notion.so/new123', id: 'new' }) } }
  return { ok: false, status: 404, json: async () => ({ message: 'nf' }) }
}
process.env.NOTION_API_KEY = 'test'
process.env.FITLOG_PASSCODE = 'pw'
const handler = require('../api/fitlog/notion')
const run = (body, headers = { 'x-fitlog-key': 'pw' }) => new Promise((resolve) => { const res = { status(c) { this.c = c; return this }, json(d) { resolve([this.c, d]) } }; handler({ method: 'POST', headers, body }, res) })
;(async () => {
  assert.deepStrictEqual(await run({ tool: 'status' }), [200, { configured: true }])
  assert.strictEqual((await run({ tool: 'status' }, {}))[0], 401)
  const q = await run({ tool: 'notion-query-data-sources', input: { data: { mode: 'rows', data_source_url: 'collection://3cf821f3-6a98-8089-acda-000b21c8dea5', limit: 100 } } })
  assert.strictEqual(q[0], 200); assert.strictEqual(q[1].results[0]['店の名前'], 'テスト')
  const c = await run({ tool: 'notion-create-pages', input: { pages: [{ properties: { 店の名前: 'X', 'date:飲み会日付:start': '2026-11-07', 杯数: 2 }, content: 'l1\nl2' }] } })
  assert.strictEqual(c[1].url, 'https://www.notion.so/new123')
  assert.strictEqual(global.lastCreate.parent.data_source_id, '3cf821f3-6a98-8089-acda-000b21c8dea5')
  delete process.env.ANTHROPIC_API_KEY
  const ai = require('../api/fitlog/ai')
  const r = await new Promise((resolve) => { const res = { status(c) { this.c = c; return this }, json(d) { resolve([this.c, d]) } }; ai({ method: 'POST', headers: { 'x-fitlog-key': 'pw' }, body: { input: 'hi' } }, res) })
  assert.strictEqual(r[1].code, 'sampling_disabled')
  console.log('all tests passed')
})().catch((e) => { console.error(e); process.exit(1) })
