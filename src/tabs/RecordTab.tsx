"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";

/* ========= メモ欄の記述例（全カテゴリ共通） ========= */
const MEMO_EXAMPLE = "（例）アーチャープッシュアップも10回やった";
/* ================================================ */

/** セルサイズ（チェック/回数とも同じサイズ・デフォルト46px） */
const CELL = 46;              // 既定サイズ
const MIN_CELL = 40;          // 狭い画面での最小サイズ（わずかに自動縮小を許容）
const GAP_PX = 8;             // gap-2 相当
const MAX_COLS = 5;           // 1行最大5つ
const GRID_WIDTH_PX = MAX_COLS * CELL + (MAX_COLS - 1) * GAP_PX; // 右寄せ用の最大幅

type DayRecord = {
  date: string;
  notesUpper?: string;
  notesLower?: string;
  notesOther?: string;
  sets: Record<string, boolean[]>;
  counts?: Record<string, number[]>;
  /** 各セットの「正の入力（チェックON or 回数>0）」時刻 */
  times?: Record<string, (string | null)[]>;
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

const todayStr = new Date().toISOString().split("T")[0];
const fmtDateJP = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

const hoursSince = (iso?: string): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 3600000));
};

const isSameDay = (iso?: string, ymd?: string) => {
  if (!iso || !ymd) return false;
  return iso.slice(0, 10) === ymd;
};

// 互換キー
const KEY_V1 = "last-done-v1";
const KEY_V0 = "last-done";
const KEY_ALT = "lastDone";
const KEY_PREV = "last-done-prev-v1";

type LastDoneMap = Record<string, string>;
type LastPrevMap = Record<string, string | undefined>;

const COUNT_MAX = 99;

/** 小さなカレンダーアイコン（絵文字依存回避） */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

export default function RecordTab() {
  /* 設定→メタ */
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

  /* カテゴリ配列 */
  const [exercises, setExercises] = useState<ExercisesState | null>(null);
  useEffect(() => {
    if (Object.keys(meta).length === 0) return;
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
  }, [meta]);

  /* 当日レコード */
  const [dayRecord, setDayRecord] = useState<DayRecord>({
    date: todayStr,
    notesUpper: "",
    notesLower: "",
    notesOther: "",
    sets: {},
    counts: {},
    times: {},
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
        times: loaded.times ?? {},
      });
    }
  }, []);

  const persist = (rec: DayRecord) => {
    setDayRecord(rec);
    (saveDayRecord as any)(todayStr, rec);
  };

  /* 最終実施 */
  const [lastDone, setLastDone] = useState<LastDoneMap>({});
  const [lastPrev, setLastPrev] = useState<LastPrevMap>({});
  useEffect(() => {
    const v1 = loadJSON<LastDoneMap>(KEY_V1);
    const v0 = loadJSON<LastDoneMap>(KEY_V0);
    const alt = loadJSON<LastDoneMap>(KEY_ALT);
    setLastDone(v1 ?? v0 ?? alt ?? {});
    setLastPrev(loadJSON<LastPrevMap>(KEY_PREV) ?? {});
  }, []);

  const writeLastAll = (map: LastDoneMap, prev: LastPrevMap) => {
    try {
      window.localStorage.setItem(KEY_V1, JSON.stringify(map));
      window.localStorage.setItem(KEY_V0, JSON.stringify(map));
      window.localStorage.setItem(KEY_PREV, JSON.stringify(prev));
    } catch {}
  };

  const recomputeAndSyncLastDone = (exerciseId: string, record: DayRecord) => {
    const arr = record.times?.[exerciseId] ?? [];
    const valid = arr.filter((x): x is string => !!x);
    const latest = valid.length
      ? valid.reduce((a, b) => (a > b ? a : b))
      : undefined;

    setLastDone((cur) => {
      if (latest) {
        if (cur[exerciseId] !== latest) {
          setLastPrev((pp) => {
            const nextPrev = { ...pp, [exerciseId]: cur[exerciseId] };
            const next = { ...cur, [exerciseId]: latest };
            writeLastAll(next, nextPrev);
            return nextPrev;
          });
          return { ...cur, [exerciseId]: latest };
        }
        return cur;
      } else {
        if (isSameDay(cur[exerciseId], todayStr)) {
          const prevTime = lastPrev[exerciseId];
          const next = { ...cur };
          if (prevTime) next[exerciseId] = prevTime;
          else delete next[exerciseId];
          const nextPrev = { ...lastPrev };
          delete nextPrev[exerciseId];
          writeLastAll(next, nextPrev);
          setLastPrev(nextPrev);
          return next;
        }
        return cur;
      }
    });
  };

  /* チェック切替 */
  const toggleSet = (exerciseId: string, setIndex: number) => {
    const sets = { ...(dayRecord.sets || {}) };
    const arr = [...(sets[exerciseId] ?? [])];
    const nowOn = !arr[setIndex];
    arr[setIndex] = nowOn;
    sets[exerciseId] = arr;

    const times = { ...(dayRecord.times || {}) };
    const tArr = [...(times[exerciseId] ?? [])];
    times[exerciseId] = tArr;
    tArr[setIndex] = nowOn ? new Date().toISOString() : null;

    const next: DayRecord = { ...dayRecord, sets, times };
    persist(next);
    recomputeAndSyncLastDone(exerciseId, next);
  };

  /* 回数選択 */
  const changeCount = (exerciseId: string, setIndex: number, value: string) => {
    let n = Math.floor(Number(value || "0"));
    if (!Number.isFinite(n) || n < 0) n = 0;

    const counts = { ...(dayRecord.counts || {}) };
    const cArr = [...(counts[exerciseId] ?? [])];
    const needLen = Math.max(setIndex + 1, cArr.length);
    for (let i = 0; i < needLen; i++) if (cArr[i] == null) cArr[i] = 0;
    cArr[setIndex] = n;
    counts[exerciseId] = cArr;

    const times = { ...(dayRecord.times || {}) };
    const tArr = [...(times[exerciseId] ?? [])];
    times[exerciseId] = tArr;
    tArr[setIndex] = n > 0 ? new Date().toISOString() : null;

    const next: DayRecord = { ...dayRecord, counts, times };
    persist(next);
    recomputeAndSyncLastDone(exerciseId, next);
  };

  /* メモ欄 */
  const handleCatNotesChange = (cat: Category, value: string) => {
    if (cat === "upper") return persist({ ...dayRecord, notesUpper: value ?? "" });
    if (cat === "lower") return persist({ ...dayRecord, notesLower: value ?? "" });
    return persist({ ...dayRecord, notesOther: value ?? "" });
  };

  /* ラベル */
  const recoveryText = (exerciseId: string) => {
    const h = hoursSince(lastDone[exerciseId]);
    if (h == null) return "—";
    if (h < 1) return "<1H";
    return `${h}H`;
  };

  if (!exercises) {
    return <div>種目データがありません。（設定タブで種目を追加してください）</div>;
  }

  const catLabel = (c: string) =>
    c === "upper" ? "上半身" : c === "lower" ? "下半身" : "その他";

  // 右寄せエリア：幅は 5列分、セルは CSS 変数で制御（自動で少し縮む）
  const gridContainerStyle = {
    width: `min(100%, ${GRID_WIDTH_PX}px)`,
    ["--gap" as any]: `${GAP_PX}px`,
    ["--cell" as any]: `max(${MIN_CELL}px, calc((100% - ${(MAX_COLS - 1)} * var(--gap)) / ${MAX_COLS}))`,
  } as React.CSSProperties;

  return (
    <div className="space-y-4">
      {/* 右上に日付 */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarIcon className="w-5 h-5 text-slate-500" />
          <time dateTime={todayStr}>{fmtDateJP(todayStr)}</time>
        </div>
      </div>

      {Object.entries(exercises).map(([category, categoryExercises]) => {
        const cat = category as Category;
        const notesValue =
          cat === "upper"
            ? dayRecord.notesUpper ?? ""
            : cat === "lower"
            ? dayRecord.notesLower ?? ""
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="font-medium text-sm">{ex.name}</div>
                    <div className="ml-auto w-full sm:w-auto text-sm text-slate-500 text-right">
                      前回からのインターバル：{recoveryText(ex.id)}
                    </div>
                  </div>

                  {/* 2行目：右寄せ 5列グリッド（セルは box-border + min-w-0 で崩れ防止） */}
                  <div className="mt-2 ml-auto" style={gridContainerStyle}>
                    {mode === "count" ? (
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${MAX_COLS}, var(--cell))` }}
                      >
                        {Array.from({ length: setCount }).map((_, idx) => {
                          const cur = dayRecord.counts?.[ex.id]?.[idx] ?? 0;
                          return (
                            <Select
                              key={idx}
                              value={String(cur)}
                              onValueChange={(v) => changeCount(ex.id, idx, v)}
                            >
                              <SelectTrigger
                                className="box-border min-w-0 text-base px-0 rounded-md border text-center leading-none justify-center"
                                style={{ width: "var(--cell)", height: "var(--cell)" }}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                {Array.from({ length: COUNT_MAX + 1 }, (_, n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${MAX_COLS}, var(--cell))` }}
                      >
                        {Array.from({ length: setCount }).map((_, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-center rounded-md box-border min-w-0"
                            style={{ width: "var(--cell)", height: "var(--cell)" }}
                          >
                            <Checkbox
                              checked={dayRecord.sets?.[ex.id]?.[idx] || false}
                              onCheckedChange={() => toggleSet(ex.id, idx)}
                              className={[
                                "box-border rounded-md border-2",
                                "data-[state=checked]:[&_svg]:scale-[1.5]",
                                "[&_svg]:transition-transform",
                              ].join(" ")}
                              style={{ width: "var(--cell)", height: "var(--cell)" }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* カテゴリ別メモ */}
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
