# FitLog — 食事 × 筋トレ 統合アプリ (Expo / React Native)

写真から食事を AI 解析してカロリー・PFC を自動記録し、次の食事を提案。筋トレは前回との比較で成長を可視化。
体重は手入力・体重計の撮影読み取り・Apple Health 連携(eufy → EufyLife → Apple Health)。
プロテイン/サプリの摂取時刻を生活リズムから提案し、毎日ローカル通知します。

## 画面構成

| タブ | 内容 | 主なファイル |
|---|---|---|
| 今日 | 残りカロリー/たんぱく質、体重の週次変化、今日の種目、次のサプリ | `app/(tabs)/index.tsx` |
| 食事 | カメラ/写真 → Claude で解析 → 確認して保存 → 次の食事提案を生成 | `app/(tabs)/meals.tsx`, `app/meal/[id].tsx` |
| 筋トレ | 種目・重量・回数を入力。セットごとに前回と並べて比較、ボリューム/最大重量/推定1RMの差分 | `app/(tabs)/workout.tsx`, `app/exercise/[name].tsx` |
| 体重 | 手入力、体重計の撮影読み取り、Apple Health 取り込み、推移グラフ | `app/(tabs)/weight.tsx` |
| サプリ | 起床/トレ/就寝時刻から摂取時刻を自動提案し、毎日通知 | `app/(tabs)/supplements.tsx` |
| 設定(右上) | Anthropic API キー、目標 kcal/たんぱく質、生活リズム | `app/settings.tsx` |

## ロジック層 (`lib/`)

- `db.ts` — expo-sqlite。meals / workout_sets / weights / supplements / settings テーブルと集計クエリ。
- `ai.ts` — Anthropic SDK (`claude-opus-5-5`)。食事写真解析と体重計読み取りは structured output(zod)で JSON を受け取る。次の食事提案はテキスト生成。安全フォールバック(`fallbacks: "default"`)を有効化済み。
- `supplementPlan.ts` — プロフィールからサプリ時刻を決めるルール。
- `notifications.ts` — expo-notifications の毎日トリガー。
- `health.ts` — react-native-health で Apple Health の体重/体脂肪率を取り込み(iOS のみ)。
- `photo.ts` — expo-image-picker でカメラ/ライブラリから base64 取得。

## セットアップ

```bash
npm install
```

ネイティブモジュール(SQLite / 通知 / HealthKit)を含むため **Expo Go では動きません**。開発ビルドを作ります。

```bash
# iOS (Mac が必要) / Android
npx expo run:ios
npx expo run:android
```

または EAS でクラウドビルド:

```bash
npx eas-cli@latest build --profile development --platform ios
```

起動後、右上の歯車 → Anthropic API キー を登録してください(端末の SecureStore に保存)。

## eufy 体重計の取り込み方法

1. EufyLife アプリで体重計をペアリング
2. EufyLife の「Me」→ Apple Health(iOS) / Health Connect(Android) 連携を ON
3. 本アプリ「体重」タブ → 「Apple Healthから取得」(iOS)

Android は Health Connect 読み取り(`react-native-health-connect` など)が未実装のため、「体重計を撮影して読み取り」か手入力を使ってください。

## 既知の制限 / 今後

- API キーを端末に置く構成は個人利用向け。公開配布するなら中継サーバーを挟む。
- Android の Health Connect 連携は未実装。
- 写真は端末の一時 URI を保存しているだけなので、OS が消すとサムネイルが出なくなる(解析結果は残る)。必要なら `expo-file-system` でアプリ領域にコピーする。
- 通知は端末ローカル(アプリを削除すると消える)。
- 実機での動作確認は未実施(型チェック・lint・Metro バンドルまで確認済み)。
