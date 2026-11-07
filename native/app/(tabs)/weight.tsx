import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Big, Body, Button, Card, Input, Label, Row, Screen, Spacer, useTheme } from '@/components/ui';
import { readScalePhoto } from '@/lib/ai';
import { dateKey, deleteWeight, insertWeight, recentWeights, type WeightEntry } from '@/lib/db';
import { hhmm, r1, signed } from '@/lib/format';
import { importWeightsFromHealthKit } from '@/lib/health';
import { pickPhoto } from '@/lib/photo';
import { useFocusData } from '@/lib/useFocusData';

export default function WeightScreen() {
  const t = useTheme();
  const [weights, reload] = useFocusData<WeightEntry[]>(() => recentWeights(90), []);
  const [kg, setKg] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function saveManual(source: WeightEntry['source'] = 'manual') {
    const w = Number(kg);
    if (!Number.isFinite(w) || w <= 0) {
      Alert.alert('体重を入力してください');
      return;
    }
    const f = fat ? Number(fat) : null;
    await insertWeight({ ts: Date.now(), weight_kg: w, body_fat_pct: Number.isFinite(f as number) ? f : null, source });
    setKg('');
    setFat('');
    reload();
  }

  async function fromPhoto() {
    const photo = await pickPhoto(false);
    if (!photo) return;
    setBusy('体重計の表示を読み取り中…');
    try {
      const r = await readScalePhoto(photo.base64, photo.mediaType);
      if (r.weight_kg == null) {
        Alert.alert('読み取れませんでした', r.note);
        return;
      }
      setKg(String(r.weight_kg));
      setFat(r.body_fat_pct != null ? String(r.body_fat_pct) : '');
      Alert.alert('読み取り結果', `${r.weight_kg} kg${r.body_fat_pct != null ? ` / 体脂肪 ${r.body_fat_pct}%` : ''}\n${r.note}`, [
        { text: '修正する', style: 'cancel' },
        { text: '保存', onPress: () => void saveManualWith(r.weight_kg!, r.body_fat_pct) },
      ]);
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveManualWith(w: number, f: number | null) {
    await insertWeight({ ts: Date.now(), weight_kg: w, body_fat_pct: f, source: 'photo' });
    setKg('');
    setFat('');
    reload();
  }

  async function fromHealth() {
    setBusy('Apple Healthから取得中…');
    try {
      const r = await importWeightsFromHealthKit();
      if (r.error) Alert.alert('取得できません', r.error);
      else Alert.alert('取得完了', `${r.imported}件を取り込みました`);
      reload();
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const latest = weights[0];
  const series = [...weights].reverse().slice(-30);
  const min = Math.min(...series.map((w) => w.weight_kg));
  const max = Math.max(...series.map((w) => w.weight_kg));
  const range = Math.max(max - min, 1);
  const avg = (arr: WeightEntry[]) => (arr.length ? arr.reduce((a, w) => a + w.weight_kg, 0) / arr.length : 0);
  const now = latest?.ts ?? 0;
  const week = weights.filter((w) => now - w.ts < 7 * 86400e3);
  const prevWeek = weights.filter((w) => now - w.ts >= 7 * 86400e3 && now - w.ts < 14 * 86400e3);

  return (
    <Screen>
      <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>最新</Label>
          {latest ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Big>{r1(latest.weight_kg)} kg</Big>
              <View style={{ alignItems: 'flex-end' }}>
                {week.length && prevWeek.length ? (
                  <Body bold style={{ color: avg(week) - avg(prevWeek) <= 0 ? t.success : t.text }}>
                    週平均 {signed(avg(week) - avg(prevWeek), 1)} kg
                  </Body>
                ) : null}
                <Body muted>
                  {dateKey(latest.ts).slice(5).replace('-', '/')} {hhmm(latest.ts)} ・{' '}
                  {{ manual: '手入力', photo: '写真', healthkit: 'Apple Health' }[latest.source]}
                </Body>
              </View>
            </Row>
          ) : (
            <Body muted>まだ記録がありません</Body>
          )}
          {series.length > 1 && (
            <Row style={st.chart}>
              {series.map((w) => (
                <View
                  key={w.id}
                  style={[
                    st.dotCol,
                    { justifyContent: 'flex-end' },
                  ]}>
                  <View
                    style={[
                      st.bar,
                      { height: 12 + ((w.weight_kg - min) / range) * 60, backgroundColor: t.tint },
                    ]}
                  />
                </View>
              ))}
            </Row>
          )}
          {series.length > 1 && (
            <Row style={{ justifyContent: 'space-between' }}>
              <Body muted>{r1(min)} kg</Body>
              <Body muted>直近{series.length}回</Body>
              <Body muted>{r1(max)} kg</Body>
            </Row>
          )}
        </Card>

        <Card>
          <Label>記録する</Label>
          <Row>
            <View style={{ flex: 1 }}>
              <Input keyboardType="decimal-pad" placeholder="体重 kg" value={kg} onChangeText={setKg} />
            </View>
            <View style={{ flex: 1 }}>
              <Input keyboardType="decimal-pad" placeholder="体脂肪 % (任意)" value={fat} onChangeText={setFat} />
            </View>
          </Row>
          <Spacer h={8} />
          <Button title="保存" onPress={() => saveManual()} disabled={busy !== null} />
          <Spacer h={8} />
          <Row>
            <View style={{ flex: 1 }}>
              <Button title="体重計を撮影して読み取り" kind="secondary" onPress={fromPhoto} loading={busy !== null} />
            </View>
            {Platform.OS === 'ios' ? (
              <View style={{ flex: 1 }}>
                <Button title="Apple Healthから取得" kind="secondary" onPress={fromHealth} disabled={busy !== null} />
              </View>
            ) : null}
          </Row>
          {busy ? (
            <Body muted style={{ marginTop: 8 }}>
              {busy}
            </Body>
          ) : null}
          <Spacer h={8} />
          <Body muted>
            eufyの体重計はEufyLifeアプリで Apple Health / Google Fit(Health Connect) に連携できます。iOSではこのアプリから
            Apple Health 経由で自動取得、Androidは現状「撮影して読み取り」か手入力です。
          </Body>
        </Card>

        <Card>
          <Label>履歴</Label>
          {weights.slice(0, 30).map((w, i) => {
            const prev = weights[i + 1];
            return (
              <Row key={w.id} style={[st.row, { borderColor: t.border }]}>
                <Body muted style={{ width: 90 }}>
                  {dateKey(w.ts).slice(5).replace('-', '/')} {hhmm(w.ts)}
                </Body>
                <Body bold style={{ flex: 1 }}>
                  {r1(w.weight_kg)} kg{w.body_fat_pct != null ? `  ${r1(w.body_fat_pct)}%` : ''}
                </Body>
                <Body style={{ color: prev ? (w.weight_kg - prev.weight_kg <= 0 ? t.success : t.danger) : t.muted }}>
                  {prev ? signed(w.weight_kg - prev.weight_kg, 1) : ''}
                </Body>
                <Body
                  style={{ color: t.danger, paddingLeft: 10 }}
                  onPress={() =>
                    Alert.alert('削除しますか?', '', [
                      { text: 'キャンセル', style: 'cancel' },
                      { text: '削除', style: 'destructive', onPress: async () => { await deleteWeight(w.id); reload(); } },
                    ])
                  }>
                  ×
                </Body>
              </Row>
            );
          })}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  chart: { height: 80, alignItems: 'flex-end', marginTop: 12, gap: 2 },
  dotCol: { flex: 1, height: 80 },
  bar: { width: '100%', borderRadius: 2 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
