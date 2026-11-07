import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Card, Input, Label, Row, Screen, Spacer, useTheme } from '@/components/ui';
import {
  dateKey,
  deleteSet,
  insertSet,
  knownExercises,
  previousSessionDate,
  setsForSession,
  type WorkoutSet,
} from '@/lib/db';
import { md, r1, signed } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';

const PRESETS = ['ベンチプレス', 'スクワット', 'デッドリフト', 'ショルダープレス', 'ラットプルダウン', 'バーベルロウ', 'アームカール', 'レッグプレス'];

export default function WorkoutScreen() {
  const t = useTheme();
  const today = dateKey();
  const [exercises, reloadExercises] = useFocusData<string[]>(knownExercises, []);
  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [todaySets, setTodaySets] = useState<WorkoutSet[]>([]);
  const [prevSets, setPrevSets] = useState<WorkoutSet[]>([]);
  const [prevDate, setPrevDate] = useState<string | null>(null);

  async function loadSession(name: string) {
    if (!name) return;
    const [cur, pd] = await Promise.all([setsForSession(name, today), previousSessionDate(name, today)]);
    setTodaySets(cur);
    setPrevDate(pd);
    setPrevSets(pd ? await setsForSession(name, pd) : []);
    if (!weight && !reps) {
      const last = cur[cur.length - 1] ?? (pd ? (await setsForSession(name, pd))[0] : undefined);
      if (last) {
        setWeight(String(last.weight_kg));
        setReps(String(last.reps));
      }
    }
  }

  function chooseExercise(name: string, resetInputs = false) {
    setExercise(name);
    if (resetInputs) {
      setWeight('');
      setReps('');
    }
    void loadSession(name);
  }

  useFocusEffect(
    useCallback(() => {
      if (exercise) void loadSession(exercise);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function addSet() {
    const w = Number(weight);
    const r = Number(reps);
    if (!exercise.trim() || !Number.isFinite(w) || !Number.isFinite(r) || r <= 0) {
      Alert.alert('種目・重量・回数を入力してください');
      return;
    }
    await insertSet({
      ts: Date.now(),
      session_date: today,
      exercise: exercise.trim(),
      weight_kg: w,
      reps: r,
      set_index: todaySets.length + 1,
    });
    reloadExercises();
    await loadSession(exercise);
  }

  const todayVol = todaySets.reduce((a, s) => a + s.weight_kg * s.reps, 0);
  const prevVol = prevSets.reduce((a, s) => a + s.weight_kg * s.reps, 0);
  const todayMax = Math.max(0, ...todaySets.map((s) => s.weight_kg));
  const prevMax = Math.max(0, ...prevSets.map((s) => s.weight_kg));
  const suggestions = Array.from(new Set([...exercises, ...PRESETS]));

  return (
    <Screen>
      <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>種目</Label>
          <Input placeholder="種目名を入力" value={exercise} onChangeText={(v) => chooseExercise(v)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {suggestions.map((name) => (
              <Pressable
                key={name}
                onPress={() => chooseExercise(name, true)}
                style={[
                  st.chip,
                  { backgroundColor: name === exercise ? t.tint : t.background, borderColor: t.border },
                ]}>
                <Body style={{ color: name === exercise ? '#fff' : t.text }}>{name}</Body>
              </Pressable>
            ))}
          </ScrollView>
          <Spacer h={10} />
          <Row>
            <View style={{ flex: 1 }}>
              <Label>重量 (kg)</Label>
              <Input keyboardType="decimal-pad" value={weight} onChangeText={setWeight} placeholder="60" />
            </View>
            <View style={{ flex: 1 }}>
              <Label>回数</Label>
              <Input keyboardType="number-pad" value={reps} onChangeText={setReps} placeholder="10" />
            </View>
          </Row>
          <Spacer h={10} />
          <Button title={`セット ${todaySets.length + 1} を記録`} onPress={addSet} disabled={!exercise} />
        </Card>

        {exercise ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label>今日 vs 前回{prevDate ? ` (${md(prevDate)})` : ''}</Label>
              <Pressable onPress={() => router.push({ pathname: '/exercise/[name]', params: { name: exercise } })}>
                <Body style={{ color: t.tint }}>履歴を見る</Body>
              </Pressable>
            </Row>
            {prevDate ? (
              <Row style={{ justifyContent: 'space-around', marginVertical: 6 }}>
                <Stat label="総ボリューム" value={`${Math.round(todayVol)} kg`} delta={todayVol - prevVol} unit="kg" />
                <Stat label="最大重量" value={`${r1(todayMax)} kg`} delta={todayMax - prevMax} unit="kg" digits={1} />
                <Stat label="セット数" value={String(todaySets.length)} delta={todaySets.length - prevSets.length} unit="" />
              </Row>
            ) : (
              <Body muted>この種目は初回です。今日の記録が次回の比較対象になります。</Body>
            )}
            <Spacer h={6} />
            {Array.from({ length: Math.max(todaySets.length, prevSets.length) }).map((_, i) => {
              const cur = todaySets[i];
              const prev = prevSets[i];
              const better = cur && prev ? cur.weight_kg * cur.reps - prev.weight_kg * prev.reps : 0;
              return (
                <Row key={i} style={[st.setRow, { borderColor: t.border }]}>
                  <Body muted style={{ width: 28 }}>
                    {i + 1}
                  </Body>
                  <View style={{ flex: 1 }}>
                    <Body bold={!!cur}>{cur ? `${r1(cur.weight_kg)} kg × ${cur.reps}` : '—'}</Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body muted>{prev ? `${r1(prev.weight_kg)} kg × ${prev.reps}` : '—'}</Body>
                  </View>
                  <Body style={{ width: 56, textAlign: 'right', color: better > 0 ? t.success : better < 0 ? t.danger : t.muted }}>
                    {cur && prev ? signed(better) : ''}
                  </Body>
                  {cur ? (
                    <Pressable
                      onPress={() =>
                        Alert.alert('このセットを削除?', '', [
                          { text: 'キャンセル', style: 'cancel' },
                          {
                            text: '削除',
                            style: 'destructive',
                            onPress: async () => {
                              await deleteSet(cur.id);
                              await loadSession(exercise);
                            },
                          },
                        ])
                      }>
                      <Body style={{ color: t.danger }}> ×</Body>
                    </Pressable>
                  ) : (
                    <Body> </Body>
                  )}
                </Row>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, delta, unit, digits = 0 }: { label: string; value: string; delta: number; unit: string; digits?: number }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Label>{label}</Label>
      <Body bold>{value}</Body>
      <Body style={{ color: delta > 0 ? t.success : delta < 0 ? t.danger : t.muted }}>
        {signed(delta, digits)} {unit}
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginRight: 8 },
  setRow: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
});
