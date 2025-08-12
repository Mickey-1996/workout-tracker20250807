// src/lib/types.ts

/** カテゴリ（上半身・下半身・その他） */
export type Category = "upper" | "lower" | "other";

/** 入力方式：チェック（セット完了） or 回数入力 */
export type InputMode = "check" | "count";

/**
 * 設定で扱う種目
 * - sets: 旧プロパティ（互換のため残す）
 * - checkCount: 新プロパティ（セット数）
 * - repTarget: 回数入力時のノルマ回数
 */
export type ExerciseItem = {
  id: string;
  name: string;
  category: Category;
  enabled?: boolean; // 省略時は有効とみなす
  order?: number;    // 並び順（小さいほど上）

  // 入力方式とセット数（どちらかが入っていればOK）
  inputMode?: InputMode;
  checkCount?: number; // 新：セット数
  sets?: number;       // 旧：セット数（互換用）

  // 回数入力モード時のノルマ
  repTarget?: number;
};

/** 設定全体 */
export type Settings = {
  items: ExerciseItem[];
};

/**
 * 表示用の “カテゴリ→種目配列” 構造
 * 例：
 * {
 *   upper: [{ id, name, sets }, ...],
 *   lower: [...],
 *   other: [...]
 * }
 */
export type ExercisesState = Record<
  string,
  { id: string; name: string; sets: number }[]
>;

/**
 * 1日分の記録データ
 * - notesUpper / notesLower は必須 string（空文字で保持）
 * - sets: チェック入力の完了フラグ（種目ID → boolean[]）
 * - counts: 回数入力の記録（種目ID → 各セットの回数[]）
 *   ※将来の互換のため number 単体を許さず、常に配列で保持
 */
export type DayRecord = {
  date: string;

  // メモ（必須 string に統一）
  notesUpper: string;
  notesLower: string;

  // 入力データ
  sets: Record<string, boolean[]>;    // チェック方式
  counts?: Record<string, number[]>;  // 回数方式（任意）

  // 任意の追加メモ（必要なら使う）
  notesOther?: string;
};
