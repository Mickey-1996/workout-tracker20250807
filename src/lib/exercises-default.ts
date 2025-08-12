// src/lib/exercises-default.ts
import type { ExerciseItem } from "./types";

function make(
  category: ExerciseItem["category"],
  name: string,
  order: number
): ExerciseItem {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    sets: 3,          // 初期3セット
    inputMode: "check",
    checkCount: 3,    // 初期3チェック
    enabled: true,
    order,
  };
}

export const defaultExercises: ExerciseItem[] = [
  // 上半身
  make("upper", "フル懸垂 できる限り", 1),
  make("upper", "フル懸垂 5回×3セット", 2),
  make("upper", "ネガティブ懸垂 5回×3セット", 3),
  make("upper", "ダンベルベントロウ 15回×3セット", 4),
  make("upper", "ダンベルプルオーバー 10回×3セット", 5),
  make("upper", "ダンベルフライ 15回×3セット", 6),
  make("upper", "腕立て伏せ 15回×3セット", 7),

  // 下半身
  make("lower", "バックランジ 20回×3セット", 1),
  make("lower", "ワイドスクワット 15回×3セット", 2),

  // その他（初期は空でもOKだがダミー1件）
  // 使わないなら削除してもOK
  // make("other", "（未定）", 1),
];
