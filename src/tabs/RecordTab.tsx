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
import { EXERCISES } from "../data/exercises";
import { cn } from "@/lib/utils";

/* ============== 型 ============== */
type DayRecordLike = {
  sets?: Record<string, boolean[]>;
  counts?: Record<string, number[]>;
  times?: Record<string, string[]>;
  notesUpper?: string | null;
  notesLower?: string | null;
  notesEtc?: string | null;
};
type TimesIndex = Record<string, number[]>;

/* ============== LocalStorage ============== */
const STORAGE_KEY_DAYRECORD = "workout.records.byday";

/* ============== 便利関数 ============== */
function normalizeDayRecord(input: DayRecordLike | null | undefined): DayRecord {
  const r = (input ?? {}) as DayRecordLike;
  return {
    sets: r.sets ?? {},
    counts: r.counts ?? {},
    times: r.times ?? {},
    notesUpper: r.notesUpper ?? "",
    notesLower: r.notesLower ?? "",
    notesEtc: r.notesEtc ?? "",
  };
}
function isDayRecordObject(v: any): v is DayRecordLike {
  return v && typeof v === "object";
}
function saveSafe(dateKey: string, r: DayRecord) {
  try {
    saveDayRecord(dateKey, r);
  } catch (e) {
    console.error(e);
    alert("保存に失敗しました（ローカルストレージ容量超過の可能性）");
  }
}
function padCounts(src: number[] | undefined, setCount: number) {
  const c = clampSets(setCount);
  return Array.from({ length: c }, (_, i) => (src?.[i] ?? 0));
}
function padChecks(src: boolean[] | undefined, setCount: number) {
  const c = clampSets(setCount);
  return Array.from({ length: c }, (_, i) => Boolean(src?.[i]));
}
function formatHours(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}時間${m}分`;
}
const clampSets = (n: number) =>
  Math.max(1, Math.min(10, isFinite(n) ? Math.floor(n) : 3));
const isBrowser = typeof window !== "undefined";
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
const EXPORT_FILENAME = "workoutrecord.latest";

/* ============== 直近数日分のレコード収集（SSR安全） ============== */
function collectAllDayRecords(days: number = 30): Record<string, DayRecord> {
  const map: Record<string, DayRecord> = {};
  if (!isBrowser) return map;

  try {
    const raw = loadJSON<Record<string, DayRecordLike>>(STORAGE_KEY_DAYRECORD) ?? {};
    const now = new Date();
    const keys = Object.keys(raw).filter((k) => {
      const d = new Date(k);
      const diff = Number(now) - Number(d);
      return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
    });
    keys.forEach((k) => (map[k] = normalizeDayRecord(raw[k])));
  } catch (e) {
    console.error(e);
  }
  return map;
}

/* ============== 現在の全データに対するシグネチャ ============== */
function calcRecordsSignature() {
  const src = collectAllDayRecords();
  const ordered = JSON.stringify(src, Object.keys(src).sort());
  let h = 0;
  for (let i = 0; i < ordered.length; i++) {
    h = (h << 5) - h + ordered.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

/* ============== hasAnyData ============== */
function hasAnyData(r?: Partial<DayRecord>) {
  if (!r) return false;
  if ((r.notesUpper ?? "") + (r.notesLower ?? "") + (r.notesEtc ?? "") !== "") return true;
  if (r.sets && Object.values(r.sets).some((a) => a?.some(Boolean))) return true;
  if (r.counts && Object.values(r.counts).some((a) => a?.some((n) => (n ?? 0) > 0))) return true;
  return false;
}

/* ============== メイン ============== */
export default function RecordTab() {
  /* ------ 日付 ------ */
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setToday(new Date()), 1000 * 60);
    return () => clearInterval(id);
  }, []);
  const todayStr = useMemo(() => toYmd(today), [today]);

  /* ------ 記録（当日） ------ */
  const [rec, setRec] = useState<DayRecord>(() => normalizeDayRecord(loadDayRecord(todayStr)));
  useEffect(() => {
    setRec(normalizeDayRecord(loadDayRecord(todayStr)));
  }, [todayStr]);

  /* ------ 保存促進バナーのための署名 ------ */
  const [currentSig, setCurrentSig] = useState(() => calcRecordsSignature());
  const [lastSaveSig, setLastSaveSig] = useState(() => currentSig);
  const shouldPromptSave = useMemo(() => currentSig !== lastSaveSig, [currentSig, lastSaveSig]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (shouldPromptSave) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldPromptSave]);

  const persist = () => {
    const normalized = normalizeDayRecord(rec);
    const current = loadDayRecord(todayStr) as DayRecord | null | undefined;
    if (!hasAnyData(normalized) && hasAnyData(current ?? undefined)) {
      if (current) setRec(current);
      return;
    }
    setRec(normalized);
    saveSafe(todayStr, normalized);
    setLastSaveSig(calcRecordsSignature());
    setCurrentSig(calcRecordsSignature());
  };

  /* ------ 全日データから直近「最後の1回」を取得（SSR安全） ------ */
  const timesIndex = useMemo(() => {
    if (!isBrowser) return {} as Record<string, number[]>;
    const all = collectAllDayRecords();
    const idx: Record<string, number[]> = {};
    Object.values(all).forEach((v: any) => {
      if (!isDayRecordObject(v)) return;
      const tmap = (v?.times ?? {}) as Record<string, string[]>;
      Object.entries(tmap).forEach(([exId, arr]) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((iso) => {
          const ts = Date.parse(String(iso));
          if (Number.isFinite(ts)) (idx[exId] ??= []).push(ts);
        });
      });
    });
    Object.keys(idx).forEach((k) => idx[k].sort((a, b) => a - b));
    return idx;
  }, [currentSig]);

  /* ---------- UI ---------- */

  const Banner = () =>
    shouldPromptSave ? (
      <div
        className="fixed top-0 left-0 right-0 z-50 text-center text-xs text-amber-700 bg-amber-50 border-b border-amber-200 py-1"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        aria-live="polite"
      >
        10日以上保存していません。右上の「保存」を押してください。
      </div>
    ) : null;

  const Header = () => (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <div className="mx-auto w-full max-w-none px-0 sm:px-8 py-2 flex items-center justify-between gap-2">
        <div className="text-xl font-semibold">筋トレ記録</div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded-md border text-xs bg-white hover:bg-slate-50"
            onClick={persist}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );

  const displayDate = useMemo(
    () =>
      `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(
        today.getDate()
      ).padStart(2, "0")}`,
    [today]
  );

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
        <SelectContent className="z-[60] max-h-[40vh] overflow-y-auto">
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
      aria-pressed={on}
    >
      {on ? "✓" : ""}
    </div>
  );

  const renderCategory = (cat: keyof ExercisesGrouped, label: string) => {
    const items = EXERCISES[cat];

    return (
      <Card className="mb-6 p-1 sm:p-5">
        <div className="mb-2 font-semibold">{label}</div>

        <div className="space-y-4">
          {items.map((it: ExerciseItem) => {
            const id = it.id;
            const mode = (it.mode ?? it.inputMode ?? "check") as InputMode;
            const setCount = clampSets(it.sets ?? it.checkCount ?? 3);

            const countsArr = padCounts(rec.counts?.[id], setCount);
            const checksArr = padChecks(rec.sets?.[id], setCount);
            const arrLen = mode === "count" ? countsArr.length : checksArr.length;

            // ★ インターバル（最後の記録からの経過時間）
            const arr = timesIndex[id] ?? [];
            let intervalMs: number | undefined;
            if (arr.length >= 1) {
              const lastTs = arr[arr.length - 1];
              intervalMs = Math.max(0, Date.now() - lastTs);
            }

            return (
              <div key={id} className="p-1 sm:p-4 overflow-hidden">
                <div className="text-sm text-slate-700 break-words font-medium">
                  {it.name}
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

                              // ★ 追加（最小差分）：値が変わったときだけタイムスタンプを追記
                              const prevTimes = (prev.times?.[id] ?? []);
                              const nextTimes =
                                prevVal !== v
                                  ? [...prevTimes, new Date().toISOString()]
                                  : prevTimes;

                              const next: DayRecord = {
                                ...prev,
                                counts: { ...(prev.counts ?? {}), [id]: nextCounts },
                                times: { ...(prev.times ?? {}), [id]: nextTimes },
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
                              setCurrentSig(calcRecordsSignature());
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
                              aria-label={`${it.name} セット${idx + 1}を${on ? "解除" : "完了"}`}
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
                setCurrentSig(calcRecordsSignature());
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
                setCurrentSig(calcRecordsSignature());
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
                setCurrentSig(calcRecordsSignature());
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
        {/* バナー */}
        <Banner />
        {/* ヘッダ */}
        <Header />

        <div className="mx-auto w-full max-w-none px-0 sm:px-8 pt-4">
          <div className="text-slate-700">{displayDate}</div>
        </div>

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

/* ============== 追加ユーティリティ ============== */
/** 設定風エクスポート（SSR安全） */
function saveAsJsonLikeSetting(key: string, data: any) {
  if (!isBrowser) return;
  try {
    const all = loadJSON<Record<string, DayRecordLike>>(key) ?? {};
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
