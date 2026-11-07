import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Card, Label, Row, Screen, useTheme } from '@/components/ui';
import { exerciseHistory, type SessionSummary } from '@/lib/db';
import { md, r1, signed } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';

export default function ExerciseHistory() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const t = useTheme();
  const [history] = useFocusData<SessionSummary[]>(() => exerciseHistory(name, 20), []);
  const asc = [...history].reverse();
  const maxVol = Math.max(1, ...asc.map((h) => h.volume));
  const first = asc[0];
  const last = asc[asc.length - 1];

  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />
      <ScrollView contentContainerStyle={st.container}>
        {first && last && asc.length > 1 ? (
          <Card>
            <Label>
              {md(first.session_date)} → {md(last.session_date)} ({asc.length}回)
            </Label>
            <Row style={{ justifyContent: 'space-around' }}>
              <Growth label="推定1RM" from={first.best_e1rm} to={last.best_e1rm} unit="kg" />
              <Growth label="最大重量" from={first.max_weight} to={last.max_weight} unit="kg" />
              <Growth label="ボリューム" from={first.volume} to={last.volume} unit="kg" digits={0} />
            </Row>
          </Card>
        ) : null}

        <Card>
          <Label>セッションごとのボリューム</Label>
          {asc.map((h) => (
            <Row key={h.session_date} style={{ marginVertical: 3 }}>
              <Body muted style={{ width: 44 }}>
                {md(h.session_date)}
              </Body>
              <View style={[st.barBg, { backgroundColor: t.border }]}>
                <View style={[st.barFg, { width: `${(h.volume / maxVol) * 100}%`, backgroundColor: t.tint }]} />
              </View>
              <Body style={{ width: 70, textAlign: 'right' }}>{Math.round(h.volume)}</Body>
            </Row>
          ))}
          {!asc.length && <Body muted>記録がありません</Body>}
        </Card>

        <Card>
          <Label>履歴</Label>
          {history.map((h, i) => {
            const prev = history[i + 1];
            return (
              <Row key={h.session_date} style={[st.row, { borderColor: t.border }]}>
                <Body style={{ width: 52 }}>{md(h.session_date)}</Body>
                <Body style={{ flex: 1 }}>
                  {r1(h.max_weight)} kg 最大 ・ {h.sets} set
                </Body>
                <Body muted>1RM {r1(h.best_e1rm)}</Body>
                <Body
                  style={{
                    width: 52,
                    textAlign: 'right',
                    color: prev ? (h.best_e1rm > prev.best_e1rm ? t.success : h.best_e1rm < prev.best_e1rm ? t.danger : t.muted) : t.muted,
                  }}>
                  {prev ? signed(h.best_e1rm - prev.best_e1rm, 1) : ''}
                </Body>
              </Row>
            );
          })}
        </Card>
        <Body muted>推定1RM は Epley 式 (重量 × (1 + 回数/30)) で計算しています。</Body>
      </ScrollView>
    </Screen>
  );
}

function Growth({ label, from, to, unit, digits = 1 }: { label: string; from: number; to: number; unit: string; digits?: number }) {
  const t = useTheme();
  const d = to - from;
  const pct = from > 0 ? (d / from) * 100 : 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <Label>{label}</Label>
      <Body bold>
        {digits ? r1(to) : Math.round(to)} {unit}
      </Body>
      <Body style={{ color: d > 0 ? t.success : d < 0 ? t.danger : t.muted }}>
        {signed(d, digits)} ({signed(pct)}%)
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  barBg: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', marginHorizontal: 8 },
  barFg: { height: 10, borderRadius: 5 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
