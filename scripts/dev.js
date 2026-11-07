// ローカル確認用の小さなサーバー。public/ を配信し、/api/fitlog/* を api/ の関数に渡す
// (Vercel の Node 関数と同じ req.body / res.status().json() の形で呼ぶ)。
const http = require('http')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const port = Number(process.env.PORT) || 3000
const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.json': 'application/json' }

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      const file = path.join(root, url.pathname.replace(/\.\./g, '') + '.js')
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found') }
      let raw = ''
      for await (const chunk of req) raw += chunk
      try { req.body = raw ? JSON.parse(raw) : {} } catch (_) { req.body = {} }
      res.status = (c) => { res.statusCode = c; return res }
      res.json = (d) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(d)) }
      delete require.cache[require.resolve(file)]
      return require(file)(req, res)
    }
    let p = path.join(root, 'public', url.pathname === '/' ? 'index.html' : url.pathname)
    if (!p.startsWith(path.join(root, 'public'))) { res.writeHead(403); return res.end() }
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found') }
    res.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream')
    fs.createReadStream(p).pipe(res)
  })
  .listen(port, () => console.log(`FitLog dev: http://localhost:${port}`))
