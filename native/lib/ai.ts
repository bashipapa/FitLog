import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { DayTotals, MealItem } from './db';
import { getApiKey, type Profile } from './settings';

// Model and request defaults. The app talks to the Claude API directly from the
// device with the user's own key (single-user app). For a multi-user release,
// move these calls behind a server so the key never ships in the app.
const MODEL = 'claude-opus-5-5';
const BETAS = ['server-side-fallback-2026-07-01'] as const;

async function client(): Promise<Anthropic> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('設定画面でAnthropic APIキーを登録してください');
  return new Anthropic({ apiKey, timeout: 120_000 });
}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const MealAnalysisSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe('料理・食品名(日本語)'),
      amount: z.string().describe('推定量。例: 茶碗1杯(150g), 2切れ'),
      kcal: z.number(),
      protein_g: z.number(),
      fat_g: z.number(),
      carb_g: z.number(),
    })
  ),
  total_kcal: z.number(),
  total_protein_g: z.number(),
  total_fat_g: z.number(),
  total_carb_g: z.number(),
  confidence: z.enum(['low', 'medium', 'high']).describe('推定の確信度'),
  comment: z.string().describe('一言コメント(60字以内)。見えにくい物や量の不確かさがあれば触れる'),
});

export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

export async function analyzeMealPhoto(
  base64: string,
  mediaType: ImageMediaType,
  hint?: string
): Promise<MealAnalysis> {
  const c = await client();
  const res = await c.beta.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    betas: [...BETAS],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: zodOutputFormat(MealAnalysisSchema) },
    system:
      'あなたは管理栄養士です。食事写真から料理を特定し、日本の一般的な盛り付け量を基準に' +
      '各品目のカロリーとPFC(たんぱく質・脂質・炭水化物)を推定します。' +
      '調味料や油も含めて現実的に見積もり、合計値は品目の合計と一致させてください。',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: hint
              ? `この食事を分析してください。補足: ${hint}`
              : 'この食事を分析してください。',
          },
        ],
      },
    ],
  });
  if (res.stop_reason === 'refusal') {
    throw new Error('この画像は分析できませんでした');
  }
  if (!res.parsed_output) throw new Error('解析結果を読み取れませんでした');
  return res.parsed_output;
}

export function analysisToItems(a: MealAnalysis): MealItem[] {
  return a.items.map((i) => ({
    name: i.name,
    amount: i.amount,
    kcal: i.kcal,
    protein_g: i.protein_g,
    fat_g: i.fat_g,
    carb_g: i.carb_g,
  }));
}

export async function suggestNextMeal(input: {
  todayTotals: DayTotals;
  lastMeal: MealAnalysis;
  profile: Profile;
  now: Date;
  trainedToday: boolean;
}): Promise<string> {
  const c = await client();
  const { todayTotals: t, profile: p, lastMeal, now, trainedToday } = input;
  const goalJa = { cut: '減量', bulk: '増量(筋肥大)', maintain: '維持' }[p.goal];
  const hhmm = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const res = await c.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: [...BETAS],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system:
      'あなたは筋トレをする人向けの食事コーチです。次の食事の具体的な提案を日本語で、' +
      '箇条書き3〜4行、合計150字程度で返してください。コンビニや家庭で用意しやすい具体例を挙げ、' +
      '残りカロリーとたんぱく質の不足分を数字で示してください。前置きは不要です。',
    messages: [
      {
        role: 'user',
        content:
          `現在時刻 ${hhmm}。目標: ${goalJa}、1日の目標 ${p.kcalTarget}kcal / たんぱく質 ${p.proteinTarget}g。` +
          `就寝予定 ${p.bedTime}。今日のトレーニング: ${trainedToday ? '済み' : 'まだ(通常 ' + p.usualWorkoutTime + ')'}。\n` +
          `今日ここまでの合計(今の食事を含む): ${Math.round(t.kcal)}kcal, P ${Math.round(t.protein_g)}g, F ${Math.round(t.fat_g)}g, C ${Math.round(t.carb_g)}g(${t.count}食)。\n` +
          `今食べたもの: ${lastMeal.items.map((i) => `${i.name} ${i.amount}`).join('、')}。\n` +
          '次の食事(または間食)の提案をください。',
      },
    ],
  });
  if (res.stop_reason === 'refusal') return '提案を生成できませんでした。';
  return res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

const ScaleReadingSchema = z.object({
  weight_kg: z.number().nullable().describe('表示されている体重(kg)。読めなければnull'),
  body_fat_pct: z.number().nullable().describe('体脂肪率(%)が表示されていればその値。無ければnull'),
  note: z.string().describe('読み取りの補足。単位がlbだった、数字が一部欠けていた等'),
});

export type ScaleReading = z.infer<typeof ScaleReadingSchema>;

export async function readScalePhoto(base64: string, mediaType: ImageMediaType): Promise<ScaleReading> {
  const c = await client();
  const res = await c.beta.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    betas: [...BETAS],
    fallbacks: 'default',
    output_config: { effort: 'low', format: zodOutputFormat(ScaleReadingSchema) },
    system:
      '体重計(またはアプリ画面)の写真から数値を正確に読み取ります。' +
      'lb表示ならkgに換算し、noteにその旨を書いてください。推測で数値を作らないでください。',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: '体重と体脂肪率を読み取ってください。' },
        ],
      },
    ],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error('画像を読み取れませんでした');
  return res.parsed_output;
}
