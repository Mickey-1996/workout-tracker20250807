export type Category = "upper" | "lower" | "other";

export type InputMode = "checkbox" | "reps";

export interface Exercise {
  id: string;                 // uuid-like
  name: string;               // 表示名（回数を含める運用でもOK）
  category: Category;
  inputMode: InputMode;       // "checkbox" | "reps"
  checkboxCount: number;      // 1..10（初期3）
  active: boolean;            // 今は常にtrueでもOK
}

export interface ExercisesState {
  version: 1;
  items: Exercise[];
}

export interface RecordByExercise {
  // checkbox型：配列のtrue数がセット数
  checks?: boolean[];
  // reps型：入力があれば1セット完了扱い、数値はメモ用途
  reps?: number | null;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  byExercise: Record<string, RecordByExercise>;
  notes: { upper: string; lower: string; other: string };
}
