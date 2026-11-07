// FITLOG_PASSCODE を設定すると、FitLog の API は x-fitlog-key ヘッダーが
// 一致するリクエストだけを受け付ける (AI 利用料と Notion を守るため)。
// 未設定なら誰でも呼べる状態になるので、公開 URL では必ず設定すること。
function authorize(req) {
  const expected = process.env.FITLOG_PASSCODE
  if (!expected) return true
  const got = req.headers['x-fitlog-key']
  return typeof got === 'string' && got === expected
}
module.exports = { authorize }
