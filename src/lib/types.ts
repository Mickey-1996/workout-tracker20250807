// src/lib/types.ts
// 差し替え用：型の不整合を解消し、既存データとの互換性を高めた定義

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
  enabled?: boolean;     // 使用可否（未指定ならtrue相当として扱う実装が多い）
  mode: InputMode;       // 入力方式：check / count
  setCount?: number;     // セット数（チェック式/回数式どちらでも使用）
  repTarget?: number;    // 回数式のノルマ（UIの薄いプレースホルダ表示などに使用）
};

// 種目一覧＋並び順などの設定全体
export type ExercisesState = {
  items: ExerciseItem[]; // 種目配列
  order: string[];       // 並び順（idの配列）
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

  // メモ欄は未入力（undefined）も許容することで型エラーを回避し、既存データとも互換に
  notesUpper?: string;
  notesLower?: string;
  notesOther?: string;
};

// （必要に応じて使用）直近完了時刻のマップ
export type LastDoneMap = Record<string, string>; // 種目ID -> 直近ISO時刻
export type LastPrevMap = Record<string, string>; // 種目ID -> 直近の一つ前のISO時刻
