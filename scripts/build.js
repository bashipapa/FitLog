// src/fitlog.html (claude.ai アーティファクトと同じ本文) と src/shim.js を
// 1 枚の HTML 文書に包んで public/index.html として書き出す。
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const body = fs.readFileSync(path.join(root, 'src', 'fitlog.html'), 'utf8')
const shim = fs.readFileSync(path.join(root, 'src', 'shim.js'), 'utf8')

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1f6f5a" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#131716" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="FitLog">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script>${shim}</script>
</head>
<body>
${body
  // アーティファクト向けの head 相当タグは、ここでは上で絶対パス指定しているので外す
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
  .replace(/<link rel="icon"[^>]*>\n?/, '')
  .replace(/<meta name="apple-mobile-web-app-title"[^>]*>\n?/, '')
  .replace(/<meta name="apple-mobile-web-app-capable"[^>]*>\n?/, '')
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '')}
</body>
</html>
`
fs.writeFileSync(path.join(root, 'public', 'index.html'), html)
console.log('wrote public/index.html', html.length, 'bytes')
