"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";
import type {
  ExerciseItem,
  ExercisesByCategory as ExercisesGrouped,
  DayRecord,
  InputMode,
} from "@/types/record";
import { EXERCISES } from "@/data/exercises";
import { cn } from "@/lib/utils";

/* ============== 型 ============== */
type TimesIndex = Record<string, string[]>;

/* ============== LocalStorage ============== */
const STORAGE_KEY_DAYRECORD = "workout.records.byday";

/* ============== カード ============== */
function saveSafe(dateKey: string, r: DayRecord) {
  try {
    saveDayRecord(dateKey, r);
  } catch (e) {
    console.error(e);
    alert("保存に失敗しました（ローカルストレージ容量超過の可能性）");
  }
}

/* ============== ヘッダバナー ============== */
function Banner() {
  return (
    <div className="w-full bg-slate-50 border-b border-slate-200">
      <div className="max-w-5xl mx-auto py-3 px-4 sm:px-6">
        <div className="text-xs text-slate-500">
          筋トレ記録アプリ — ローカル保存 / set & count / インターバル表示
        </div>
      </div>
    </div>
  );
}

/* ============== メイン ============== */
export default function RecordTab() {
  /* ---------------- 日付 ---------------- */
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setToday(new Date()), 1000 * 60);
    return () => clearInterval(id);
  }, []);
  const todayStr = useMemo(() => toYmd(today), [today]);
  const displayDate = useMemo(
    () =>
      `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(
        2,
        "0"
      )}/${String(today.getDate()).padStart(2, "0")}`,
    [today]
  );

  /* ---------------- 記録（当日） ---------------- */
  const [rec, setRec] = useState<DayRecord>(() => loadDayRecord(todayStr));
  useEffect(() => {
    setRec(loadDayRecord(todayStr));
  }, [todayStr]);

  /* ---------------- 直近数日から timesIndex を構築 ---------------- */
  const [currentSig, setCurrentSig] = useState("");
  const [timesIndex, setTimesIndex] = useState<TimesIndex>({});

  useEffect(() => {
    const all = collectAllDayRecords();
    setTimesIndex(buildTimesIndex(all));
    setCurrentSig(calcRecordsSignature(all));
  }, []);

  useEffect(() => {
    const all = collectAllDayRecords();
    setTimesIndex(buildTimesIndex(all));
  }, [currentSig]);

  /* ---------------- UI ---------------- */
  const Header = () => (
    <div className="w-full bg-white">
      <div className="mx-auto w-full max-w-none px-0 sm:px-8 pt-4">
        <div className="text-xl font-semibold">筋トレ記録</div>
      </div>

      <div className="mx-auto w-full max-w-none px-0 sm:px-8 pb-2">
        <div className="text-slate-700">{displayDate}</div>
      </div>
    </div>
  );

  // 50px 正方形
  const SquareCount = ({
    value,
    onChange,
    max,
  }: {
    value: number;
    onChange: (v: number) => void;
    max: number;
  }) => (
    <div className="inline-block">
      <Select value={String(value)} onValueChange={(s) => onChange(Number(s))}>
        <SelectTrigger className="w-[50px] h-[50px] justify-center">
          <SelectValue placeholder="0" />
        </SelectTrigger>
        <SelectContent
          className="z-[60] max-h-[40vh] overflow-y-auto"
        >
          {Array.from({ length: Math.min(max, 15) + 1 }, (_, n) => n).map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const SquareCheck = ({ on }: { on: boolean }) => (
    <div
      className={`w-[50px] h-[50px] min-w-[50px] min-h-[50px] rounded-md border text-center text-xl leading-[50px] ${
        on ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-300"
      }`}
    >
      {on ? "✓" : ""}
    </div>
  );

  /* ---------------- カテゴリレンダリング ---------------- */
  const renderCategory = (cat: keyof ExercisesGrouped, label: string) => {
    const items = EXERCISES[cat];

    return (
      <Card className="mb-6 p-1 sm:p-5">
        <div className="mb-2 font-semibold">{label}</div>

        <div className="space-y-4">
          {items.map((it) => {
            const id = it.id;
            const mode = (it.mode ?? it.inputMode ?? "check") as InputMode;
            const setCount = clampSets(it.sets ?? it.checkCount ?? 3);

            const countsArr = padCounts(rec.counts?.[id], setCount);
            const checksArr = padChecks(rec.sets?.[id], setCount);
            const arrLen = mode === "count" ? countsArr.length : checksArr.length;

            // ★ 修正点：最後に実施した時刻から現在までの経過時間
            const arr = timesIndex[id] ?? [];
            const last = arr.length ? arr[arr.length - 1] : undefined;
            const intervalMs =
              last !== undefined ? Date.now() - new Date(last).getTime() : undefined;

            const max = Math.min(it.repTarget ?? 15, 15);

            return (
              <div key={id} className="border border-slate-200 rounded-xl p-3 sm:p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-slate-500">
                    目標 {it.repTarget ? `${it.repTarget} 回 × ${setCount} セット` : `${setCount} セット`}
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-500 text-right">
                  前回からのインターバル：{intervalMs !== undefined ? formatHours(intervalMs) : "0時間"}
                </div>

                {/* 入力列：右寄せ（実ボックス数ぶんだけ列を生成） */}
                <div className="mt-2 w-full overflow-hidden pr-0 flex justify-end">
                  <div
                    className="
                      inline-grid shrink-0
                      gap-x-2 gap-y-3
                      justify-items-end content-start
                    "
                    style={{ gridTemplateColumns: `repeat(${arrLen}, 50px)` }}
                  >
                    {mode === "count"
                      ? countsArr.map((val, idx) => {
                          const update = (v: number) => {
                            setRec((prev) => {
                              const prevCounts = padCounts(prev.counts?.[id], setCount);
                              const nextCounts = [...prevCounts];
                              const prevVal = prevCounts[idx];
                              nextCounts[idx] = v;

                              // ★ countモードでも実施時刻を記録（値が変わったときだけ）
                              const prevTimes = prev.times?.[id] ?? [];
                              const nextTimes = (prevVal !== v)
                                ? [...prevTimes, new Date().toISOString()]
                                : prevTimes;

                              const next: DayRecord = {
                                ...prev,
                                counts: { ...(prev.counts ?? {}), [id]: nextCounts },
                                times:  { ...(prev.times  ?? {}), [id]: nextTimes },
                                notesUpper: prev.notesUpper ?? "",
                                notesLower: prev.notesLower ?? "",
                                notesEtc: prev.notesEtc ?? "",
                              };
                              saveSafe(todayStr, next);
                              setCurrentSig(calcRecordsSignature());
                              return next;
                            });
                          };
                          const max = Math.min(it.repTarget ?? 15, 15);
                          return (
                            <SquareCount
                              key={`${id}-count-${idx}`}
                              value={val}
                              onChange={update}
                              max={max}
                            />
                          );
                        })
                      : checksArr.map((on, idx) => {
                          const toggle = () => {
                            setRec((prev) => {
                              const prevChecks = padChecks(prev.sets?.[id], setCount);
                              const nowOn = !prevChecks[idx];
                              const nextChecks = [...prevChecks];
                              nextChecks[idx] = nowOn;

                              const prevTimes = prev.times?.[id] ?? [];
                              const nextTimes = nowOn
                                ? [...prevTimes, new Date().toISOString()]
                                : prevTimes;

                              const next: DayRecord = {
                                ...prev,
                                sets: { ...(prev.sets ?? {}), [id]: nextChecks },
                                times: { ...(prev.times ?? {}), [id]: nextTimes },
                                notesUpper: prev.notesUpper ?? "",
                                notesLower: prev.notesLower ?? "",
                                notesEtc: prev.notesEtc ?? "",
                              };
                              saveSafe(todayStr, next);
                              setCurrentSig(calcRecordsSignature()); // → timesIndex再構築
                              return next;
                            });
                          };
                          return (
                            <button
                              key={`${id}-check-${idx}`}
                              className={cn(
                                "inline-block",
                                "disabled:opacity-50 disabled:pointer-events-none"
                              )}
                              onClick={toggle}
                            >
                              <SquareCheck on={on} />
                            </button>
                          );
                        })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* メモ欄 */}
        <div className="mt-5 space-y-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">上半身メモ</div>
            <Textarea
              value={rec.notesUpper ?? ""}
              onChange={(e) => {
                const next = { ...rec, notesUpper: e.target.value ?? "" };
                setRec(next);
                saveSafe(todayStr, next);
              }}
              placeholder="上半身に関するメモを記入"
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">下半身メモ</div>
            <Textarea
              value={rec.notesLower ?? ""}
              onChange={(e) => {
                const next = { ...rec, notesLower: e.target.value ?? "" };
                setRec(next);
                saveSafe(todayStr, next);
              }}
              placeholder="下半身に関するメモを記入"
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">その他メモ</div>
            <Textarea
              value={rec.notesEtc ?? ""}
              onChange={(e) => {
                const next = { ...rec, notesEtc: e.target.value ?? "" };
                setRec(next);
                saveSafe(todayStr, next);
              }}
              placeholder="その他のメモを記入"
            />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className="w-full">
        <Banner />
        <Header />

        {/* 外枠：スマホは左右余白ゼロ */}
        <div className="w-full max-w-none px-0 sm:px-8 py-4">
          {renderCategory("upper", "上半身")}
          {renderCategory("lower", "下半身")}
          {renderCategory("etc", "その他")}
        </div>
      </div>
    </>
  );
}

/* ============== Utils ============== */
const EXPORT_FILENAME = "workoutrecord.latest";
const isBrowser = typeof window !== "undefined";

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const clampSets = (n: number) =>
  Math.max(1, Math.min(10, isFinite(n) ? Math.floor(n) : 3));

const padCounts = (src: number[] | undefined, setCount: number) => {
  const c = clampSets(setCount);
  const base = Array.from({ length: c }, (_, i) => (src?.[i] ?? 0));
  return base;
};
const padChecks = (src: boolean[] | undefined, setCount: number) => {
  const c = clampSets(setCount);
  const base = Array.from({ length: c }, (_, i) => Boolean(src?.[i]));
  return base;
};

/** 直近数日分のレコードを収集（当日含む） */
function collectAllDayRecords(days: number = 30): Record<string, DayRecord> {
  const map: Record<string, DayRecord> = {};
  if (!isBrowser) return map;

  try {
    const raw = loadJSON<Record<string, DayRecord>>(STORAGE_KEY_DAYRECORD) ?? {};
    // 最近のキーだけ拾う
    const now = new Date();
    const keys = Object.keys(raw).filter((k) => {
      const d = new Date(k);
      const diff = Number(now) - Number(d);
      return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
    });
    keys.forEach((k) => (map[k] = raw[k]));
  } catch (e) {
    console.error(e);
  }
  return map;
}

/** timesIndex を構築：種目ID => 時刻配列 */
function buildTimesIndex(all: Record<string, DayRecord>): TimesIndex {
  const idx: TimesIndex = {};
  Object.values(all).forEach((dr) => {
    if (!dr?.times) return;
    Object.entries(dr.times).forEach(([id, arr]) => {
      if (!idx[id]) idx[id] = [];
      arr?.forEach((t) => idx[id].push(t));
    });
  });
  // 時系列で昇順
  Object.keys(idx).forEach((id) => {
    idx[id].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  });
  return idx;
}

/** 現在の全データに対するシグネチャ（timesIndex再構築のトリガ用） */
function calcRecordsSignature(all?: Record<string, DayRecord>) {
  const src = all ?? collectAllDayRecords();
  const ordered = JSON.stringify(src, Object.keys(src).sort());
  return hashString(ordered);
};

const hasAnyData = (r?: Partial<DayRecord>) => {
  if (!r) return false;
  if ((r.notesUpper ?? "") + (r.notesLower ?? "") + (r.notesEtc ?? "") !== "")
    return true;
  if (r.sets && Object.values(r.sets).some((a) => a?.some(Boolean))) return true;
  if (r.counts && Object.values(r.counts).some((a) => a?.some((n) => (n ?? 0) > 0)))
    return true;
  return false;
};

/** 設定風エクスポート（SSR安全） */
function saveAsJsonLikeSetting(key: string, data: any) {
  if (!isBrowser) return;
  try {
    const all = loadJSON<Record<string, DayRecord>>(key) ?? {};
    const now = new Date();
    const name = `${EXPORT_FILENAME}.${toYmd(now)}.json`;
    const blob = new Blob([JSON.stringify(all, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } catch (e) {
    console.error(e);
  }
}

/** 簡易ハッシュ */
function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}
