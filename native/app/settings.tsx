import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Card, Input, Label, Row, Screen, Spacer, useTheme } from '@/components/ui';
import { getApiKey, getProfile, saveProfile, setApiKey, type Profile } from '@/lib/settings';

export default function SettingsScreen() {
  const t = useTheme();
  const [apiKey, setKey] = useState('');
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => {
    void (async () => {
      setKey((await getApiKey()) ?? '');
      setP(await getProfile());
    })();
  }, []);

  if (!p) return <Screen />;

  async function save() {
    if (!p) return;
    await setApiKey(apiKey.trim());
    await saveProfile(p);
    Alert.alert('保存しました');
    router.back();
  }

  const num = (k: 'kcalTarget' | 'proteinTarget') => ({
    value: String(p[k]),
    onChangeText: (v: string) => setP({ ...p, [k]: Number(v) || 0 }),
    keyboardType: 'number-pad' as const,
  });
  const time = (k: 'wakeTime' | 'bedTime' | 'usualWorkoutTime') => ({
    value: p[k],
    onChangeText: (v: string) => setP({ ...p, [k]: v }),
    placeholder: 'HH:MM',
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>Anthropic API キー</Label>
          <Input value={apiKey} onChangeText={setKey} placeholder="sk-ant-..." secureTextEntry autoCapitalize="none" />
          <Body muted style={{ marginTop: 6 }}>
            写真の解析と食事提案に使います。端末内(SecureStore)にのみ保存されます。
          </Body>
        </Card>

        <Card>
          <Label>目標</Label>
          <Row>
            {(['cut', 'maintain', 'bulk'] as const).map((g) => (
              <Pressable
                key={g}
                onPress={() => setP({ ...p, goal: g })}
                style={[st.chip, { backgroundColor: p.goal === g ? t.tint : t.background, borderColor: t.border }]}>
                <Body style={{ color: p.goal === g ? '#fff' : t.text }}>{{ cut: '減量', maintain: '維持', bulk: '増量' }[g]}</Body>
              </Pressable>
            ))}
          </Row>
          <Spacer h={10} />
          <Row>
            <View style={{ flex: 1 }}>
              <Label>1日の kcal</Label>
              <Input {...num('kcalTarget')} />
            </View>
            <View style={{ flex: 1 }}>
              <Label>たんぱく質 g</Label>
              <Input {...num('proteinTarget')} />
            </View>
          </Row>
        </Card>

        <Card>
          <Label>生活リズム (サプリ通知の計算に使用)</Label>
          <Row>
            <View style={{ flex: 1 }}>
              <Label>起床</Label>
              <Input {...time('wakeTime')} />
            </View>
            <View style={{ flex: 1 }}>
              <Label>トレ開始</Label>
              <Input {...time('usualWorkoutTime')} />
            </View>
            <View style={{ flex: 1 }}>
              <Label>就寝</Label>
              <Input {...time('bedTime')} />
            </View>
          </Row>
        </Card>

        <Button title="保存" onPress={save} />
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
});
