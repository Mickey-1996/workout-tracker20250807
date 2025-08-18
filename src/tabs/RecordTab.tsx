// src/tabs/RecordTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import type {
  ExerciseItem,
  ExercisesByCategory as ExercisesGrouped,
  DayRecord,
  InputMode,
  Category,
} from "@/lib/types";

/* ----- 型（保存時に必須化） ----- */
type DayRecordStrict = Omit<
  DayRecord,
  "notesUpper" | "notesLower" | "notesEtc" | "times" | "sets" | "counts"
> & {
  notesUpper: string;
  notesLower: string;
  notesEtc: string;
  times: Record<string, string[]>;
  sets: Record<string, boolean[]>;
  counts: Record<string, number[]>;
};

/* ----- ユーティリティ ----- */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function makeSetArray(n: number): number[] {
  const c = Math.max(1, Math.min(10, isFinite(n) ? Math.floor(n) : 3));
  return Array.from({ length: c }, (_, i) => i);
}
function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename; // 常に workoutrecord.latest
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return (h >>> 0).toString(16);
}
function collectAllDayRecords(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("day:")) {
      try { out[k] = JSON.parse(localStorage.getItem(k) || "{}"); } catch {}
    }
  }
  return out;
}
function calcRecordsSignature(): string {
  const obj = collectAllDayRecords();
  const ordered = Object.keys(obj).sort().map(k => `${k}:${JSON.stringify(obj[k])}`).join("|");
  return hashString(ordered);
}
function hasAnyData(r: DayRecord | DayRecordStrict | null | undefined) {
  if (!r) return false;
  const anySets   = r.sets   && Object.values(r.sets).some((arr) => (arr ?? []).some(Boolean));
  const anyCounts = r.counts && Object.values(r.counts).some((arr) => (arr ?? []).some((n) => (n ?? 0) > 0));
  const anyTimes  = r.times  && Object.values(r.times).some((arr) => (arr ?? []).length > 0);
  const anyNotes  = (r.notesUpper ?? "") + (r.notesLower ?? "") + (r.notesEtc ?? "") + ((r as any).notesOther ?? "");
  return Boolean(anySets || anyCounts || anyTimes || anyNotes.trim());
}

/* ----- 設定ロード ----- */
function loadExercises(): ExercisesGrouped {
  const v2 = loadJSON<any>("wt:settings.v2");
  if (v2?.items && Array.isArray(v2.items)) {
    const grouped: ExercisesGrouped = { upper: [], lower: [], etc: [] };
    for (const it of v2.items as any[]) {
      const item: ExerciseItem = {
        id: String(it.id ?? ""),
        name: String(it.name ?? ""),
        category: (it.category ?? "etc") as Category,
        enabled: Boolean(it.enabled ?? true),
        mode: (it.mode ?? it.inputMode ?? "check") as InputMode,
        inputMode: (it.inputMode ?? it.mode) as InputMode | undefined,
        sets: typeof it.sets === "number" ? it.sets : typeof it.checkCount === "number" ? it.checkCount : 3,
        checkCount: it.checkCount,
        repTarget: it.repTarget,
        order: it.order,
      };
      (item.category === "upper" ? grouped.upper
        : item.category === "lower" ? grouped.lower
        : grouped.etc).push(item);
    }
    for (const k of ["upper", "lower", "etc"] as const) {
      grouped[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return grouped;
  }
  const raw = loadJSON<any>("exercises");
  if (raw?.upper || raw?.lower || raw?.etc) {
    return { upper: raw.upper ?? [], lower: raw.lower ?? [], etc: raw.etc ?? [] };
  }
  const legacy = loadJSON<any>("wt:settings");
  if (legacy?.upper || legacy?.lower || legacy?.etc) {
    return { upper: legacy.upper ?? [], lower: legacy.lower ?? [], etc: legacy.etc ?? [] };
  }
  return { upper: [], lower: [], etc: [] };
}

/* ----- 本体 ----- */
export default function RecordTab() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toYmd(today), [today]);
  const displayDate = useMemo(
    () => `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月${String(today.getDate()).padStart(2, "0")}日`,
    [today]
  );

  const [exercises, setExercises] = useState<ExercisesGrouped>({ upper: [], lower: [], etc: [] });

  const [rec, setRec] = useState<DayRecord>({
    date: todayStr,
    times: {},
    sets: {},
    counts: {},
    notesUpper: "",
    notesLower: "",
    notesEtc: "",
  });

  // 変更検知用
  const [lastDiskSaveAt, setLastDiskSaveAt] = useState<number>(0);
  const [lastSavedSig, setLastSavedSig] = useState<string>("");
  const [currentSig, setCurrentSig] = useState<string>("");

  useEffect(() => {
    try { setExercises(loadExercises()); } catch {}

    try {
      const loaded = loadDayRecord(todayStr) as DayRecord | null | undefined;
      if (loaded) {
        setRec({
          ...loaded,
          notesUpper: loaded.notesUpper ?? "",
          notesLower: loaded.notesLower ?? "",
          notesEtc: loaded.notesEtc ?? "",
          ...(loaded as any).notesOther !== undefined ? { notesOther: (loaded as any).notesOther } : {},
        });
      }
    } catch {}

    try {
      const t = Number(localStorage.getItem("wt:lastDiskSaveAt") || 0);
      setLastDiskSaveAt(t);
      setLastSavedSig(localStorage.getItem("wt:lastSavedSig") ?? "");
      setCurrentSig(calcRecordsSignature());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hoursSinceSave = useMemo(() => {
    if (!lastDiskSaveAt) return Infinity;
    return (Date.now() - lastDiskSaveAt) / (1000 * 60 * 60);
  }, [lastDiskSaveAt]);
  const shouldPromptSave = hoursSinceSave > 24 * 10;
  const hasUnsavedChanges = currentSig !== "" && lastSavedSig !== "" && currentSig !== lastSavedSig;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges || shouldPromptSave) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges, shouldPromptSave]);

  // 保存ヘルパー
  const persist = (next: DayRecord) => {
    const normalized: DayRecordStrict = {
      date: next.date,
      times: (next.times ?? {}) as Record<string, string[]>,
      sets: (next.sets ?? {}) as Record<string, boolean[]>,
      counts: (next.counts ?? {}) as Record<string, number[]>,
      notesUpper: next.notesUpper ?? "",
      notesLower: next.notesLower ?? "",
      notesEtc: next.notesEtc ?? "",
    };
    const current = loadDayRecord(todayStr) as DayRecord | null | undefined;
    if (!hasAnyData(normalized) && hasAnyData(current ?? undefined)) {
      if (current) setRec(current);
      return;
    }
    setRec(normalized);
    saveDayRecord(todayStr, normalized);
    setCurrentSig(calcRecordsSignature());
  };

  // タップ時刻記録
  const markDone = (id: string) => {
    const iso = new Date().toISOString();
    persist({
      ...rec,
      times: { ...(rec.times ?? {}), [id]: [...(rec.times?.[id] ?? []), iso] },
    });
  };

  /* ===== UI ===== */

  // 最上部バナー（「ディスクに」は削除済み）
  const Banner = () =>
    shouldPromptSave ? (
      <div className="fixed top-0 left-0 right-0 z-50 text-center text-[11px] sm:text-xs text-amber-700 bg-amber-50 border-b border-amber-200 py-1">
        10日以上保存していません。右上の「保存」を押してください。
      </div>
    ) : null;

  // ヘッダー（保存ボタン／日付）
  const Header = () => (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-2 flex items-center justify-end">
        {hasUnsavedChanges && <span className="mr-3 text-xs text-rose-600">未保存の変更があります</span>}
        <button
          type="button"
          className="rounded-md border px-3 py-1 text-sm hover:bg-slate-50"
          onClick={() => {
            const payload = collectAllDayRecords();
            downloadJSON("workoutrecord.latest", payload);
            const sig = calcRecordsSignature();
            const t = Date.now();
            localStorage.setItem("wt:lastDiskSaveAt", String(t));
            localStorage.setItem("wt:lastSavedSig", sig);
            setLastDiskSaveAt(t);
            setLastSavedSig(sig);
            setCurrentSig(sig);
          }}
          aria-label="記録データを保存"
        >
          保存
        </button>
      </div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-2">
        <div className="text-slate-700">{displayDate}</div>
      </div>
    </div>
  );

  const renderCategory = (key: "upper" | "lower" | "etc", label: string) => {
    const items = exercises[key].filter((it) => it.enabled ?? true);
    return (
      <Card className="mb-6 p-4">
        <div className="mb-2 font-semibold">{label}</div>
        <div className="space-y-4">
          {items.map((it) => {
            const id = it.id;
            const mode = (it.mode ?? it.inputMode ?? "check") as InputMode;
            const setCount = it.sets ?? it.checkCount ?? 3;

            // インターバル
            const times = rec.times?.[id] ?? [];
            const n = times.length;
            const last = n ? new Date(times[n - 1]) : null;
            const prev = n > 1 ? new Date(times[n - 2]) : null;
            const intervalMs =
              last && prev ? last.getTime() - prev.getTime() : last ? Date.now() - last.getTime() : undefined;

            return (
              <div key={id} className="rounded-lg border border-slate-200 p-3">
                {/* 1行目：種目名 */}
                <div className="text-sm text-slate-700 break-words font-medium">{it.name}</div>

                {/* 2行目：インターバル（単独行） */}
                <div className="mt-2 text-xs text-slate-500">
                  前回からのインターバル：{intervalMs !== undefined ? formatDuration(intervalMs) : "—"}
                </div>

                {/* 3行目：入力UI（右寄せ・5列で折返し） */}
                <div className="mt-2">
                  {mode === "count" ? (
                    <div className="flex justify-end">
                      <div className="grid grid-cols-5 gap-2">
                        {(rec.counts?.[id] ?? Array.from({ length: setCount }, () => 0)).map((val, idx) => {
                          const update = (v: number) => {
                            const prevCounts = rec.counts?.[id] ?? Array.from({ length: setCount }, () => 0);
                            const next = [...prevCounts];
                            next[idx] = v;
                            persist({ ...rec, counts: { ...(rec.counts ?? {}), [id]: next } });
                          };
                          const max = it.repTarget ?? 20;
                          return (
                            <div key={idx} className="h-8">
                              <Select value={String(val)} onValueChange={(v) => update(Number(v))}>
                                <SelectTrigger className="h-8 w-16">
                                  <SelectValue placeholder="0" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: max + 1 }, (_, n) => n).map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="grid grid-cols-5 gap-2">
                        {makeSetArray(setCount).map((idx) => {
                          const checks = rec.sets?.[id] ?? Array.from({ length: setCount }, () => false);
                          const toggle = () => {
                            const nextChecks = [...checks];
                            nextChecks[idx] = !nextChecks[idx];
                            const next = { ...rec, sets: { ...(rec.sets ?? {}), [id]: nextChecks } };
                            persist(next);
                            if (nextChecks[idx]) markDone(id);
                          };
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={toggle}
                              className={`w-8 h-8 rounded-md border ${
                                checks[idx] ? "bg-emerald-500 border-emerald-600 text-white" : "border-slate-300"
                              }`}
                              aria-label="チェック"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* カテゴリメモ */}
        <div className="mt-4">
          <div className="mb-1 text-xs text-slate-500">メモ（{label}）</div>
          <Textarea
            value={key === "upper" ? rec.notesUpper : key === "lower" ? rec.notesLower : rec.notesEtc}
            onChange={(e) => {
              const v = e.target.value;
              const next: DayRecord = {
                ...rec,
                notesUpper: key === "upper" ? v : (rec.notesUpper ?? ""),
                notesLower: key === "lower" ? v : (rec.notesLower ?? ""),
                notesEtc: key === "etc" ? v : (rec.notesEtc ?? ""),
              };
              persist(next);
            }}
          />
        </div>
      </Card>
    );
  };

  return (
    <>
      {/* 最上部バナー（固定） */}
      <Banner />

      {/* バナー表示時は上に余白を確保して重なり防止 */}
      <div className={shouldPromptSave ? "pt-7 sm:pt-8" : ""}>
        {/* ヘッダー */}
        <Header />

        {/* 本文 */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
          {renderCategory("upper", "上半身")}
          {renderCategory("lower", "下半身")}
          {renderCategory("etc", "その他")}
        </div>
      </div>
    </>
  );
}

/* ----- 末尾の小関数 ----- */
function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}時間${m}分${sec}秒` : m > 0 ? `${m}分${sec}秒` : `${sec}秒`;
}
