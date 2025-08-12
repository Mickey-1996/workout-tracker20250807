// src/tabs/RecordTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";
import { defaultExercises } from "@/lib/exercises-default";

type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  notesOther?: string;
  // チェック式: sets / 回数式: counts（どちらも同居可）
  sets: Record<string, boolean[]>;
  counts?: Record<string, number>;
};

type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";

// SettingsTab が保存している ExerciseItem と互換な最低限の形
type ExerciseItem = {
  id: string;
  name: string;
  category: Category;
  inputMode?: InputMode;     // "check" | "count"
  checkCount?: number;       // チェック個数（check時）
  sets?: number;             // 旧フィールド（後方互換）
  enabled?: boolean;
  order?: number;
  // 追加：回数目標（count時、設定に無ければ未定義でOK）
  repTarget?: number;
};

type ItemUI = {
  id: string;
  name: string;
  mode: InputMode;
  // mode=check のとき使用（表示＆保存用）
  checks?: number;
  // 目標表示（check: セット数 / count: 回数）
  target?: number;
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
    counts: {},
  });
  const [toast, setToast] = useState<string | null>(null);

  const notifySaved = () => {
    setToast("保存しました");
    window.setTimeout(() => setToast(null), 1100);
  };

  // 設定があれば最優先で反映。なければ defaultExercises でフォールバック
  useEffect(() => {
    // 1) 日別レコード
    const rec = loadDayRecord(today);
    if (rec) {
      setDayRecord((prev) => ({
        ...prev,
        ...rec,
        counts: { ...(prev.counts ?? {}), ...(rec.counts ?? {}) },
      }));
    }

    // 2) 種目（設定 → フォールバック）
    type Settings = { items: ExerciseItem[] };
    const saved = loadJSON<Settings>(SETTINGS_KEY);
    if (saved?.items?.length) {
      setGroups(buildGroupsFromSettings(saved.items));
    } else {
      // defaultExercises（配列）を利用
      setGroups(buildGroupsFromSettings(defaultExercises as ExerciseItem[]));
    }
  }, []);

  // Settings の items から UI 表示用グループを構築
  function buildGroupsFromSettings(items: ExerciseItem[]): GroupUI[] {
    const list = items
      .filter((x) => x.enabled !== false) // 無効は非表示
      .map<ItemUI>((x) => {
        const mode: InputMode = x.inputMode ?? "check";
        // check の表示個数は checkCount > sets > 3 の順
        const checks =
          mode === "check" ? Number(x.checkCount ?? x.sets ?? 3) || 3 : undefined;
        const target =
          mode === "check"
            ? checks // “目標セット数”
            : x.repTarget && Number.isFinite(x.repTarget)
            ? Number(x.repTarget) // “目標回数”
            : undefined;
        return {
          id: x.id,
          name: x.name,
          mode,
          checks,
          target,
        };
      });

    const by = (cat: Category) =>
      list
        .filter((x) => findItem(items, x.id)?.category === cat)
        .sort((a, b) => {
          const oa = findItem(items, a.id)?.order ?? 0;
          const ob = findItem(items, b.id)?.order ?? 0;
          return oa - ob;
        });

    return [
      { key: "upper", label: "上半身", noteField: "notesUpper", items: by("upper") },
      { key: "lower", label: "下半身", noteField: "notesLower", items: by("lower") },
      { key: "other", label: "その他", noteField: "notesOther", items: by("other") },
    ];
  }

  function findItem(items: ExerciseItem[], id: string) {
    return items.find((x) => x.id === id);
  }

  const setCount = (exerciseId: string, val: number) => {
    const counts = { ...(dayRecord.counts ?? {}) };
    counts[exerciseId] = Math.max(0, Math.floor(val || 0));
    const updated = { ...dayRecord, counts };
    setDayRecord(updated);
    saveDayRecord(today, updated);
    notifySaved();
  };

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

  if (!groups) {
    return <div className="text-sm text-muted-foreground">読み込み中…</div>;
  }

  const CategoryBlock = (g: GroupUI) => {
    // チェック行の整列のため、当該カテゴリでの最大チェック数を求める
    const maxChecks = Math.max(
      0,
      ...g.items
        .filter((x) => x.mode === "check")
        .map((x) => x.checks ?? 0)
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
                    {Array.from({ length: Math.max(ex.checks ?? 0, maxChecks) || 1 }).map(
                      (_, idx) => {
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
                      }
                    )}
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
