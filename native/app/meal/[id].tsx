import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Card, Label, Row, Screen, Spacer } from '@/components/ui';
import { dateKey, deleteMeal, getDb, type Meal, type MealItem } from '@/lib/db';
import { hhmm, r0 } from '@/lib/format';
import { useFocusData } from '@/lib/useFocusData';

async function loadMeal(id: number): Promise<Meal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Omit<Meal, 'items'> & { items_json: string }>('SELECT * FROM meals WHERE id = ?', id);
  if (!row) return null;
  const { items_json, ...rest } = row;
  return { ...rest, items: JSON.parse(items_json) as MealItem[] };
}

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meal] = useFocusData<Meal | null>(() => loadMeal(Number(id)), null);
  if (!meal) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={st.container}>
        {meal.photo_uri ? <Image source={{ uri: meal.photo_uri }} style={st.photo} /> : null}
        <Card>
          <Label>
            {dateKey(meal.ts)} {hhmm(meal.ts)}
          </Label>
          <Body bold>
            {r0(meal.kcal)} kcal ・ P {r0(meal.protein_g)}g / F {r0(meal.fat_g)}g / C {r0(meal.carb_g)}g
          </Body>
          <Spacer h={8} />
          {meal.items.map((i, idx) => (
            <Row key={idx} style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body>{i.name}</Body>
                <Body muted>{i.amount}</Body>
              </View>
              <Body muted>
                {r0(i.kcal)} kcal ・ P{r0(i.protein_g)} F{r0(i.fat_g)} C{r0(i.carb_g)}
              </Body>
            </Row>
          ))}
          {meal.comment ? (
            <>
              <Spacer h={8} />
              <Body muted>{meal.comment}</Body>
            </>
          ) : null}
        </Card>
        <Card>
          <Label>次の食事の提案</Label>
          <Body>{meal.suggestion || '生成中、または未生成です'}</Body>
        </Card>
        <Button
          title="この記録を削除"
          kind="danger"
          onPress={() =>
            Alert.alert('削除しますか?', '', [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: '削除',
                style: 'destructive',
                onPress: async () => {
                  await deleteMeal(meal.id);
                  router.back();
                },
              },
            ])
          }
        />
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, marginBottom: 12 },
});
