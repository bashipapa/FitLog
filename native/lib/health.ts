import { Platform } from 'react-native';
import { insertWeight, weightExistsNear } from './db';

/**
 * Pulls body-mass samples from Apple Health (where the EufyLife app writes
 * each weigh-in) and stores the ones we have not seen yet.
 * iOS only; requires a development build (not Expo Go).
 */
export async function importWeightsFromHealthKit(days = 90): Promise<{ imported: number; error?: string }> {
  if (Platform.OS !== 'ios') return { imported: 0, error: 'Apple HealthはiOSのみ対応です' };
  const AppleHealthKit = (await import('react-native-health')).default;

  const perms = {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.Weight, AppleHealthKit.Constants.Permissions.BodyFatPercentage],
      write: [] as never[],
    },
  };

  await new Promise<void>((resolve, reject) =>
    AppleHealthKit.initHealthKit(perms, (err) => (err ? reject(new Error(String(err))) : resolve()))
  );

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const samples = await new Promise<{ value: number; startDate: string }[]>((resolve, reject) =>
    AppleHealthKit.getWeightSamples(
      { startDate, unit: AppleHealthKit.Constants.Units.gram, ascending: true },
      (err, results) => (err ? reject(new Error(String(err))) : resolve(results))
    )
  );
  const fat = await new Promise<{ value: number; startDate: string }[]>((resolve) =>
    AppleHealthKit.getBodyFatPercentageSamples(
      { startDate, ascending: true },
      (err, results) => (err ? resolve([]) : resolve(results))
    )
  );

  let imported = 0;
  for (const s of samples) {
    const ts = new Date(s.startDate).getTime();
    const kg = s.value / 1000;
    if (await weightExistsNear(ts, kg)) continue;
    const f = fat.find((x) => Math.abs(new Date(x.startDate).getTime() - ts) < 5 * 60 * 1000);
    await insertWeight({ ts, weight_kg: kg, body_fat_pct: f ? f.value * 100 : null, source: 'healthkit' });
    imported += 1;
  }
  return { imported };
}
