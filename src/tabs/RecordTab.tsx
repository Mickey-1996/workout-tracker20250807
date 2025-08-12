// src/tabs/RecordTab.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";

/* ========= メモ欄の記述例（全カテゴリ同一） ========= */
const MEMO_EXAMPLE = "（例）アーチャープッシュアップも10回やった";
/* ================================================= */

/* 画面内の軽量型（他ファイル変更なし） */
type DayRecord = {
  date: string;
  notesUpper: string;
  notesLower: string;
  notesOther?: string;
  sets: Record<string, boolean[]>;
  counts?: Record<string, number[]>;
};

type ExercisesState = Record<
  string,
  { id: string; name: string; sets: number }[]
>;

type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";
type Settings = {
  items: Array<{
    id: string;
    name: string;
    category: Category;
    inputMode?: InputMode;
    checkCount?: number;
    sets?: number;
    enabled?: boolean;
    order?: number;
    repTarget?: number; // 回数入力のノルマ
  }>;
};

type MetaMap = Record<
  string,
  {
    mode: InputMode;
    setCount: number;
    repTarget?: number;
  }
>;

/* 日付ユーティリティ */
const todayStr = new Date().toISOString().split("T")[0];
const fmtDateJP = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

/* 経過時間（時間） */
const hoursSince = (iso?: string): number | null => {
  if (!iso) return null;
  const last = new Date(iso).getTime();
  if (Number.isNaN(last)) return null;
  const now = Date.now();
  return Math.max(0, Math.floor((now - last) / 3600000));
};

/* 最終実施の記録（exerciseId => ISO） */
const LAST_DONE_KEY = "last-done-v1";
type LastDoneMap = Record<string, string>;

export default function RecordTab() {
  /* 設定→メタ（モード・セット・ノルマ） */
  const [meta, setMeta] = useState<MetaMap>({});
  useEffect(() => {
    const settings = loadJSON<Settings>("settings-v1");
    const items = settings?.items?.filter((x) => x.enabled !== false) ?? [];
    const m: MetaMap = {};
    for (const it of items) {
      const mode: InputMode = it.inputMode ?? "check";
      const setCount = Math.max(1, it.checkCount ?? it.sets ?? 3);
      m[it.id] = { mode, setCount, repTarget: it.repTarget };
    }
    setMeta(m);
  }, []);

  /* カテゴリ別の配列を生成 */
  const [exercises, setExercises] = useState<ExercisesState | null>(null);
  useEffect(() => {
    if (Object.keys(meta).length) {
      const settings = loadJSON<Settings>("settings-v1");
      const items = settings?.items?.filter((x) => x.enabled !== false) ?? [];
      const grouped: ExercisesState = { upper: [], lower: [], other: [] } as any;
      for (const it of items) {
        const setCount = meta[it.id]?.setCount ?? it.sets ?? 3;
        (grouped[it.category] as any).push({
          id: it.id,
          name: it.name,
          sets: setCount,
        });
      }
      setExercises(grouped);
    }
  }, [meta]);

  /* 当日レコード */
  const [dayRecord, setDayRecord] = useState<DayRecord>({
    date: todayStr,
    notesUpper: "",
    notesLower: "",
    notesOther: "",
    sets: {},
    counts: {},
  });

  useEffect(() => {
    const loaded = loadDayRecord(todayStr) as Partial<DayRecord> | null;
    if (loaded) {
      setDayRecord({
        date: todayStr,
        notesUpper: loaded.notesUpper ?? "",
        notesLower: loaded.notesLower ?? "",
        notesOther: loaded.notesOther ?? "",
        sets: loaded.sets ?? {},
        counts: loaded.counts ?? {},
      });
    }
  }, []);

  const persist = (rec: DayRecord) => {
    setDayRecord(rec);
    // 型の衝突を避ける（ライブラリ側の型定義と画面内型を切り離し）
    (saveDayRecord as any)(todayStr, rec);
  };

  /* 最終実施 */
  const [lastDone, setLastDone] = useState<LastDoneMap>({});
  useEffect(() => {
    const map = loadJSON<LastDoneMap>(LAST_DONE_KEY) ?? {};
    setLastDone(map);
  }, []);
  const updateLastDone = (exerciseId: string) => {
    const nowIso = new Date().toISOString();
    setLastDone((prev) => {
      const next = { ...prev, [exerciseId]: nowIso };
      try {
        window.localStorage.setItem(LAST_DONE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  /* チェック切り替え */
  const toggleSet = (exerciseId: string, setIndex: number) => {
    const sets = { ...(dayRecord.sets || {}) };
    const arr = [...(sets[exerciseId] ?? [])];
    arr[setIndex] = !arr[setIndex];
    sets[exerciseId] = arr;

    const next: DayRecord = { ...dayRecord, sets };
    persist(next);

    if (arr[setIndex]) updateLastDone(exerciseId);
  };

  /* 回数入力 */
  const changeCount = (exerciseId: string, setIndex: number, value: string) => {
    let n = Math.floor(Number(value || "0"));
    if (!Number.isFinite(n) || n < 0) n = 0;

    const counts = { ...(dayRecord.counts || {}) };
    const arr = [...(counts[exerciseId] ?? [])];
    const needLen = Math.max(setIndex + 1, arr.length);
    for (let i = 0; i < needLen; i++) if (arr[i] == null) arr[i] = 0;
    arr[setIndex] = n;
    counts[exerciseId] = arr;

    const next: DayRecord = { ...dayRecord, counts };
    persist(next);

    if (n > 0) updateLastDone(exerciseId);
  };

  /* メモ（カテゴリ別） */
  const handleCatNotesChange = (cat: Category, value: string) => {
    if (cat === "upper") return persist({ ...dayRecord, notesUpper: value ?? "" });
    if (cat === "lower") return persist({ ...dayRecord, notesLower: value ?? "" });
    return persist({ ...dayRecord, notesOther: value ?? "" });
  };

  /* 表示ラベルなど */
  const recoveryText = (exerciseId: string) => {
    const h = hoursSince(lastDone[exerciseId]);
    if (h == null) return "—";
    if (h < 1) return "<1H";
    return `${h}H`;
  };

  if (!exercises) {
    return <div>種目データがありません。（設定タブで種目を追加してください）</div>;
  }

  const catLabel = (c: string) => (c === "upper" ? "上半身" : c === "lower" ? "下半身" : "その他");

  return (
    <div className="space-y-4">
      {/* 右上に本日日付 */}
      <div className="flex items-center justify-end">
        <div className="text-sm text-muted-foreground">📅 {fmtDateJP(todayStr)}</div>
      </div>

      {Object.entries(exercises).map(([category, categoryExercises]) => {
        const cat = category as Category;
        const notesValue =
          cat === "upper"
            ? dayRecord.notesUpper
            : cat === "lower"
            ? dayRecord.notesLower
            : dayRecord.notesOther ?? "";

        return (
          <Card key={category} className="p-4">
            <h2 className="text-base font-bold mb-3">{catLabel(category)}</h2>

            {categoryExercises.map((ex) => {
              const m = meta[ex.id] ?? { mode: "check" as InputMode, setCount: ex.sets ?? 3 };
              const setCount = Math.max(1, m.setCount ?? ex.sets ?? 3);
              const mode = m.mode ?? "check";

              return (
                <div key={ex.id} className="mb-4">
                  {/* 1行目：種目名 + インターバル */}
                  <div className="flex flex-wrap items-baseline gap-2">
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="ml-auto text-sm text-slate-500">
                      前回からのインターバル：{recoveryText(ex.id)}
                    </div>
                  </div>

                  {/* 2行目：入力行（回数は小さめ・チェックはやや大きめ） */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mode === "count"
                      ? Array.from({ length: setCount }).map((_, idx) => {
                          const cur = dayRecord.counts?.[ex.id]?.[idx] ?? "";
                          const ph = m.repTarget ? String(m.repTarget) : "";
                          return (
                            <Input
                              key={idx}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              placeholder={ph}
                              className="h-8 w-14 text-xs px-2"
                              value={cur === 0 ? "" : String(cur)}
                              onChange={(e) => changeCount(ex.id, idx, e.target.value)}
                            />
                          );
                        })
                      : Array.from({ length: setCount }).map((_, idx) => (
                          <Checkbox
                            key={idx}
                            checked={dayRecord.sets?.[ex.id]?.[idx] || false}
                            onCheckedChange={() => toggleSet(ex.id, idx)}
                            className="h-6 w-6"
                          />
                        ))}
                  </div>
                </div>
              );
            })}

            {/* カテゴリ別メモ欄（記述例は全カテゴリ同一） */}
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1">
                {cat === "upper" ? "上半身メモ" : cat === "lower" ? "下半身メモ" : "その他メモ"}
              </label>
              <Textarea
                className="text-sm"
                value={notesValue}
                onChange={(e) => handleCatNotesChange(cat, e.target.value)}
                placeholder={MEMO_EXAMPLE}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
