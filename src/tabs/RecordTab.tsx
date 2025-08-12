// 記録タブ：回数入力は選択式（0〜99）、チェックは最大5個表示。
// 「ノルマ…」の小さな説明行は表示しない。「その他」空時の説明も非表示。

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import Link from "next/link";

import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";
import { defaultExercises } from "@/lib/exercises-default";

/** この画面だけで使う軽量型 */
type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";
type ExtendedExerciseItem = {
  id: string;
  name: string;
  category: Category;
  inputMode?: InputMode;
  checkCount?: number;
  sets?: number;
  enabled?: boolean;
  order?: number;
  repTarget?: number;
};

type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  notesOther?: string;
  sets: Record<string, boolean[]>;         // チェック方式
  counts?: Record<string, number[] | number>; // 回数方式（互換）
};

type ItemUI = {
  id: string;
  name: string;
  mode: InputMode;
  checks: number;      // セット数
  target?: number;     // ノルマ回数（count の placeholderには使わないが保持）
};

type GroupUI = {
  cat: Category;
  label: string;
  noteField: "notesUpper" | "notesLower" | "notesOther";
  items: ItemUI[];
};

const SETTINGS_KEY = "settings-v1";
const today = new Date().toISOString().split("T")[0];

/** counts が number の場合を配列へ正規化 */
function normalizeCounts(counts: DayRecord["counts"]): Record<string, number[]> {
  if (!counts || typeof counts !== "object") return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(counts)) {
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
    window.setTimeout(() => setToast(null), 900);
  };

  useEffect(() => {
    // 当日記録の読み込み
    const rec = loadDayRecord(today) as DayRecord | null;
    if (rec) {
      setDayRecord((prev) => ({
        ...prev,
        ...rec,
        counts: { ...(prev.counts ?? {}), ...normalizeCounts(rec.counts) },
      }));
    }

    // 設定 or デフォルトから UI 構築
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
          : undefined;
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

  // 回数入力：選択値を保存
  const setCountAt = (exerciseId: string, setIndex: number, val: number) => {
    const counts = normalizeCounts(dayRecord.counts);
    const arr = (counts[exerciseId] ?? []).slice();
    for (let i = arr.length; i <= setIndex; i++) arr[i] = 0;
    arr[setIndex] = Math.max(0, Math.floor(val || 0));
    const updated: DayRecord = { ...dayRecord, counts: { ...counts, [exerciseId]: arr } };
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
    // チェックは最大5個まで表示（UI崩れ防止）
    const checksToShow = ex.mode === "check" ? Math.min(ex.checks, 5) : Math.max(ex.checks, 1);

    return (
      <div className="py-3">
        {/* 1行目：種目名のみ（ノルマ小表示は削除済み） */}
        <div className="font-medium leading-tight">{ex.name}</div>

        {/* 2行目：入力UI（折返し可能） */}
        {ex.mode === "count" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from({ length: checksToShow }).map((_, idx) => {
              const current = normalizeCounts(dayRecord.counts)[ex.id]?.[idx] ?? 0;
              return (
                <div key={idx} className="flex items-center gap-1">
                  <select
                    className="h-10 rounded-md border px-2 text-sm w-16"
                    value={current}
                    onChange={(e) => setCountAt(ex.id, idx, Number(e.target.value))}
                    aria-label={`${ex.name} セット${idx + 1} 回数`}
                  >
                    {Array.from({ length: 100 }, (_, n) => n).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs opacity-70">回</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="mt-2 grid gap-2"
            style={{ gridTemplateColumns: `repeat(${checksToShow}, 2.75rem)` }}
          >
            {Array.from({ length: checksToShow }).map((_, idx) => {
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

          {/* 「その他」エリアは空でも説明行を出さない */}
          {g.items.length === 0 && g.cat !== "other" && (
            <div className="py-2 text-sm opacity-60">（種目なし）</div>
          )}
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

