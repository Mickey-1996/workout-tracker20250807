// src/lib/types.ts
// 既存コード（exercises-default.ts 等）の legacy フィールドにも対応する後方互換版

// 入力方式：チェック式（セット完了のチェック） or 回数入力（セットごとの回数）
export type InputMode = "check" | "count";

// 種目カテゴリ
export type Category = "upper" | "lower" | "other";

// 1つの種目の定義
export type ExerciseItem = {
  id: string;            // 一意なID
  name: string;          // 表示名
  category: Category;    // カテゴリ
  order: number;         // 並び順（小さいほど上）
  enabled?: boolean;     // 使用可否（未指定なら true 相当で扱う実装が多い）

  // ---- 現行フィールド（推奨） ----
  mode?: InputMode;      // 入力方式：check / count（現行）
  setCount?: number;     // セット数（チェック式/回数式どちらでも使用）
  repTarget?: number;    // 回数式のノルマ（UIの薄いプレースホルダ表示など）

  // ---- 後方互換フィールド（legacy）----
  // 既存の exercises-default.ts などが参照している可能性があるため許容しておく
  inputMode?: InputMode; // = mode の旧名称
  checkCount?: number;   // = setCount の旧名称
};

// 種目一覧＋並び順などの設定全体
export type ExercisesState = {
  items: ExerciseItem[]; // 種目配列
  order: string[];       // 並び順（id の配列）
};

// 1日分の記録
export type DayRecord = {
  // 種目IDごとの実績
  // チェック式：各セットの完了
  sets?:   Record<string, boolean[]>;
  // 回数式：各セットの回数
  counts?: Record<string, number[]>;
  // 完了時刻（ISO文字列）。チェック/回数いずれの記録でも保存可
  times?:  Record<string, string[]>;

  // メモ欄は未入力（undefined）も許容：型エラー回避と既存データ互換のため
  notesUpper?: string;
  notesLower?: string;
  notesOther?: string;
};

// 直近完了時刻のマップ（必要に応じて使用）
export type LastDoneMap = Record<string, string>; // 種目ID -> 直近ISO時刻
export type LastPrevMap = Record<string, string>; // 種目ID -> 直近の一つ前のISO時刻

