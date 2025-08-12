// src/tabs/RecordTab.tsx
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";

import {
  loadDayRecord,
  loadExercises,
  saveDayRecord,
} from "@/lib/local-storage";

// --- ローカル型（@/lib/types に依存しない最小定義） ---
type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  notesOther?: string; // その他の備考
  // 種目ID => セットごとの完了フラグ
  sets: Record<string, boolean[]>;
};

type ExercisesState = Record<
  string,
  { id: string; name: string; sets: number }[]
>;
// -------------------------------------------------------

const today = new Date().toISOString().split("T")[0];

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
    window.setTimeout(() => setToast(null), 1200);
  };

  // 初期データ読み込み
  useEffect(() => {
    const loadedExercises = loadExercises();
    if (loadedExercises) {
      setExercises(loadedExercises);
    }
    const loadedRecord = loadDayRecord(today);
    if (loadedRecord) {
      // notesOther がない古いデータにも対応
      setDayRecord((prev) => ({ ...prev, ...loadedRecord }));
    }
  }, []);

  // セットチェック切り替え
  const toggleSet = (exerciseId: string, setIndex: number) => {
    const updatedSets = { ...dayRecord.sets };
    if (!updatedSets[exerciseId]) {
      updatedSets[exerciseId] = [];
    }
    updatedSets[exerciseId][setIndex] = !updatedSets[exerciseId][setIndex];
    const updatedRecord = { ...dayRecord, sets: updatedSets };
    setDayRecord(updatedRecord);
    saveDayRecord(today, updatedRecord);
    notifySaved();
  };

  // メモ変更
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
    return <div>種目データがありません。（設定タブで種目を追加してください）</div>;
  }

  // タップ領域を広く（44px相当）
  const CB_SIZE = "h-11 w-11";

  const CategoryBlock = (
    labelJa: "上半身" | "下半身" | "その他",
    noteField: "notesUpper" | "notesLower" | "notesOther"
  ) => {
    const list = exercises[labelJa] ?? [];
    return (
      <Card className="p-4 space-y-3">
        <h2 className="text-base font-bold">■ {labelJa}</h2>

        {/* 右カラムの見出し（記録） */}
        <div className="flex items-end justify-between text-sm opacity-70 px-1">
          <span className="invisible">種目</span>
          <span>記録</span>
        </div>

        <div className="divide-y">
          {list.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between py-2">
              <div className="pr-4 leading-snug">{ex.name}</div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: ex.sets }).map((_, idx) => (
                  <Checkbox
                    key={idx}
                    className={CB_SIZE}
                    checked={dayRecord.sets[ex.id]?.[idx] || false}
                    onCheckedChange={() => toggleSet(ex.id, idx)}
                    aria-label={`${ex.name} セット${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="py-2 text-sm opacity-60">（種目なし）</div>
          )}
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
      {CategoryBlock("上半身", "notesUpper")}
      {CategoryBlock("下半身", "notesLower")}
      {CategoryBlock("その他", "notesOther")}

      {/* 超軽量トースト */}
      {toast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-black text-white text-sm px-3 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
