// src/lib/local-storage.ts
"use client";

import type { DayRecord, ExercisesState, ExerciseItem } from "@/lib/types";

const KEYS = {
  EXERCISES: "exercises",
  DAY_RECORD_PREFIX: "day-record-",      // 例: day-record-2025-08-12
  SETTINGS: "settings-v1",               // SettingsTab が使うキー
} as const;

// ---- 安全なLSアクセス -------------------------------------------------------
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
    // 失敗しても落とさない
  }
}

// ---- JSONユーティリティ（SettingsTab 用） -----------------------------------
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

// ---- Exercises 読み書き（RecordTab 用） -------------------------------------
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
      sets: it.checkCount ?? it.sets ?? 3, // checkCount優先
    });
  }

  // どれか1カテゴリでも項目があれば返す
  const hasAny =
    byCat["上半身"].length + byCat["下半身"].length + byCat["その他"].length > 0;
  return hasAny ? byCat : null;
}

export function loadExercises(): ExercisesState | null {
  // 1) Settings優先
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
  // 旧実装互換（Settings管理が主体になったら未使用でもOK）
  safeSetItem(KEYS.EXERCISES, JSON.stringify(state));
}

// ---- DayRecord（記録） -------------------------------------------------------
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
