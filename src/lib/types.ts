// src/lib/types.ts
export type Category = "upper" | "lower" | "other";
export type InputMode = "check" | "count";

export interface ExerciseItem {
  id: string;
  name: string;
  category: Category;
  sets: number;          // 初期は3
  inputMode: InputMode;  // "check" or "count"
  checkCount: number;    // チェック数(1-10)
  enabled: boolean;      // 記録対象か
  order: number;         // 同カテゴリ内の並び順
}

// 既存コードに Exercise がある場合の互換
export type Exercise = ExerciseItem;
