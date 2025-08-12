// src/lib/types.ts

// 入力方式（SettingsTab で使用）
export type InputMode = "check" | "count";

// 種目1件（SettingsTab / exercises-default で使用）
export type ExerciseItem = {
  id: string;
  name: string;
  // ← 実装が期待しているカテゴリ名（英語3種）
  category: "upper" | "lower" | "other";
  // オプション（実装側で存在チェックしているので optional）
  sets?: number;
  inputMode?: InputMode;
  checkCount?: number;
  enabled?: boolean;
  order: number;
};

// 参考：RecordTab で日付ごとの記録を保持するための型
// （local-storage / RecordTab は現在ローカル型で動かしているため必須ではありませんが、将来の統一用に残します）
export type DayRecord = {
  date: string;                // YYYY-MM-DD
  notesUpper: string;
  notesLower: string;
  // 種目ID => セットごとの完了フラグ
  sets: Record<string, boolean[]>;
};

// 参考：RecordTab の表示用に組み立てる種目一覧（カテゴリ日本語名 => 配列）
// こちらも将来の統一用。現在は各ファイル内のローカル型で問題ありません。
export type ExercisesState = Record<
  string,
  { id: string; name: string; sets: number }[]
>;
