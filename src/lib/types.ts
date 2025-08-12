// src/lib/types.ts

// SettingsTab / exercises-default が前提にしているカテゴリ
export type Category = "upper" | "lower" | "other";

// 入力方式（SettingsTab で使用）
export type InputMode = "check" | "count";

// 種目アイテム（SettingsTab / exercises-default で使用）
export interface ExerciseItem {
  id: string;
  name: string;
  category: Category;     // ← ここが必須
  // 以下はコード上 optional として扱われているため optional に
  sets?: number;
  inputMode?: InputMode;
  checkCount?: number;
  enabled?: boolean;
  order: number;
}

// 日付ごとの記録（RecordTab / local-storage が想定していた構造）
export interface DayRecord {
  date: string; // YYYY-MM-DD
  notesUpper: string;
  notesLower: string;
  // 種目ID => セットごとの完了フラグ
  sets: Record<string, boolean[]>;
}

// 表示用の種目一覧（カテゴリ日本語名 => 配列）
// 現状 RecordTab はローカル型で動作中だが、将来統一のため定義
export type ExercisesState = Record<
  string,
  { id: string; name: string; sets: number }[]
>;
