// 種別
export type Category = "upper" | "lower" | "other";
export type InputMode = "check" | "count";

// 設定（種目）項目
export type ExerciseItem = {
  id: string;
  name: string;
  category: Category;

  // 後方互換のため任意プロパティ
  inputMode?: InputMode;   // "check" | "count"
  sets?: number;           // セット数（UI 表示用）
  checkCount?: number;     // 旧プロパティ名との互換
  repTarget?: number;      // 回数入力モード時のノルマ回数（1..99）
  enabled?: boolean;       // 記録対象フラグ
  order?: number;          // 同カテゴリ内の並び順（1始まり）
};

// 設定集合
export type ExercisesState = {
  items: ExerciseItem[];
};

// 1日分の記録データ
export type DayRecord = {
  // メモ（任意）
  notesUpper?: string;
  notesLower?: string;
  notesOther?: string;

  // チェック式の達成状況: 種目ID -> [set0, set1, ...]
  sets?: Record<string, boolean[]>;

  // 回数入力式の値: 種目ID -> [rep0, rep1, ...]
  counts?: Record<string, number[]>;

  // 各セット/回数の記録時刻（ISO 文字列）: 種目ID -> ["2025-08-07T10:15:00+09:00", ...]
  // 「前回からのインターバル」算出に使用
  times?: Record<string, string[]>;
};


