import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Body, Button, Card, Input, Label, Row, Screen, Spacer, useTheme } from '@/components/ui';
import { deleteSupplement, listSupplements, upsertSupplement, type Supplement } from '@/lib/db';
import { cancel, ensureNotificationPermission, scheduleDaily } from '@/lib/notifications';
import { getProfile } from '@/lib/settings';
import { buildDefaultPlan } from '@/lib/supplementPlan';
import { useFocusData } from '@/lib/useFocusData';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function SupplementsScreen() {
  const t = useTheme();
  const [items, reload] = useFocusData<Supplement[]>(listSupplements, []);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: number; time: string } | null>(null);

  async function schedule(s: Omit<Supplement, 'id'> & { id?: number }): Promise<void> {
    await cancel(s.notification_id);
    let notification_id: string | null = null;
    if (s.enabled) {
      const ok = await ensureNotificationPermission();
      if (ok) notification_id = await scheduleDaily(`${s.name} の時間です`, s.reason || '忘れずに摂りましょう', s.time);
      else if (!ok) Alert.alert('通知が許可されていません', '端末の設定から通知を許可してください');
    }
    await upsertSupplement({ ...s, notification_id });
  }

  async function generatePlan() {
    setBusy(true);
    try {
      const profile = await getProfile();
      const plan = buildDefaultPlan(profile);
      const existing = await listSupplements();
      for (const p of plan) {
        if (existing.some((e) => e.name === p.name)) continue;
        await schedule({ name: p.name, time: p.time, enabled: 1, notification_id: null, reason: p.reason });
      }
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function addCustom() {
    if (!name.trim() || !TIME_RE.test(time)) {
      Alert.alert('名前と時刻(例 07:30)を入力してください');
      return;
    }
    await schedule({ name: name.trim(), time, enabled: 1, notification_id: null, reason: '' });
    setName('');
    setTime('');
    reload();
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>おすすめスケジュール</Label>
          <Body muted>
            設定の起床・就寝・トレーニング時刻から、プロテイン(起床後・トレ後・就寝前)、クレアチン、マルチビタミンの時刻を提案し、毎日通知します。
          </Body>
          <Spacer h={8} />
          <Button title="提案を生成して通知をセット" onPress={generatePlan} loading={busy} />
        </Card>

        <Card>
          <Label>自分で追加</Label>
          <Row>
            <View style={{ flex: 2 }}>
              <Input placeholder="名前 (例 EAA)" value={name} onChangeText={setName} />
            </View>
            <View style={{ flex: 1 }}>
              <Input placeholder="07:30" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
            </View>
          </Row>
          <Spacer h={8} />
          <Button title="追加" kind="secondary" onPress={addCustom} />
        </Card>

        <Label>通知一覧</Label>
        {items.map((s) => (
          <Card key={s.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body bold>
                  {s.time}  {s.name}
                </Body>
                {s.reason ? <Body muted>{s.reason}</Body> : null}
              </View>
              <Switch
                value={!!s.enabled}
                onValueChange={async (v) => {
                  await schedule({ ...s, enabled: v ? 1 : 0 });
                  reload();
                }}
              />
            </Row>
            {editing?.id === s.id ? (
              <Row style={{ marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={editing.time}
                    onChangeText={(v) => setEditing({ id: s.id, time: v })}
                    placeholder="HH:MM"
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                  />
                </View>
                <Button
                  title="保存"
                  onPress={async () => {
                    if (!TIME_RE.test(editing.time)) {
                      Alert.alert('時刻は HH:MM 形式で入力してください');
                      return;
                    }
                    await schedule({ ...s, time: editing.time });
                    setEditing(null);
                    reload();
                  }}
                />
                <Button title="取消" kind="secondary" onPress={() => setEditing(null)} />
              </Row>
            ) : (
              <Row style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                <Body style={{ color: t.tint }} onPress={() => setEditing({ id: s.id, time: s.time })}>
                  時刻変更
                </Body>
                <Body
                  style={{ color: t.danger, marginLeft: 16 }}
                  onPress={async () => {
                    await cancel(s.notification_id);
                    await deleteSupplement(s.id);
                    reload();
                  }}>
                  削除
                </Body>
              </Row>
            )}
          </Card>
        ))}
        {!items.length && <Body muted>まだありません</Body>}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
});
