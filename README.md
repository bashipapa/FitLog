# FitLog

食事の写真解析、筋トレの前回比較と成長グラフ、体重、サプリの時刻提案、飲み会(Notion連携)をスマホ1台で記録するアプリ。
Vercel にデプロイして、ホーム画面に追加して使う。

## 構成

| 場所 | 役割 |
| --- | --- |
| `src/fitlog.html` | ページ本体 (claude.ai のアーティファクト版と同じ内容) |
| `src/shim.js` | claude.ai の外で開いたとき、AI 解析と Notion 連携を `/api/fitlog/*` に流す互換層 |
| `scripts/build.js` | 上の 2 つを `public/index.html` に組み立てる (Vercel のビルドで実行) |
| `api/fitlog/ai.js` | 食事写真・体重計の読み取り・食事提案 (Anthropic API) |
| `api/fitlog/notion.js` | 🍻飲み会 DB の読み書き (Notion 公式 API) |
| `lib/` | 認証と Notion の変換 |
| `native/` | Expo (React Native) 版の雛形。Apple Health 連携などネイティブでしかできない機能用 |

## デプロイ (Vercel)

1. Vercel で「Add New Project」→ この GitHub リポジトリを選ぶ。Framework Preset は「Other」のまま (vercel.json で設定済み)。
2. Environment Variables に以下を追加して Deploy。

| 変数 | 用途 |
| --- | --- |
| `ANTHROPIC_API_KEY` | 写真解析と食事提案。未設定だとその機能だけ使えない |
| `NOTION_API_KEY` | 飲み会タブの Notion 連携。Notion の「インテグレーション」で発行した `ntn_...` 形式のトークン。発行後、🍻飲み会 DB と「参加者別 飲み会回数（集計用）」DB の両方を、そのインテグレーションに「接続」する |
| `FITLOG_PASSCODE` | 任意の合言葉。設定すると、アプリの設定画面で同じ値を入れた端末だけが上の 2 つの API を呼べる。公開 URL では必ず設定する |

3. スマホで URL を開き、右上「設定」→「アクセスキー」に `FITLOG_PASSCODE` と同じ値を入れて保存。
4. 「ホーム画面に追加」(iPhone: Safari の共有メニュー / Android: Chrome のメニュー)。

## データの保存場所

食事・筋トレ・体重・サプリの記録はブラウザの localStorage にだけ保存される (端末ごと、同期なし)。
飲み会は Notion にも書き込まれる。claude.ai のアーティファクト版とはデータを共有しない。

## ローカルで動かす

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # Notion 変換と API ハンドラのテスト
```

AI と Notion を使うときは環境変数を付けて起動する: `ANTHROPIC_API_KEY=... NOTION_API_KEY=... npm run dev`
