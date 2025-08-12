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

/** types.ts を触らず、この画面だけで型を拡張して使う */
type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";
type ExtendedExerciseItem = {
  id: string;
  name: string;
  category: Category;
  inputMode?: InputMode;
  /** セット数（checkCount優先, なければsets, 既定3） */
  checkCount?: number;
  sets?: number;            // 旧フィールド互換
  enabled?: boolean;
  order?: number;
  /** 回数入力モード時のノルマ回数 */
  repTarget?: number;
};

type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  notesOther?: string;
  /** チェック入力: 種目ID => セットごとの完了フラグ */
  sets: Record<string, boolean[]>;
  /** 回数入力: 種目ID => セットごとの回数 */
  counts?: Record<string, number[]>;
};

type ItemUI = {
  id: string;
  name: string;
  mode: InputMode;
  checks: number;      // セット数
  target?: number;     // ノルマ回数（count時のplaceholder用）
};

type GroupUI = {
  cat: Category;
  label: string;
  noteField: "notesUpper" | "notesLower" | "notesOther";
  items: ItemUI[];
};

const SETTINGS_KEY = "settings-v1";
const today = new Date().toISOString().split("T")[0];

/** 既存 counts が number の場合に配列に正規化 */
function toCountsArray(obj: unknown): Record<string, number[]> {
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v.map((n) => Math.max(0, Math.floor(Number(n) || 0)));
    else if (typeof v === "number") out[k] = [Math.max(0, Math.floor(v))];
  }
  return out;
}

export default function RecordTab() {
  const [groups, setGroups] = useState<GroupUI[] | null>(null);
  const [dayRecord, setDayRecord] = useState<DayRecord>({
    date: today,
    notesUpper: "",
    notesLower: "",
    notesOther: "",
    sets: {},
    counts: {},
  });
  const [toast, setToast] = useState<string | null>(null);
  const ping = () => {
    setToast("保存しました");
    window.setTimeout(() => setToast(null), 1100);
  };

  useEffect(() => {
    // 1) 当日記録を読み込み（counts は配列に正規化）
    const rec = loadDayRecord(today) as Partial<DayRecord> | null;
    if (rec) {
      setDayRecord((prev) => ({
        ...prev,
        ...rec,
        counts: { ...(prev.counts ?? {}), ...toCountsArray((rec as any).counts) },
      }));
    }

    // 2) 設定 or デフォルトから UI 構築
    type Settings = { items: ExtendedExerciseItem[] };
    const saved = loadJSON<Settings>(SETTINGS_KEY);
    const items = saved?.items?.length
      ? saved.items
      : (defaultExercises as ExtendedExerciseItem[]);
    setGroups(buildGroups(items));
  }, []);

  function buildGroups(items: ExtendedExerciseItem[]): GroupUI[] {
    const norm = (x?: number) => (Number.isFinite(x) && Number(x) ? Number(x) : 0);

    const list: ItemUI[] = items
      .filter((x) => x.enabled !== false)
      .map((x) => {
        const mode: InputMode = x.inputMode ?? "check";
        const checks = Math.max(1, norm(x.checkCount) || norm(x.sets) || 3);
        const target = mode === "count"
          ? (Number.isFinite(x.repTarget) ? Number(x.repTarget) : undefined)
          : undefined; // 小さな説明は不要のためここでは使わない（countのplaceholder用に保持）
        return { id: x.id, name: x.name, mode, checks, target };
      });

    const sortByOrder = (a: ItemUI, b: ItemUI) => {
      const oa = items.find((i) => i.id === a.id)?.order ?? 0;
      const ob = items.find((i) => i.id === b.id)?.order ?? 0;
      return oa - ob;
    };
    const pick = (cat: Category) =>
      list.filter((i) => items.find((x) => x.id === i.id)?.category === cat).sort(sortByOrder);

    return [
      { cat: "upper", label: "上半身", noteField: "notesUpper", items: pick("upper") },
      { cat: "lower", label: "下半身", noteField: "notesLower", items: pick("lower") },
      { cat: "other", label: "その他", noteField: "notesOther", items: pick("other") },
    ];
  }

  // 回数入力：特定セットの値を更新
  const setCountAt = (exerciseId: string, setIndex: number, val: number) => {
    const counts = { ...(dayRecord.counts ?? {}) };
    const arr = (counts[exerciseId] ?? []).slice();
    const v = Math.max(0, Math.floor(val || 0));
    for (let i = arr.length; i <= setIndex; i++) arr[i] = 0;
    arr[setIndex] = v;
    counts[exerciseId] = arr;
    const updated: DayRecord = { ...dayRecord, counts };
    setDayRecord(updated);
    saveDayRecord(today, updated);
    ping();
  };

  // チェック入力
  const toggleSet = (exerciseId: string, setIndex: number) => {
    const updatedSets = { ...dayRecord.sets };
    if (!updatedSets[exerciseId]) updatedSets[exerciseId] = [];
    updatedSets[exerciseId][setIndex] = !updatedSets[exerciseId][setIndex];
    const updated = { ...dayRecord, sets: updatedSets };
    setDayRecord(updated);
    saveDayRecord(today, updated);
    ping();
  };

  // 備考
  const handleNotesChange = (
    field: "notesUpper" | "notesLower" | "notesOther",
    value: string
  ) => {
    const updated = { ...dayRecord, [field]: value };
    setDayRecord(updated as DayRecord);
    saveDayRecord(today, updated as DayRecord);
    ping();
  };

  if (!groups) return <div className="text-sm text-muted-foreground">読み込み中…</div>;

  function ExerciseRow({ ex }: { ex: ItemUI }) {
    // 表示するセット数：check は最大5、count は設定どおり
    const displayChecks = ex.mode === "check" ? Math.min(ex.checks, 5) : Math.max(ex.checks, 1);

    return (
      <div className="py-3">
        {/* 1行目：種目名のみ（小さなノルマ表記は削除） */}
        <div className="font-medium leading-tight">{ex.name}</div>

        {/* 2行目：入力UI（チェック or 回数） */}
        {ex.mode === "count" ? (
          <div
            className="mt-2 grid gap-2"
            style={{ gridTemplateColumns: `repeat(${displayChecks}, minmax(3.75rem, 1fr))` }}
          >
            {Array.from({ length: displayChecks }).map((_, idx) => {
              const raw = dayRecord.counts?.[ex.id]?.[idx];
              const value: number | string = typeof raw === "number" ? raw : "";
              return (
                <div key={idx} className="flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="w-16 text-right"
                    placeholder={ex.target ? String(ex.target) : "0"}
                    value={value}
                    onChange={(e) => setCountAt(ex.id, idx, Number(e.target.value))}
                    aria-label={`${ex.name} セット${idx + 1} 回数`}
                  />
                  <span className="text-xs opacity-70">回</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="mt-2 grid gap-2"
            style={{ gridTemplateColumns: `repeat(${displayChecks}, 2.75rem)` }}
          >
            {Array.from({ length: displayChecks }).map((_, idx) => {
              const checked = dayRecord.sets[ex.id]?.[idx] || false;
              return (
                <Checkbox
                  key={idx}
                  className="h-11 w-11 border-2 rounded-none"
                  checked={checked}
                  onCheckedChange={() => toggleSet(ex.id, idx)}
                  aria-label={`${ex.name} セット${idx + 1}`}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function CategoryBlock({ group }: { group: GroupUI }) {
    const g = group;
    return (
      <Card className="p-4">
        <h2 className="text-base font-bold mb-2">■ {g.label}</h2>

        <div className="divide-y">
          {g.items.map((ex) => (
            <ExerciseRow key={ex.id} ex={ex} />
          ))}
          {g.items.length === 0 && <div className="py-2 text-sm opacity-60">（種目なし）</div>}
        </div>

        {/* 備考欄 */}
        <div className="space-y-1 mt-3">
          <div className="text-sm font-medium">備考</div>
          <Textarea
            value={(dayRecord as any)[g.noteField] || ""}
            onChange={(e) => handleNotesChange(g.noteField, e.target.value)}
            placeholder="（例）アーチャリープッシュアップも10回やった"
          />
        </div>
      </Card>
    );
  }

  const allEmpty = groups.every((g) => g.items.length === 0);

  return (
    <div className="space-y-4">
      {allEmpty && (
        <Card className="p-4">
          <div className="text-sm">
            種目データが見つかりませんでした。初期データで表示しています。<br />
            種目の追加・編集は{" "}
            <Link className="underline" href="/tabs/settings">
              設定
            </Link>{" "}
            から行えます。
          </div>
        </Card>
      )}

      {groups.map((g) => (
        <CategoryBlock key={g.cat} group={g} />
      ))}

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-black text-white text-sm px-3 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
