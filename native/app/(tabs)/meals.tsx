import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';

import { Body, Button, Card, Input, Label, Row, Screen, Spacer, useTheme } from '@/components/ui';
import { analysisToItems, analyzeMealPhoto, suggestNextMeal, type MealAnalysis } from '@/lib/ai';
import { dateKey, exercisesOnDate, insertMeal, recentMeals, totalsForDate, updateMealSuggestion, type Meal } from '@/lib/db';
import { hhmm, r0 } from '@/lib/format';
import { persistPhoto, pickPhoto, type PickedPhoto } from '@/lib/photo';
import { getProfile } from '@/lib/settings';
import { useFocusData } from '@/lib/useFocusData';

type Draft = { photo: PickedPhoto; analysis: MealAnalysis };

export default function MealsScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ capture?: string }>();
  const [meals, reload] = useFocusData<Meal[]>(() => recentMeals(100), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hint, setHint] = useState('');
  const autoCaptured = useRef(false);

  async function capture(fromLibrary: boolean) {
    const photo = await pickPhoto(fromLibrary);
    if (!photo) return;
    setBusy('写真を分析中…');
    try {
      const analysis = await analyzeMealPhoto(photo.base64, photo.mediaType, hint || undefined);
      setDraft({ photo, analysis });
    } catch (e) {
      Alert.alert('分析に失敗しました', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (params.capture === '1' && !autoCaptured.current) {
      autoCaptured.current = true;
      router.setParams({ capture: undefined });
      void capture(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.capture]);

  async function save() {
    if (!draft) return;
    const a = draft.analysis;
    setBusy('保存中…');
    try {
      const ts = Date.now();
      const photoUri = await persistPhoto(draft.photo.uri);
      const id = await insertMeal({
        ts,
        photo_uri: photoUri,
        items: analysisToItems(a),
        kcal: a.total_kcal,
        protein_g: a.total_protein_g,
        fat_g: a.total_fat_g,
        carb_g: a.total_carb_g,
        comment: a.comment,
        suggestion: '',
      });
      setDraft(null);
      setHint('');
      reload();
      setBusy('次の食事を考え中…');
      const today = dateKey(ts);
      const [todayTotals, profile, exercises] = await Promise.all([
        totalsForDate(today),
        getProfile(),
        exercisesOnDate(today),
      ]);
      const suggestion = await suggestNextMeal({
        todayTotals,
        lastMeal: a,
        profile,
        now: new Date(ts),
        trainedToday: exercises.length > 0,
      });
      await updateMealSuggestion(id, suggestion);
      reload();
      router.push({ pathname: '/meal/[id]', params: { id: String(id) } });
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <View>
      <Card>
        <Label>食事を記録</Label>
        <Input
          placeholder="補足(任意): 例 ご飯は少なめ、ドレッシングなし"
          value={hint}
          onChangeText={setHint}
        />
        <Spacer h={8} />
        <Row>
          <View style={{ flex: 1 }}>
            <Button title="カメラで撮影" onPress={() => capture(false)} loading={busy !== null} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="写真から選ぶ" kind="secondary" onPress={() => capture(true)} disabled={busy !== null} />
          </View>
        </Row>
        {busy && (
          <Body muted style={{ marginTop: 8 }}>
            {busy}
          </Body>
        )}
      </Card>

      {draft && (
        <Card style={{ borderColor: t.tint, borderWidth: 1 }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Image source={{ uri: draft.photo.uri }} style={st.thumb} />
            <View style={{ flex: 1 }}>
              <Body bold>
                {r0(draft.analysis.total_kcal)} kcal ・ P {r0(draft.analysis.total_protein_g)} / F{' '}
                {r0(draft.analysis.total_fat_g)} / C {r0(draft.analysis.total_carb_g)}
              </Body>
              <Body muted>確信度: {{ low: '低', medium: '中', high: '高' }[draft.analysis.confidence]}</Body>
            </View>
          </Row>
          <Spacer h={8} />
          {draft.analysis.items.map((i, idx) => (
            <Row key={idx} style={{ justifyContent: 'space-between' }}>
              <Body>
                {i.name} <Body muted>{i.amount}</Body>
              </Body>
              <Body muted>{r0(i.kcal)} kcal</Body>
            </Row>
          ))}
          <Spacer h={4} />
          <Body muted>{draft.analysis.comment}</Body>
          <Spacer h={10} />
          <Row>
            <View style={{ flex: 1 }}>
              <Button title="保存して次の食事を提案" onPress={save} loading={busy !== null} />
            </View>
            <Button title="やり直す" kind="secondary" onPress={() => setDraft(null)} />
          </Row>
        </Card>
      )}
      <Label>履歴</Label>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={meals}
        keyExtractor={(m) => String(m.id)}
        ListHeaderComponent={header}
        contentContainerStyle={st.container}
        ListEmptyComponent={<Body muted>まだ記録がありません</Body>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/meal/[id]', params: { id: String(item.id) } })}>
            <Card>
              <Row style={{ alignItems: 'flex-start' }}>
                {item.photo_uri ? <Image source={{ uri: item.photo_uri }} style={st.thumbSm} /> : null}
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Body bold>{r0(item.kcal)} kcal</Body>
                    <Body muted>
                      {dateKey(item.ts).slice(5).replace('-', '/')} {hhmm(item.ts)}
                    </Body>
                  </Row>
                  <Body muted>{item.items.map((i) => i.name).join('、')}</Body>
                  <Body muted>
                    P {r0(item.protein_g)} / F {r0(item.fat_g)} / C {r0(item.carb_g)}
                  </Body>
                </View>
              </Row>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  thumb: { width: 84, height: 84, borderRadius: 10 },
  thumbSm: { width: 56, height: 56, borderRadius: 8 },
});
