import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Re-runs `load` every time the screen gains focus. */
export function useFocusData<T>(load: () => Promise<T>, initial: T): [T, () => void, boolean] {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      load()
        .then((d) => alive && setData(d))
        .catch((e) => console.warn(e))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tick])
  );
  return [data, () => setTick((t) => t + 1), loading];
}
