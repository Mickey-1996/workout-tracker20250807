import { ExercisesState } from "./types";

export const DEFAULT_EXERCISES: ExercisesState = {
  version: 1,
  items: [
    // 上半身（初期は全部checkbox 3個）
    { id: "u-1", name: "フル懸垂 できる限り", category: "upper", inputMode: "checkbox", checkboxCount: 3, active: true },
    { id: "u-2", name: "フル懸垂 5回×3セット", category: "upper", inputMode: "checkbox", checkboxCount: 3, active: true },
    { id: "u-3", name: "ネガティブ懸垂 5回×3セット", category: "upper", inputMode: "checkbox", checkboxCount: 3, active: true },
    { id: "u-4", name: "ダンベルベントロウ 15回×3セット", category: "upper", inputMode: "checkbox", checkboxCount: 3, active: true },
    { id: "u-5", name: "ダンベルプルオーバー 10回×3セット", category: "upper", inputMode: "checkbox", checkboxCount: 3, active: true },
    { id: "u-6", name: "ダンベルフライ 15回×3セット", category: "upper", inputMode: "checkbox", checkboxCount: 3, active: true },
    { id: "u-7", name: "腕立て伏せ 15回×3セット", category: "upper", inputMode: "checkbox", checkboxCount: 3, active: true },
    // 下半身
    { id: "l-1", name: "バックランジ 20回×3セット", category: "lower", inputMode: "checkbox", checkboxCount: 3, active: true },
    { id: "l-2", name: "ワイドスクワット 15回×3セット", category: "lower", inputMode: "checkbox", checkboxCount: 3, active: true },
    // その他は空スタート
  ],
};
