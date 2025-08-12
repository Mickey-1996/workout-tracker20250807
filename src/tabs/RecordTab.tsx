// src/tabs/RecordTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import Link from "next/link";

import { loadDayRecord, loadExercises, saveDayRecord } from "@/lib/local-storage";
import { defaultExercises } from "@/lib/exercises-default";

// 既存保存形式に依存しない最小型
type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  notesOther?: string;
  sets: Record<string, boolean[]>;
};

type ExerciseItem = {
  id: string;
  name: string;
  category: "upper" | "lower" | "other";
  sets?: number;
  checkCount?: number;
  enabled?: boolean;
  order?: number;
};

type ExercisesState = Record<"upper" | "lower" | "other", { id: string; name: string; sets: number }[]>;

const today = new Date().toISOString().split("T")[0];
const CELL = { size: "h-11 w-11" }; // 44px

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

  // localStorage から読めない場合は defaultExercises でフォールバック
  useEffect(() => {
    const loaded = loadExercises();
    if (loaded && Object.keys(loaded).length) {
      // 既存の exercises 形式（カテゴリ -> 配列）そのまま使用
      setExercises(normalizeLoaded(loaded));
    } else {
      // 初期データから UI 用の形に整形（enabled のみ）
      setExercises(fromDefaults(defaultExercises as ExerciseItem[]));
    }

    const rec = loadDayRecord(today);
    if (rec) setDayRecord((prev) => ({ ...prev, ...rec }));
  }, []);

  // 読み込んだオブジェクトが { [key: string]: { id,name,sets }[] } 型に近い場合の保険
  function normalizeLoaded(obj: any): ExercisesState {
    const out: ExercisesState = { upper: [], lower: [], other: [] };
    for (const [k, arr] of Object.entries(obj as Record<string, any[]>)) {
      const cat = k.toLowerCase().includes("upper")
        ? "upper"
        : k.toLowerCase().includes("lower")
        ? "lower"
        : "other";
      for (const it of arr) {
        out[cat].push({
          id: String(it.id),
          name: String(it.name),
          sets: Number(it.sets ?? it.checkCount ?? 3) || 3,
        });
      }
    }
    return out;
  }

  // defaultExercises（配列）→ UI 用 {upper/lower/other: …} に整形
  function fromDefaults(list: ExerciseItem[]): ExercisesState {
    const out: ExercisesState = { upper: [], lower: [], other: [] };
    const add = (cat: "upper" | "lower" | "other", it: ExerciseItem) => {
      const sets = Number(it.checkCount ?? it.sets ?? 3) || 3;
      out[cat].push({ id: it.id, name: it.name, sets });
    };
    for (const it of list) {
      if (it.enabled === false) continue; // 非表示は除外
      add(it.category, it);
    }
    // order があれば並べ替え（同一カテゴリ内）
    (["upper", "lower", "other"] as const).forEach((cat) => {
      out[cat].sort((a, b) => {
        const oa =
          (list.find((x) => x.id === a.id)?.order ?? 0) as number;
        const ob =
          (list.find((x) => x.id === b.id)?.order ?? 0) as number;
        return oa - ob;
      });
    });
    return out;
  }

  // 表示用の3グループ
  const groups = useMemo(() => {
    return [
      { key: "upper" as const, label: "上半身", noteField: "notesUpper" as const, items: exercises?.upper ?? [] },
      { key: "lower" as const, label: "下半身", noteField: "notesLower" as const, items: exercises?.lower ?? [] },
      { key: "other" as const, label: "その他", noteField: "notesOther" as const, items: exercises?.other ?? [] },
    ];
  }, [exercises]);

  const toggleSet = (exerciseId: string, setIndex: number) => {
    const updatedSets = { ...dayRecord.sets };
    if (!updatedSets[exerciseId]) updatedSets[exerciseId] = [];
    updatedSets[exerciseId][setIndex] = !updatedSets[exerciseId][setIndex];

    const updatedRecord = { ...dayRecord, sets: updatedSets };
    setDayRecord(updatedRecord);
    saveDayRecord(today, updatedRecord);
    notifySaved();
  };

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
    // フォールバックが効くまでの一瞬の状態
    return <div className="text-sm text-muted-foreground">読み込み中…</div>;
  }

  const CategoryBlock = (
    label: string,
    noteField: "notesUpper" | "notesLower" | "notesOther",
    list: { id: string; name: string; sets: number }[]
  ) => {
    const maxChecks = Math.max(0, ...list.map((x) => x.sets || 0));
    return (
      <Card className="p-4 space-y-3">
        <h2 className="text-base font-bold">■ {label}</h2>

        <div className="flex items-end justify-between text-sm px-1">
          <span className="invisible">種目</span>
          <div className="flex flex-col items-center">
            <span className="font-medium">記録</span>
            {maxChecks > 0 && <span className="text-xs opacity-70">{maxChecks}回連続</span>}
          </div>
        </div>

        <div className="divide-y">
          {list.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between py-2">
              <div className="pr-4 leading-snug">{ex.name}</div>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${maxChecks || 1}, 2.75rem)` }}
              >
                {Array.from({ length: maxChecks || 1 }).map((_, idx) => {
                  const isGap = idx >= (ex.sets || 0);
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

  const emptyAll =
    groups.every((g) => g.items.length === 0);

  return (
    <div className="space-y-4">
      {emptyAll && (
        <Card className="p-4">
          <div className="text-sm">
            種目データが見つかりませんでした。初期データで表示しています。<br />
            種目の追加・編集は <Link className="underline" href="/tabs/settings">設定</Link> から行えます。
          </div>
        </Card>
      )}

      {groups.map((g) => CategoryBlock(g.label, g.noteField, g.items))}

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-black text-white text-sm px-3 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
