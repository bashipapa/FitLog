// FitLog Web 版の AI 解析エンドポイント。
// claude.ai 上ではページが直接 Claude を呼べるが、Vercel 上では
// このルート経由で Anthropic API を呼ぶ (キーはサーバー側だけが持つ)。
const Anthropic = require('@anthropic-ai/sdk')
const { authorize } = require('../../lib/auth')

// Vercel の Node 関数は JSON ボディを自動で req.body に入れる (上限 4.5MB)

const MODELS = {
  quick: 'claude-haiku-5-5',
  default: 'claude-opus-5-5',
  complex: 'claude-opus-5-5',
}

function parseDataUrl(url) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(url || '')
  return m ? { media_type: m[1], data: m[2] } : null
}

// sample.json と同じ寛容な読み方: 全体 → コードフェンス → 最初の { or [ から最後の } or ]
function tolerantJson(text) {
  const tries = [text]
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  if (fence) tries.push(fence[1])
  const a = text.search(/[{[]/)
  const b = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (a >= 0 && b > a) tries.push(text.slice(a, b + 1))
  for (const t of tries) {
    try {
      return JSON.parse(t)
    } catch (_) {
      /* next */
    }
  }
  return undefined
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ code: 'bad_request', message: 'POST only' })
  if (!authorize(req))
    return res
      .status(401)
      .json({ code: 'bad_key', message: 'access key required' })
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({
      code: 'sampling_disabled',
      message: 'ANTHROPIC_API_KEY is not set',
    })

  const { input, images = [], json = false, tier = 'default' } = req.body || {}
  if (!input || (typeof input !== 'string' && !Array.isArray(input)))
    return res
      .status(400)
      .json({ code: 'invalid_request', message: 'input required' })
  if (images.length > 5)
    return res
      .status(400)
      .json({ code: 'image_rejected', message: 'too many images' })

  const turns =
    typeof input === 'string'
      ? [{ role: 'user', content: input }]
      : input.map((t) => ({ role: t.role, content: t.content }))
  const blocks = images
    .map(parseDataUrl)
    .filter(Boolean)
    .map((img) => ({ type: 'image', source: { type: 'base64', ...img } }))
  const last = turns[turns.length - 1]
  const lastText =
    (json
      ? '返答は機械的に解析されます。JSON の値だけを返し、説明文は付けないでください。\n\n'
      : '') + last.content
  last.content = blocks.length
    ? [...blocks, { type: 'text', text: lastText }]
    : lastText

  const client = new Anthropic({ timeout: 120000 })
  try {
    const msg = await client.beta.messages.create({
      model: MODELS[tier] || MODELS.default,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: tier === 'quick' ? 'low' : 'medium' },
      messages: turns,
    })
    if (msg.stop_reason === 'refusal')
      return res.status(422).json({ code: 'refused', message: 'declined' })
    const text = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    if (!text)
      return res
        .status(502)
        .json({ code: 'empty_completion', message: 'no text' })
    if (json) {
      const value = tolerantJson(text)
      if (value === undefined)
        return res
          .status(422)
          .json({ code: 'invalid_json', message: 'no JSON in reply', text })
      return res.status(200).json({ value, text })
    }
    return res
      .status(200)
      .json({ text, truncated: msg.stop_reason === 'max_tokens' })
  } catch (e) {
    const status = e && e.status
    const code =
      status === 429
        ? 'rate_limited'
        : status === 401
        ? 'sampling_disabled'
        : status === 400
        ? 'invalid_request'
        : 'upstream_error'
    return res
      .status(status === 429 ? 429 : 502)
      .json({ code, message: String((e && e.message) || e).slice(0, 300) })
  }
}
