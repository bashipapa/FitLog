import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Big, Body, Button, Card, Label, Row, Screen, Spacer, useTheme } from '@/components/ui';
import {
  dateKey,
  exercisesOnDate,
  listSupplements,
  recentWeights,
  totalsForDate,
  type DayTotals,
  type Supplement,
  type WeightEntry,
} from '@/lib/db';
import { r0, r1, signed } from '@/lib/format';
import { getProfile, type Profile } from '@/lib/settings';
import { useFocusData } from '@/lib/useFocusData';

type Home = {
  totals: DayTotals;
  profile: Profile;
  weights: WeightEntry[];
  exercises: string[];
  supplements: Supplement[];
};

export default function HomeScreen() {
  const t = useTheme();
  const [data] = useFocusData<Home | null>(async () => {
    const today = dateKey();
    const [totals, profile, weights, exercises, supplements] = await Promise.all([
      totalsForDate(today),
      getProfile(),
      recentWeights(14),
      exercisesOnDate(today),
      listSupplements(),
    ]);
    return { totals, profile, weights, exercises, supplements };
  }, null);

  if (!data) return <Screen />;
  const { totals, profile, weights, exercises, supplements } = data;
  const kcalLeft = profile.kcalTarget - totals.kcal;
  const pLeft = profile.proteinTarget - totals.protein_g;
  const latest = weights[0];
  const weekAgo = weights.find((w) => latest && latest.ts - w.ts >= 6 * 24 * 3600 * 1000);
  const nowHm = new Date().toTimeString().slice(0, 5);
  const nextSupp = supplements.filter((s) => s.enabled).find((s) => s.time >= nowHm);

  return (
    <Screen>
      <ScrollView contentContainerStyle={st.container}>
        <Card>
          <Label>今日の食事</Label>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Big>{r0(totals.kcal)} kcal</Big>
              <Body muted>
                残り {r0(kcalLeft)} kcal / 目標 {profile.kcalTarget}
              </Body>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Big color={pLeft <= 0 ? t.success : t.text}>P {r0(totals.protein_g)}g</Big>
              <Body muted>あと {r0(Math.max(pLeft, 0))} g</Body>
            </View>
          </Row>
          <Bar value={totals.kcal} max={profile.kcalTarget} color={t.tint} />
          <Bar value={totals.protein_g} max={profile.proteinTarget} color={t.success} />
          <Spacer h={8} />
          <Button title="写真で食事を記録" onPress={() => router.push('/meals?capture=1')} />
        </Card>

        <Card>
          <Label>体重</Label>
          {latest ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Big>{r1(latest.weight_kg)} kg</Big>
              <View style={{ alignItems: 'flex-end' }}>
                {weekAgo ? (
                  <Body bold style={{ color: latest.weight_kg - weekAgo.weight_kg <= 0 ? t.success : t.text }}>
                    {signed(latest.weight_kg - weekAgo.weight_kg, 1)} kg / 週
                  </Body>
                ) : (
                  <Body muted>1週間分たまると変化を表示</Body>
                )}
                {latest.body_fat_pct != null && <Body muted>体脂肪 {r1(latest.body_fat_pct)}%</Body>}
              </View>
            </Row>
          ) : (
            <Body muted>まだ記録がありません。体重タブから登録できます。</Body>
          )}
        </Card>

        <Card>
          <Label>今日の筋トレ</Label>
          {exercises.length ? (
            <Body>{exercises.join('、')}</Body>
          ) : (
            <Body muted>まだ記録なし。通常は {profile.usualWorkoutTime} 頃</Body>
          )}
          <Spacer h={8} />
          <Button title="セットを記録" kind="secondary" onPress={() => router.push('/workout')} />
        </Card>

        <Card>
          <Label>次のサプリ</Label>
          {nextSupp ? (
            <Body>
              {nextSupp.time} {nextSupp.name}
            </Body>
          ) : supplements.length ? (
            <Body muted>今日の分は完了。明日は {supplements[0].time} {supplements[0].name}</Body>
          ) : (
            <Body muted>サプリタブで通知スケジュールを作成できます</Body>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const t = useTheme();
  const pct = Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100));
  return (
    <View style={[st.barBg, { backgroundColor: t.border }]}>
      <View style={[st.barFg, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  barBg: { height: 8, borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  barFg: { height: 8, borderRadius: 4 },
});
