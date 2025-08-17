// src/lib/types.ts
// アプリ全体で使う型定義（v2=items配列 互換）
// - 旧実装が持っていたフィールド（inputMode / checkCount / sets など）も optional で吸収
// - カテゴリは "upper" | "lower" | "etc"（互換のため "other" も許容）

/** 入力方式：チェック式（セットの完了チェック） or 回数入力 */
export type InputMode = "check" | "count";

/** 種目カテゴリ（互換のため "other" も許容） */
export type Category = "upper" | "lower" | "etc" | "other";

/** 1つの種目の定義（後方互換フィールドを optional で保持） */
export type ExerciseItem = {
  /** 一意なID（例: "pushup"） */
  id: string;
  /** 表示名（例: "腕立て伏せ"） */
  name: string;
  /** カテゴリ */
  category: Category;

  /** 並び順（小さいほど上） */
  order?: number;
  /** 有効/無効（未指定は true 扱いのUIが多い） */
  enabled?: boolean;

  /** 入力方式（正式） */
  mode?: InputMode;
  /** 入力方式（互換：旧実装で inputMode を使っていたケース） */
  inputMode?: InputMode;

  /** チェック式の表示セット数（1..5 想定）。旧実装では sets を参照していた */
  sets?: number;
  /** 互換：旧表現（チェック数＝sets と同義で扱う想定） */
  checkCount?: number;

  /** 回数入力モード時の目標回数 */
  repTarget?: number;
};

/** v2 設定スキーマ：Settings で保存/読込する形（items + order） */
export type ExercisesState = {
  /** 種目の配列（カテゴリや入力方式などを含む） */
  items: ExerciseItem[];
  /** 表示順用のID配列（items の id を並べたもの） */
  order: string[];
};

/** （参考）旧スキーマ互換：カテゴリごとの配列。必要なら import して使う */
export type ExercisesByCategory = {
  upper: ExerciseItem[];
  lower: ExerciseItem[];
  etc: ExerciseItem[];
  /** 互換：other を使うデータが来た場合の受け皿（任意） */
  other?: ExerciseItem[];
};

/** 1日分の記録（UI がローカルストレージに保存する想定・互換用） */
export type DayRecord = {
  /** "YYYY-MM-DD" */
  date: string;
  /** 完了時刻（ISO文字列）: チェック/回数いずれの記録でも push 可 */
  times?: Record<string, string[]>;
  /** チェック式の保存（種目ID -> セットごとの true/false 配列） */
  sets?: Record<string, boolean[]>;
  /** 回数入力の保存（種目ID -> セットごとの回数配列） */
  counts?: Record<string, number[]>;
  /** メモ（カテゴリ別） */
  notesUpper?: string;
  notesLower?: string;
  notesEtc?: string;
  notesOther?: string;
};

/** 直近完了時刻のマップ（必要に応じて利用） */
export type LastDoneMap = Record<string, string>; // 種目ID -> 直近ISO時刻
export type LastPrevMap = Record<string, string>; // 種目ID -> 直近の一つ前のISO時刻
