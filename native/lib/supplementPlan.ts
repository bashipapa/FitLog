import type { Profile } from './settings';

export type PlanItem = { name: string; time: string; reason: string };

function addMinutes(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Rule-based default schedule derived from the user's day.
 * Timing rationale is general sports-nutrition practice; the user can edit every entry.
 */
export function buildDefaultPlan(p: Profile): PlanItem[] {
  const items: PlanItem[] = [
    {
      name: 'プロテイン(起床後)',
      time: addMinutes(p.wakeTime, 15),
      reason: '睡眠中の空腹状態を早めに解消し、1日のたんぱく質摂取を分散させる',
    },
    {
      name: 'プロテイン(トレ後)',
      time: addMinutes(p.usualWorkoutTime, 60),
      reason: 'トレーニング後の筋たんぱく合成が高まる時間帯に合わせる',
    },
    {
      name: 'クレアチン',
      time: addMinutes(p.usualWorkoutTime, 60),
      reason: '毎日同じ時間に継続して摂ることが重要。食事やプロテインと一緒に',
    },
    {
      name: 'マルチビタミン',
      time: addMinutes(p.wakeTime, 60),
      reason: '朝食と一緒に摂ると脂溶性ビタミンの吸収がよい',
    },
    {
      name: 'プロテイン(就寝前)',
      time: addMinutes(p.bedTime, -45),
      reason: '就寝中のたんぱく質供給。カゼイン系または牛乳割りがおすすめ',
    },
  ];
  return items.sort((a, b) => a.time.localeCompare(b.time));
}
