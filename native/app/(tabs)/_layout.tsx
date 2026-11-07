import { SymbolView } from 'expo-symbols';
import { Link, Tabs } from 'expo-router';
import { ColorValue, Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

type IconName = { ios: string; android: string; web: string };

function icon(name: IconName) {
  const TabIcon = ({ color }: { color: ColorValue }) => (
    <SymbolView name={name as never} tintColor={color as string} size={26} />
  );
  TabIcon.displayName = 'TabIcon';
  return TabIcon;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const c = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.tint,
        headerShown: useClientOnlyValue(false, true),
        headerRight: () => (
          <Link href="/settings" asChild>
            <Pressable style={{ marginRight: 15 }}>
              {({ pressed }) => (
                <SymbolView
                  name={{ ios: 'gearshape', android: 'settings', web: 'settings' } as never}
                  size={24}
                  tintColor={c.text}
                  style={{ opacity: pressed ? 0.5 : 1 }}
                />
              )}
            </Pressable>
          </Link>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: '今日', tabBarIcon: icon({ ios: 'house', android: 'home', web: 'home' }) }}
      />
      <Tabs.Screen
        name="meals"
        options={{ title: '食事', tabBarIcon: icon({ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }) }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: '筋トレ',
          tabBarIcon: icon({ ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' }),
        }}
      />
      <Tabs.Screen
        name="weight"
        options={{ title: '体重', tabBarIcon: icon({ ios: 'scalemass', android: 'monitor_weight', web: 'monitor_weight' }) }}
      />
      <Tabs.Screen
        name="supplements"
        options={{ title: 'サプリ', tabBarIcon: icon({ ios: 'pills', android: 'medication', web: 'medication' }) }}
      />
    </Tabs>
  );
}
