// src/lib/exercises-default.ts
"use client";

import type { ExerciseItem } from "@/lib/types";

// UUID 生成（ブラウザ実行を想定）
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

function make(
  category: ExerciseItem["category"],
  name: string,
  order: number,
  inputMode: ExerciseItem["inputMode"] = "check",
  checkCount = 3
): ExerciseItem {
  return {
    id: uid(),
    name,
    category,
    inputMode,
    // 旧仕様互換：sets は「チェック数」と同じ意味で使う
    sets: inputMode === "check" ? checkCount : undefined,
    checkCount: inputMode === "check" ? checkCount : undefined,
    enabled: true,
    order,
  };
}

/**
 * 要件ファイルに基づく初期登録一覧
 * - 上半身
 *   1) フル懸垂 できる限り（回数入力）
 *   2) フル懸垂 5回×3セット
 *   3) ネガティブ懸垂 5回×3セット
 *   4) ダンベルベントロウ 15回×3セット
 *   5) ダンベルプルオーバー 10回×3セット
 *   6) ダンベルフライ 15回×3セット
 *   7) 腕立て伏せ 15回×3セット
 *
 * - 下半身
 *   1) バックランジ 20回×3セット
 *   2) ワイドスクワット 15回×3セット
 *
 * - その他：初期は空
 */
export const defaultExercises: ExerciseItem[] = [
  // 上半身
  make("upper", "フル懸垂 できる限り", 1, "count"),
  make("upper", "フル懸垂　5回×3セット", 2, "check", 3),
  make("upper", "ネガティブ懸垂　5回×3セット", 3, "check", 3),
  make("upper", "ダンベルベントロウ　15回×3セット", 4, "check", 3),
  make("upper", "ダンベルプルオーバー　10回×3セット", 5, "check", 3),
  make("upper", "ダンベルフライ　15回×3セット", 6, "check", 3),
  make("upper", "腕立て伏せ　15回×3セット", 7, "check", 3),

  // 下半身
  make("lower", "バックランジ　20回×3セット", 1, "check", 3),
  make("lower", "ワイドスクワット　15回×3セット", 2, "check", 3),

  // その他（初期なし）
];
