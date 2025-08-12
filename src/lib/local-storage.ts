// src/lib/local-storage.ts
"use client";

// --- ローカル型定義（暫定） ---
// 将来、プロジェクトの型に合わせて import に戻してOK:
// import type { DayRecord, ExercisesState, ExerciseItem } from "@/lib/types";

type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  // 種目ID => セットごとの完了チェック
  sets: Record<string, boolean[]>;
};

type ExercisesState = Record<
  // 表示用カテゴリ名（例：「上半身」「下半身」「その他」）
  string,
  { id: string; name: string; sets: number }[]
>;

type ExerciseItem = {
  id: string;
  name: string;
  category: "upper" | "lower" | "other";
  sets?: number;
  inputMode?: "check" | "count";
  checkCount?: number;
  enabled?: boolean;
  order: number;
};
// --- ここまで暫定型 ---

const KEYS = {
  EXERCISES: "exercises",
  DAY_RECORD_PREFIX: "day-record-", // 例: day-record-2025-08-12
  SETTINGS: "settings-v1",
} as const;

// 安全な LS アクセス
function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSetItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // noop
  }
}

// JSONユーティリティ（SettingsTab 用）
export function loadJSON<T = unknown>(key: string): T | null {
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
export function saveJSON(key: string, data: unknown): void {
  safeSetItem(key, JSON.stringify(data));
}

// Settings から ExercisesState を合成
function composeExercisesFromSettings(): ExercisesState | null {
  const settings = loadJSON<{ items?: ExerciseItem[] }>(KEYS.SETTINGS);
  const items = settings?.items ?? [];
  if (!items.length) return null;

  const byCat: ExercisesState = {
    上半身: [],
    下半身: [],
    その他: [],
  };

  const mapCat = (c: ExerciseItem["category"]) =>
    c === "upper" ? "上半身" : c === "lower" ? "下半身" : "その他";

  for (const it of items) {
    if (!it.enabled) continue;
    const cat = mapCat(it.category);
    byCat[cat].push({
      id: it.id,
      name: it.name || "（名称未設定）",
      // 入力方式がチェックのときは checkCount を優先、無ければ sets を fallback
      sets: it.checkCount ?? it.sets ?? 3,
    });
  }

  const hasAny =
    byCat["上半身"].length + byCat["下半身"].length + byCat["その他"].length > 0;
  return hasAny ? byCat : null;
}

// Exercises 読み込み・保存（RecordTab 用）
export function loadExercises(): ExercisesState | null {
  // 1) Settings 優先
  const fromSettings = composeExercisesFromSettings();
  if (fromSettings) return fromSettings;

  // 2) 旧キー互換
  const raw = safeGetItem(KEYS.EXERCISES);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExercisesState;
  } catch {
    return null;
  }
}
export function saveExercises(state: ExercisesState): void {
  // 旧実装互換：必要なら残す
  safeSetItem(KEYS.EXERCISES, JSON.stringify(state));
}

// DayRecord（記録）
export function loadDayRecord(dateISO: string): DayRecord | null {
  const key = `${KEYS.DAY_RECORD_PREFIX}${dateISO}`;
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DayRecord;
  } catch {
    return null;
  }
}
export function saveDayRecord(dateISO: string, record: DayRecord): void {
  const key = `${KEYS.DAY_RECORD_PREFIX}${dateISO}`;
  safeSetItem(key, JSON.stringify(record));
}
