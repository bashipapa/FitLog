// claude.ai の外 (Vercel 上) で開かれたときだけ有効になる互換層。
// ページ本体は claude.ai の runtime (sample / mcp) と同じ呼び方をするので、
// ここで同じ形の関数を用意し、中身は /api/fitlog/* に投げる。
;(function () {
  if (window.claude && typeof window.claude.use === 'function') return
  var key = function () {
    try {
      return localStorage.getItem('fitlog:key') || ''
    } catch (e) {
      return ''
    }
  }
  function call(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-fitlog-key': key() },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r
          .json()
          .catch(function () {
            return {}
          })
          .then(function (data) {
            if (!r.ok)
              throw {
                code:
                  data.code ||
                  (r.status === 401
                    ? 'bad_key'
                    : r.status === 429
                    ? 'rate_limited'
                    : 'upstream_error'),
                message: data.message || r.statusText,
                text: data.text,
              }
            return data
          })
      })
      .catch(function (e) {
        if (e && e.code) throw e
        throw { code: 'upstream_error', message: String((e && e.message) || e) }
      })
  }
  // 送信前に長辺 1280px の JPEG に縮小する (転送量と API 制限のため)
  function shrink(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob)
      var img = new Image()
      img.onload = function () {
        var s = Math.min(1, 1280 / Math.max(img.width, img.height))
        var c = document.createElement('canvas')
        c.width = Math.round(img.width * s)
        c.height = Math.round(img.height * s)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        res(c.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = function () {
        URL.revokeObjectURL(url)
        rej({ code: 'image_rejected', message: 'cannot decode image' })
      }
      img.src = url
    })
  }
  function images(opts) {
    var list =
      opts && opts.images
        ? opts.images instanceof Blob
          ? [opts.images]
          : Array.prototype.slice.call(opts.images)
        : []
    return Promise.all(list.map(shrink))
  }
  function sample(input, opts) {
    opts = opts || {}
    return images(opts)
      .then(function (imgs) {
        return call('/api/fitlog/ai', {
          input: input,
          images: imgs,
          json: false,
          tier: opts.modelTier || 'default',
        })
      })
      .then(function (d) {
        if (opts.onText) opts.onText({ text: d.text, delta: d.text })
        return {
          text: d.text,
          truncated: !!d.truncated,
          modelTierApplied: opts.modelTier || 'default',
        }
      })
  }
  sample.json = function (input, opts) {
    opts = opts || {}
    return images(opts)
      .then(function (imgs) {
        return call('/api/fitlog/ai', {
          input: input,
          images: imgs,
          json: true,
          tier: opts.modelTier || 'default',
        })
      })
      .then(function (d) {
        return d.value
      })
  }
  sample.limits = function () {
    return Promise.resolve({
      maxPromptBytes: 262144,
      images: {
        maxCount: 5,
        maxInputBytes: 20000000,
        mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      },
      modelTiers: ['default', 'complex', 'quick'],
    })
  }
  var mcp = {
    listTools: function () {
      return call('/api/fitlog/notion', { tool: 'status' }).then(function (d) {
        return {
          servers: d.configured
            ? [
                {
                  server: 'Notion',
                  authStatus: 'connected',
                  tools: [
                    { name: 'notion-create-pages', description: '' },
                    { name: 'notion-query-data-sources', description: '' },
                  ],
                },
              ]
            : [],
        }
      })
    },
    callTool: function (server, tool, input) {
      return call('/api/fitlog/notion', { tool: tool, input: input }).then(
        function (d) {
          return { content: [], payload: d }
        }
      )
    },
    invalidate: function () {
      return Promise.resolve()
    },
  }
  window.__fitlogShim = { sample: sample, mcp: mcp }
})()
