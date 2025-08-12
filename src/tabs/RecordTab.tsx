// src/tabs/RecordTab.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";
import { defaultExercises } from "@/lib/exercises-default";

type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";

// 設定が保存する形（最低限）
type ExerciseItem = {
  id: string;
  name: string;
  category: Category;
  inputMode?: InputMode;
  checkCount?: number; // check時のチェック個数
  sets?: number;       // 旧フィールド（後方互換）
  enabled?: boolean;
  order?: number;
  repTarget?: number;  // count時の目標回数（任意）
};

// 1日分の記録
type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  notesOther?: string;
  // チェック式の結果
  sets: Record<string, boolean[]>;
  // 回数入力の結果（今回の追加。なければ存在しない想定）
  counts?: Record<string, number>;
};

type ItemUI = {
  id: string;
  name: string;
  mode: InputMode;
  checks?: number; // mode=check のとき使用
  target?: number; // 目標：check=セット数 / count=回数
};

type GroupUI = {
  key: Category;
  label: string;
  noteField: "notesUpper" | "notesLower" | "notesOther";
  items: ItemUI[];
};

const SETTINGS_KEY = "settings-v1";
const today = new Date().toISOString().split("T")[0];

export default function RecordTab() {
  const [groups, setGroups] = useState<GroupUI[] | null>(null);
  const [dayRecord, setDayRecord] = useState<DayRecord>({
    date: today,
    notesUpper: "",
    notesLower: "",
    notesOther: "",
    sets: {},
    counts: {}, // 初期化しておくと以降の処理が楽
  });
  const [toast, setToast] = useState<string | null>(null);

  const notifySaved = () => {
    setToast("保存しました");
    window.setTimeout(() => setToast(null), 1100);
  };

  useEffect(() => {
    // 1) 日別レコード
    const rec: Partial<DayRecord> | null = loadDayRecord(today);
    if (rec) {
      setDayRecord((prev) => ({
        ...prev,
        ...rec,
        // rec.counts が無くても問題ないように安全にマージ
        counts: {
          ...(prev.counts ?? {}),
          ...(typeof (rec as any).counts === "object" && (rec as any).counts ? (rec as any).counts : {}),
        },
      }));
    }

    // 2) 種目（設定 → フォールバック）
    type Settings = { items: ExerciseItem[] };
    const saved = loadJSON<Settings>(SETTINGS_KEY);
    if (saved?.items?.length) {
      setGroups(buildGroupsFromSettings(saved.items));
    } else {
      setGroups(buildGroupsFromSettings(defaultExercises as ExerciseItem[]));
    }
  }, []);

  function buildGroupsFromSettings(items: ExerciseItem[]): GroupUI[] {
    const list: ItemUI[] = items
      .filter((x) => x.enabled !== false)
      .map((x) => {
        const mode: InputMode = x.inputMode ?? "check";
        const checks = mode === "check" ? Number(x.checkCount ?? x.sets ?? 3) || 3 : undefined;
        const target =
          mode === "check"
            ? checks
            : x.repTarget && Number.isFinite(x.repTarget)
            ? Number(x.repTarget)
            : undefined;
        return { id: x.id, name: x.name, mode, checks, target };
      });

    const pick = (cat: Category) =>
      list
        .filter((it) => items.find((x) => x.id === it.id)?.category === cat)
        .sort((a, b) => {
          const oa = items.find((x) => x.id === a.id)?.order ?? 0;
          const ob = items.find((x) => x.id === b.id)?.order ?? 0;
          return oa - ob;
        });

    return [
      { key: "upper", label: "上半身", noteField: "notesUpper", items: pick("upper") },
      { key: "lower", label: "下半身", noteField: "notesLower", items: pick("lower") },
      { key: "other", label: "その他", noteField: "notesOther", items: pick("other") },
    ];
  }

  const setCount = (exerciseId: string, val: number) => {
    const counts = { ...(dayRecord.counts ?? {}) };
    counts[exerciseId] = Math.max(0, Math.floor(val || 0));
    const updated: DayRecord = { ...dayRecord, counts };
    setDayRecord(updated);
    saveDayRecord(today, updated);
    notifySaved();
  };

  const toggleSet = (exerciseId: string, setIndex: number) => {
    const updatedSets = { ...dayRecord.sets };
    if (!updatedSets[exerciseId]) updatedSets[exerciseId] = [];
    updatedSets[exerciseId][setIndex] = !updatedSets[exerciseId][setIndex];

    const updatedRecord: DayRecord = { ...dayRecord, sets: updatedSets };
    setDayRecord(updatedRecord);
    saveDayRecord(today, updatedRecord);
    notifySaved();
  };

  const handleNotesChange = (
    field: "notesUpper" | "notesLower" | "notesOther",
    value: string
  ) => {
    const updatedRecord: DayRecord = { ...dayRecord, [field]: value };
    setDayRecord(updatedRecord);
    saveDayRecord(today, updatedRecord);
    notifySaved();
  };

  if (!groups) {
    return <div className="text-sm text-muted-foreground">読み込み中…</div>;
  }

  const CategoryBlock = (g: GroupUI) => {
    const maxChecks = Math.max(
      0,
      ...g.items.filter((x) => x.mode === "check").map((x) => x.checks ?? 0)
    );

    return (
      <Card className="p-4 space-y-3">
        <h2 className="text-base font-bold">■ {g.label}</h2>

        <div className="divide-y">
          {g.items.map((ex) => {
            const goalText =
              ex.mode === "count"
                ? ex.target
                  ? `目標 ${ex.target}回`
                  : "回数入力"
                : ex.checks
                ? `目標 ${ex.checks}セット`
                : "セットチェック";

            return (
              <div key={ex.id} className="flex items-center justify-between py-2">
                <div className="pr-4 leading-snug">
                  <div className="font-medium">{ex.name}</div>
                  <div className="text-xs opacity-60 mt-0.5">{goalText}</div>
                </div>

                {ex.mode === "count" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="w-24 text-right"
                      placeholder={ex.target ? String(ex.target) : "0"}
                      value={Math.max(0, Math.floor((dayRecord.counts ?? {})[ex.id] ?? 0))}
                      onChange={(e) => setCount(ex.id, Number(e.target.value))}
                      aria-label={`${ex.name} 回数`}
                    />
                    <span className="text-sm opacity-70">回</span>
                  </div>
                ) : (
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(ex.checks ?? 1, maxChecks || 1)}, 2.75rem)`,
                    }}
                  >
                    {Array.from({ length: Math.max(ex.checks ?? 0, maxChecks) || 1 }).map((_, idx) => {
                      const isGap = idx >= (ex.checks ?? 0);
                      const checked = !isGap && (dayRecord.sets[ex.id]?.[idx] || false);
                      return (
                        <Checkbox
                          key={idx}
                          className={`h-11 w-11 border-2 rounded-none ${
                            isGap ? "pointer-events-none opacity-40" : ""
                          }`}
                          checked={checked}
                          onCheckedChange={() => !isGap && toggleSet(ex.id, idx)}
                          aria-label={`${ex.name} セット${idx + 1}`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {g.items.length === 0 && <div className="py-2 text-sm opacity-60">（種目なし）</div>}
        </div>

        {/* 備考 */}
        <div className="space-y-1">
          <div className="text-sm font-medium">備考</div>
          <Textarea
            value={(dayRecord as any)[g.noteField] || ""}
            onChange={(e) => handleNotesChange(g.noteField, e.target.value)}
            placeholder="（例）アーチャリープッシュアップも10回やった"
          />
        </div>
      </Card>
    );
  };

  const allEmpty = groups.every((g) => g.items.length === 0);

  return (
    <div className="space-y-4">
      {allEmpty && (
        <Card className="p-4">
          <div className="text-sm">
            種目データが見つかりませんでした。初期データで表示しています。<br />
            種目の追加・編集は <Link className="underline" href="/tabs/settings">設定</Link> から行えます。
          </div>
        </Card>
      )}

      {groups.map((g) => (
        <CategoryBlock key={g.key} {...g} />
      ))}

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-black text-white text-sm px-3 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

