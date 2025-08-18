// src/tabs/RecordTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";
import type { DayRecord, Category, InputMode } from "@/lib/types";

/* Inline SVG (no dependency) */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" ry="2" strokeWidth="1.5" />
      <line x1="3" y1="9" x2="21" y2="9" strokeWidth="1.5" />
      <line x1="8" y1="2.5" x2="8" y2="6" strokeWidth="1.5" />
      <line x1="16" y1="2.5" x2="16" y2="6" strokeWidth="1.5" />
    </svg>
  );
}

/* Utilities */
function toYmd(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
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

/* exercises grouped (any for backward compat) */
type ExercisesGrouped = { upper: any[]; lower: any[]; etc: any[]; };

function loadExercises(): ExercisesGrouped {
  const v2 = loadJSON<any>("wt:settings.v2");
  if (v2?.items && Array.isArray(v2.items)) {
    const grouped: ExercisesGrouped = { upper: [], lower: [], etc: [] };
    for (const it of v2.items as any[]) {
      const item = {
        id: String(it.id ?? ""), name: String(it.name ?? ""),
        category: (it.category ?? "etc") as Category,
        enabled: Boolean(it.enabled ?? true),
        inputMode: (it.inputMode ?? it.mode ?? "check") as InputMode,
        sets: typeof it.sets === "number" ? it.sets : typeof it.checkCount === "number" ? it.checkCount : 3,
        repTarget: it.repTarget, order: it.order,
      };
      (item.category === "upper" ? grouped.upper : item.category === "lower" ? grouped.lower : grouped.etc).push(item);
    }
    for (const k of ["upper", "lower", "etc"] as const) grouped[k].sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
    return grouped;
  }
  const legacy = loadJSON<any>("exercises") ?? loadJSON<any>("settings");
  if (legacy?.upper || legacy?.lower || legacy?.etc) {
    const grouped: ExercisesGrouped = { upper: [], lower: [], etc: [] };
    for (const k of ["upper", "lower", "etc"] as const) {
      for (const it of (legacy[k] ?? []) as any[]) {
        grouped[k].push({
          id: String(it.id ?? ""), name: String(it.name ?? ""), category: k as Category,
          enabled: Boolean(it.enabled ?? true),
          inputMode: (it.inputMode ?? it.mode ?? "check") as InputMode,
          sets: typeof it.sets === "number" ? it.sets : typeof it.checkCount === "number" ? it.checkCount : 3,
          repTarget: it.repTarget, order: it.order,
        });
      }
    }
    for (const k of ["upper", "lower", "etc"] as const) grouped[k].sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
    return grouped;
  }
  return { upper: [], lower: [], etc: [] };
}

/* empty DayRecord (type-safe) */
function makeEmptyDayRecord(date: string): DayRecord {
  return { date, notes: "", notesUpper: "", notesLower: "", sets: {} } as DayRecord;
}

/* Component */
export default function RecordTab() {
  const today = new Date();
  const todayStr = toYmd(today);

  const [exercises, setExercises] = useState<ExercisesGrouped>({ upper: [], lower: [], etc: [] });
  const [rec, setRec] = useState<DayRecord>(() => loadDayRecord(todayStr) ?? makeEmptyDayRecord(todayStr));

  const [lastDiskSaveAt, setLastDiskSaveAt] = useState<number | null>(null);
  const [lastSavedSig, setLastSavedSig] = useState<string>("");
  const [currentSig, setCurrentSig] = useState<string>("");

  useEffect(() => {
    setExercises(loadExercises());
    try {
      const t = localStorage.getItem("wt:lastDiskSaveAt"); if (t) setLastDiskSaveAt(Number(t));
      const sig = localStorage.getItem("wt:lastSavedSig") ?? ""; setLastSavedSig(sig);
      setCurrentSig(calcRecordsSignature());
    } catch {}
  }, []);

  const hoursSinceSave = useMemo(() => !lastDiskSaveAt ? Infinity : (Date.now() - lastDiskSaveAt) / 36e5, [lastDiskSaveAt]);
  const shouldPromptSave = hoursSinceSave > 24 * 10;
  const hasUnsavedChanges = currentSig !== "" && lastSavedSig !== "" && currentSig !== lastSavedSig;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (hasUnsavedChanges || shouldPromptSave) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges, shouldPromptSave]);

  // NOTE: keep possible extra fields (like reps) without typing them on DayRecord
  const persist = (next: any) => {
    const normalized: any = {
      ...next,
      notesUpper: next?.notesUpper ?? "",
      notesLower: next?.notesLower ?? "",
      sets: next?.sets ?? {},
      // keep next.reps if it exists, but don't require it
      ...(next?.reps ? { reps: next.reps } : {}),
    };
    saveDayRecord(todayStr, normalized as DayRecord);
    setRec(normalized as DayRecord);
    setCurrentSig(calcRecordsSignature());
  };

  const [doneIds, setDoneIds] = useState<string[]>([]);
  const markDone = (id: string) => setDoneIds(cur => (cur.includes(id) ? cur : [...cur, id]));

  const renderCategory = (category: Category, title: string) => {
    const items = (exercises[category] ?? []).filter((it: any) => it.enabled !== false);
    const sorted = [...items.filter((it: any) => !doneIds.includes(it.id)), ...items.filter((it: any) => doneIds.includes(it.id))];

    const memoLabel = category === "upper" ? "上半身メモ" : category === "lower" ? "下半身メモ" : "その他メモ";

    return (
      <>
        <h2 className="mb-2 mt-6 text-lg font-semibold">{title}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((it: any) => {
            const mode: InputMode = (it.inputMode ?? it.mode ?? "check") as InputMode;
            const setCount: number = typeof it.sets === "number" ? it.sets : typeof it.checkCount === "number" ? it.checkCount : 3;
            const repTarget: number = typeof it.repTarget === "number" ? it.repTarget : 10;
            return (
              <Card key={it.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-slate-500">{mode === "reps" ? "回数入力" : "チェック"}</div>
                </div>
                {mode === "reps" ? (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500">目標回数</div>
                    <RepInput rec={rec} id={it.id} target={repTarget} onChange={persist} markDone={markDone} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500">セット数</div>
                    <CheckInput rec={rec} id={it.id} setCount={setCount} onChange={persist} markDone={markDone} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* カテゴリ別メモ（元の文言に復帰） */}
        <div className="mt-6">
          <div className="text-sm text-slate-600 mb-1">{memoLabel}</div>
          <Textarea
            value={
              category === "upper" ? (rec as any).notesUpper ?? ""
              : category === "lower" ? (rec as any).notesLower ?? ""
              : (rec as any).notesEtc ?? ""
            }
            onChange={(e) => {
              const v = e.target.value;
              const next: any = {
                ...rec,
                notesUpper: category === "upper" ? v : (rec as any).notesUpper ?? "",
                notesLower: category === "lower" ? v : (rec as any).notesLower ?? "",
                ...(category === "etc" ? { notesEtc: v } : {}),
              };
              persist(next);
            }}
            placeholder="(例) アーチャープッシュアップも10回やった"
          />
        </div>
      </>
    );
  };

  const displayDate = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月${String(today.getDate()).padStart(2, "0")}日`;

  return (
    <>
      {shouldPromptSave && (
        <div className="fixed top-0 left-0 right-0 z-50 text-center text-xs text-amber-700 bg-amber-50 border-b border-amber-200 py-1" role="status" aria-live="polite">
          10日以上ディスクに保存していません。右上の「保存」を押してください。
        </div>
      )}

      <div className="p-4 sm:p-6">
        {/* 保存ボタン（右上） */}
        <div className="mb-1 flex items-center justify-end">
          {hasUnsavedChanges && <span className="mr-3 text-xs text-rose-600">未保存の変更があります</span>}
          <button
            type="button"
            className="rounded-md border px-3 py-1 text-sm hover:bg-slate-50"
            onClick={() => {
              const filename = `record-latest.json`; // 方式B 固定名
              const payload = collectAllDayRecords();
              downloadJSON(filename, payload);
              const sig = calcRecordsSignature(); const t = Date.now();
              localStorage.setItem("wt:lastDiskSaveAt", String(t));
              localStorage.setItem("wt:lastSavedSig", sig);
              setLastDiskSaveAt(t); setLastSavedSig(sig); setCurrentSig(sig);
            }}
            aria-label="記録データを端末に保存"
          >
            保存
          </button>
        </div>

        {/* 日付（左寄せ） */}
        <div className="mb-4 flex items-center justify-start">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="w-5 h-5 text-slate-500" />
            <time dateTime={todayStr}>{displayDate}</time>
          </div>
        </div>

        {renderCategory("upper", "上半身")}
        {renderCategory("lower", "下半身")}
        {exercises.etc?.length ? renderCategory("etc", "その他") : null}
      </div>
    </>
  );
}

/* Inputs */
function RepInput({
  rec, id, target, onChange, markDone,
}: { rec: DayRecord; id: string; target: number; onChange: (next: any) => void; markDone: (id: string) => void; }) {
  const currentReps = (rec as any).reps ?? {};
  const [val, setVal] = useState<number>(Number(currentReps[id] ?? 0));
  useEffect(() => {
    setVal(Number(((rec as any).reps ?? {})[id] ?? 0));
  }, [rec, id]);

  return (
    <div className="flex items-center gap-2">
      <input
        className="w-24 rounded-md border px-2 py-1 text-right"
        type="number" inputMode="numeric" min={0}
        value={val}
        onChange={(e) => setVal(Number(e.target.value || 0))}
        onBlur={() => {
          const n = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
          const next: any = { ...rec, reps: { ...(currentReps as any), [id]: n } };
          onChange(next);
          if (n > 0) markDone(id);
        }}
      />
      <span className="text-xs text-slate-500">/ 目標 {target}</span>
    </div>
  );
}

function CheckInput({
  rec, id, setCount, onChange, markDone,
}: { rec: DayRecord; id: string; setCount: number; onChange: (next: any) => void; markDone: (id: string) => void; }) {
  function makeSetArray(n: number): number[] {
    const c = Math.max(1, Math.min(10, isFinite(n) ? Math.floor(n) : 3));
    return Array.from({ length: c }, (_, i) => i);
  }
  const checks = (rec as any).sets?.[id] ?? Array.from({ length: setCount }, () => false);
  return (
    <div className="flex items-center gap-2">
      {makeSetArray(setCount).map((idx) => {
        const toggle = () => {
          const nextChecks = [...checks];
          nextChecks[idx] = !nextChecks[idx];
          const next: any = { ...rec, sets: { ...(rec as any).sets ?? {}, [id]: nextChecks } };
          onChange(next); if (nextChecks[idx]) markDone(id);
        };
        return (
          <label key={idx} className="flex items-center gap-2 rounded-md border px-2 py-1">
            <Checkbox checked={!!checks[idx]} onCheckedChange={toggle} />
            <span className="text-xs text-slate-600">S{idx + 1}</span>
          </label>
        );
      })}
    </div>
  );
}
