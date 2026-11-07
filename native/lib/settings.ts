import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getSetting, setSetting } from './db';

const API_KEY = 'anthropic_api_key';

export async function getApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') return getSetting(API_KEY);
  return SecureStore.getItemAsync(API_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  if (Platform.OS === 'web') return setSetting(API_KEY, key);
  if (key) await SecureStore.setItemAsync(API_KEY, key);
  else await SecureStore.deleteItemAsync(API_KEY);
}

export type Profile = {
  kcalTarget: number;
  proteinTarget: number;
  wakeTime: string; // HH:MM
  bedTime: string; // HH:MM
  usualWorkoutTime: string; // HH:MM
  goal: 'cut' | 'bulk' | 'maintain';
};

const DEFAULT_PROFILE: Profile = {
  kcalTarget: 2200,
  proteinTarget: 140,
  wakeTime: '07:00',
  bedTime: '23:30',
  usualWorkoutTime: '19:00',
  goal: 'bulk',
};

export async function getProfile(): Promise<Profile> {
  const raw = await getSetting('profile');
  if (!raw) return DEFAULT_PROFILE;
  try {
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(p: Profile): Promise<void> {
  await setSetting('profile', JSON.stringify(p));
}
