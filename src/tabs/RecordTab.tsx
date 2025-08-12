// src/tabs/RecordTab.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";

import { loadDayRecord, loadExercises, saveDayRecord } from "@/lib/local-storage";

// --- ローカル型（既存データと互換） ---
type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  notesOther?: string;
  // 種目ID => セットごとの完了フラグ
  sets: Record<string, boolean[]>;
};

type ExerciseItemLike = { id: string; name: string; sets?: number; checkCount?: number };
type ExercisesState = Record<string, ExerciseItemLike[]>;
// ------------------------------------------------

const today = new Date().toISOString().split("T")[0];

// カテゴリ名を正規化（"upper"/"lower" or 日本語）
function classifyCategory(key: string): "upper" | "lower" | "other" {
  const k = key.toLowerCase();
  if (k.includes("upper") || k.includes("上")) return "upper";
  if (k.includes("lower") || k.includes("下")) return "lower";
  return "other";
}

const CELL = { size: "h-11 w-11" }; // 44px相当

export default function RecordTab() {
  const [exercises, setExercises] = useState<ExercisesState | null>(null);
  const [dayRecord, setDayRecord] = useState<DayRecord>({
    date: today,
    notesUpper: "",
    notesLower: "",
    notesOther: "",
    sets: {},
  });
  const [toast, setToast] = useState<string | null>(null);

  const notifySaved = () => {
    setToast("保存しました");
    window.setTimeout(() => setToast(null), 1100);
  };

  useEffect(() => {
    const loadedExercises = loadExercises();
    if (loadedExercises) setExercises(loadedExercises);
    const loadedRecord = loadDayRecord(today);
    if (loadedRecord) setDayRecord((prev) => ({ ...prev, ...loadedRecord }));
  }, []);

  // 「上/下/その他」の3ブロックへ正規化
  const groups = useMemo(() => {
    const g: Record<
      "upper" | "lower" | "other",
      { label: string; noteField: "notesUpper" | "notesLower" | "notesOther"; items: ExerciseItemLike[] }
    > = {
      upper: { label: "上半身", noteField: "notesUpper", items: [] },
      lower: { label: "下半身", noteField: "notesLower", items: [] },
      other: { label: "その他", noteField: "notesOther", items: [] },
    };
    if (exercises) {
      for (const [key, arr] of Object.entries(exercises)) {
        g[classifyCategory(key)].items.push(...arr);
      }
    }
    return g;
  }, [exercises]);

  // チェック切替
  const toggleSet = (exerciseId: string, setIndex: number) => {
    const updatedSets = { ...dayRecord.sets };
    if (!updatedSets[exerciseId]) updatedSets[exerciseId] = [];
    updatedSets[exerciseId][setIndex] = !updatedSets[exerciseId][setIndex];

    const updatedRecord = { ...dayRecord, sets: updatedSets };
    setDayRecord(updatedRecord);
    saveDayRecord(today, updatedRecord);
    notifySaved();
  };

  // 備考更新
  const handleNotesChange = (
    field: "notesUpper" | "notesLower" | "notesOther",
    value: string
  ) => {
    const updatedRecord = { ...dayRecord, [field]: value };
    setDayRecord(updatedRecord);
    saveDayRecord(today, updatedRecord);
    notifySaved();
  };

  if (!exercises) {
    return <div className="text-sm text-muted-foreground">種目データがありません。（設定で種目を追加してください）</div>;
  }

  // 1カテゴリ分の描画
  const CategoryBlock = (
    label: string,
    noteField: "notesUpper" | "notesLower" | "notesOther",
    list: ExerciseItemLike[]
  ) => {
    // 表示用のチェック数：checkCount > sets > 3
    const boxCountOf = (ex: ExerciseItemLike) => ex.checkCount ?? ex.sets ?? 3;
    const maxChecks = Math.max(0, ...list.map(boxCountOf));

    return (
      <Card className="p-4 space-y-3">
        <h2 className="text-base font-bold">■ {label}</h2>

        {/* 見出し（記録 / ○回連続） */}
        <div className="flex items-end justify-between text-sm px-1">
          <span className="invisible">種目</span>
          <div className="flex flex-col items-center">
            <span className="font-medium">記録</span>
            {maxChecks > 0 && <span className="text-xs opacity-70">{maxChecks}回連続</span>}
          </div>
        </div>

        {/* 種目行（列数をカテゴリ内で固定） */}
        <div className="divide-y">
          {list.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between py-2">
              <div className="pr-4 leading-snug">{ex.name}</div>

              {/* Grid で列数固定。足りない分は“空枠”を描画して縦揃え */}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${maxChecks || 1}, 2.75rem)` }} // 44px
              >
                {Array.from({ length: maxChecks || 1 }).map((_, idx) => {
                  const limit = boxCountOf(ex);
                  const isGap = idx >= limit; // 空枠
                  const checked = !isGap && (dayRecord.sets[ex.id]?.[idx] || false);
                  return (
                    <Checkbox
                      key={idx}
                      className={`${CELL.size} border-2 rounded-none ${isGap ? "pointer-events-none opacity-40" : ""}`}
                      checked={checked}
                      onCheckedChange={() => !isGap && toggleSet(ex.id, idx)}
                      aria-label={`${ex.name} セット${idx + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="py-2 text-sm opacity-60">（種目なし）</div>}
        </div>

        {/* 備考 */}
        <div className="space-y-1">
          <div className="text-sm font-medium">備考</div>
          <Textarea
            value={dayRecord[noteField] || ""}
            onChange={(e) => handleNotesChange(noteField, e.target.value)}
            placeholder="（例）アーチャリープッシュアップも10回やった"
          />
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {CategoryBlock(groups.upper.label, groups.upper.noteField, groups.upper.items)}
      {CategoryBlock(groups.lower.label, groups.lower.noteField, groups.lower.items)}
      {CategoryBlock(groups.other.label, groups.other.noteField, groups.other.items)}

      {/* 軽量トースト */}
      {toast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-black text-white text-sm px-3 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
