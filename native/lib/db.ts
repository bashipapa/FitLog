import * as SQLite from 'expo-sqlite';

export type MealItem = {
  name: string;
  amount: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
};

export type Meal = {
  id: number;
  ts: number; // epoch ms
  photo_uri: string | null;
  items: MealItem[];
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  comment: string;
  suggestion: string;
};

export type WorkoutSet = {
  id: number;
  ts: number;
  session_date: string; // YYYY-MM-DD
  exercise: string;
  weight_kg: number;
  reps: number;
  set_index: number;
};

export type WeightEntry = {
  id: number;
  ts: number;
  weight_kg: number;
  body_fat_pct: number | null;
  source: 'manual' | 'photo' | 'healthkit';
};

export type Supplement = {
  id: number;
  name: string;
  time: string; // HH:MM
  enabled: number; // 0/1
  notification_id: string | null;
  reason: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('fitlog.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS meals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          photo_uri TEXT,
          items_json TEXT NOT NULL,
          kcal REAL NOT NULL,
          protein_g REAL NOT NULL,
          fat_g REAL NOT NULL,
          carb_g REAL NOT NULL,
          comment TEXT NOT NULL DEFAULT '',
          suggestion TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS workout_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          session_date TEXT NOT NULL,
          exercise TEXT NOT NULL,
          weight_kg REAL NOT NULL,
          reps INTEGER NOT NULL,
          set_index INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise, session_date);
        CREATE TABLE IF NOT EXISTS weights (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          weight_kg REAL NOT NULL,
          body_fat_pct REAL,
          source TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS supplements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          time TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          notification_id TEXT,
          reason TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export function dateKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayRange(date: string): [number, number] {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  return [start, start + 24 * 60 * 60 * 1000];
}

// ---------- settings ----------
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

// ---------- meals ----------
type MealRow = Omit<Meal, 'items'> & { items_json: string };

function rowToMeal(r: MealRow): Meal {
  const { items_json, ...rest } = r;
  return { ...rest, items: JSON.parse(items_json) as MealItem[] };
}

export async function insertMeal(m: Omit<Meal, 'id'>): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO meals(ts, photo_uri, items_json, kcal, protein_g, fat_g, carb_g, comment, suggestion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    m.ts,
    m.photo_uri,
    JSON.stringify(m.items),
    m.kcal,
    m.protein_g,
    m.fat_g,
    m.carb_g,
    m.comment,
    m.suggestion
  );
  return res.lastInsertRowId;
}

export async function updateMealSuggestion(id: number, suggestion: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE meals SET suggestion = ? WHERE id = ?', suggestion, id);
}

export async function deleteMeal(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meals WHERE id = ?', id);
}

export async function mealsForDate(date: string): Promise<Meal[]> {
  const db = await getDb();
  const [s, e] = dayRange(date);
  const rows = await db.getAllAsync<MealRow>(
    'SELECT * FROM meals WHERE ts >= ? AND ts < ? ORDER BY ts ASC',
    s,
    e
  );
  return rows.map(rowToMeal);
}

export async function recentMeals(limit = 50): Promise<Meal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MealRow>('SELECT * FROM meals ORDER BY ts DESC LIMIT ?', limit);
  return rows.map(rowToMeal);
}

export type DayTotals = { kcal: number; protein_g: number; fat_g: number; carb_g: number; count: number };

export async function totalsForDate(date: string): Promise<DayTotals> {
  const db = await getDb();
  const [s, e] = dayRange(date);
  const row = await db.getFirstAsync<DayTotals>(
    `SELECT COALESCE(SUM(kcal),0) AS kcal, COALESCE(SUM(protein_g),0) AS protein_g,
            COALESCE(SUM(fat_g),0) AS fat_g, COALESCE(SUM(carb_g),0) AS carb_g, COUNT(*) AS count
     FROM meals WHERE ts >= ? AND ts < ?`,
    s,
    e
  );
  return row ?? { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, count: 0 };
}

// ---------- workouts ----------
export async function insertSet(s: Omit<WorkoutSet, 'id'>): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO workout_sets(ts, session_date, exercise, weight_kg, reps, set_index) VALUES (?, ?, ?, ?, ?, ?)`,
    s.ts,
    s.session_date,
    s.exercise,
    s.weight_kg,
    s.reps,
    s.set_index
  );
  return res.lastInsertRowId;
}

export async function deleteSet(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', id);
}

export async function setsForSession(exercise: string, date: string): Promise<WorkoutSet[]> {
  const db = await getDb();
  return db.getAllAsync<WorkoutSet>(
    'SELECT * FROM workout_sets WHERE exercise = ? AND session_date = ? ORDER BY set_index ASC',
    exercise,
    date
  );
}

/** The most recent session date for an exercise strictly before `date`. */
export async function previousSessionDate(exercise: string, date: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ session_date: string }>(
    'SELECT session_date FROM workout_sets WHERE exercise = ? AND session_date < ? ORDER BY session_date DESC LIMIT 1',
    exercise,
    date
  );
  return row?.session_date ?? null;
}

export async function knownExercises(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ exercise: string }>(
    'SELECT exercise FROM workout_sets GROUP BY exercise ORDER BY MAX(ts) DESC'
  );
  return rows.map((r) => r.exercise);
}

export type SessionSummary = {
  session_date: string;
  sets: number;
  volume: number; // sum(weight*reps)
  max_weight: number;
  best_e1rm: number;
};

/** Per-session history for one exercise, newest first. */
export async function exerciseHistory(exercise: string, limit = 12): Promise<SessionSummary[]> {
  const db = await getDb();
  return db.getAllAsync<SessionSummary>(
    `SELECT session_date, COUNT(*) AS sets, SUM(weight_kg * reps) AS volume, MAX(weight_kg) AS max_weight,
            MAX(weight_kg * (1 + reps / 30.0)) AS best_e1rm
     FROM workout_sets WHERE exercise = ? GROUP BY session_date ORDER BY session_date DESC LIMIT ?`,
    exercise,
    limit
  );
}

export async function exercisesOnDate(date: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ exercise: string }>(
    'SELECT exercise FROM workout_sets WHERE session_date = ? GROUP BY exercise ORDER BY MIN(ts)',
    date
  );
  return rows.map((r) => r.exercise);
}

export async function lastWorkoutTs(): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ ts: number }>('SELECT MAX(ts) AS ts FROM workout_sets');
  return row?.ts ?? null;
}

// ---------- weights ----------
export async function insertWeight(w: Omit<WeightEntry, 'id'>): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO weights(ts, weight_kg, body_fat_pct, source) VALUES (?, ?, ?, ?)',
    w.ts,
    w.weight_kg,
    w.body_fat_pct,
    w.source
  );
  return res.lastInsertRowId;
}

export async function deleteWeight(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM weights WHERE id = ?', id);
}

export async function weightExistsNear(ts: number, weight_kg: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM weights WHERE ABS(ts - ?) < 60000 AND ABS(weight_kg - ?) < 0.05',
    ts,
    weight_kg
  );
  return (row?.c ?? 0) > 0;
}

export async function recentWeights(limit = 60): Promise<WeightEntry[]> {
  const db = await getDb();
  return db.getAllAsync<WeightEntry>('SELECT * FROM weights ORDER BY ts DESC LIMIT ?', limit);
}

// ---------- supplements ----------
export async function listSupplements(): Promise<Supplement[]> {
  const db = await getDb();
  return db.getAllAsync<Supplement>('SELECT * FROM supplements ORDER BY time ASC');
}

export async function upsertSupplement(s: Omit<Supplement, 'id'> & { id?: number }): Promise<number> {
  const db = await getDb();
  if (s.id) {
    await db.runAsync(
      'UPDATE supplements SET name = ?, time = ?, enabled = ?, notification_id = ?, reason = ? WHERE id = ?',
      s.name,
      s.time,
      s.enabled,
      s.notification_id,
      s.reason,
      s.id
    );
    return s.id;
  }
  const res = await db.runAsync(
    'INSERT INTO supplements(name, time, enabled, notification_id, reason) VALUES (?, ?, ?, ?, ?)',
    s.name,
    s.time,
    s.enabled,
    s.notification_id,
    s.reason
  );
  return res.lastInsertRowId;
}

export async function deleteSupplement(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM supplements WHERE id = ?', id);
}
