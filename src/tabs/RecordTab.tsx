// src/tabs/RecordTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";
import type { DayRecord, Category, InputMode } from "@/lib/types";

/* ---------- ユーティリティ ---------- */
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
function isRepsMode(m: unknown): boolean {
  const s = String(m ?? "");
  return s === "reps" || s === "rep" || s === "count" || s === "counts" || s === "number";
}
/* Categoryに追従するグルーピング（other/etc 両対応） */
type ExercisesGrouped = Partial<Record<Category, any[]>>;

function loadExercises(): ExercisesGrouped {
  const grouped: ExercisesGrouped = {};

  // v2 format（設定タブ想定）
  const v2 = loadJSON<any>("wt:settings.v2");
  if (v2?.items && Array.isArray(v2.items)) {
    for (const it of v2.items as any[]) {
      const cat = (it.category ?? "other") as Category;
      const item = {
        id: String(it.id ?? ""),
        name: String(it.name ?? ""),
        category: cat,
        enabled: Boolean(it.enabled ?? true),
        inputMode: (it.inputMode ?? it.mode ?? "check") as InputMode,
        sets:
          typeof it.sets === "number"
            ? it.sets
            : typeof it.checkCount === "number"
            ? it.checkCount
            : 3,
        repTarget: it.repTarget,
        order: it.order,
      };
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat]!.push(item);
    }
    for (const k in grouped) {
      (grouped[k as Category] as any[])?.sort?.((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
    }
    return grouped;
  }

  // 互換（exercises / settings）
  const legacy = loadJSON<any>("exercises") ?? loadJSON<any>("settings");
  if (legacy && (legacy.upper || legacy.lower || legacy.etc || legacy.other)) {
    const keys = ["upper", "lower", "other", "etc"] as const;
    for (const key of keys) {
      const arr = legacy[key] as any[] | undefined;
      if (!arr) continue;
      const cat = (key === "etc" ? "other" : key) as Category;
      for (const it of arr) {
        const item = {
          id: String(it.id ?? ""),
          name: String(it.name ?? ""),
          category: cat,
          enabled: Boolean(it.enabled ?? true),
          inputMode: (it.inputMode ?? it.mode ?? "check") as InputMode,
          sets:
            typeof it.sets === "number"
              ? it.sets
              : typeof it.checkCount === "number"
              ? it.checkCount
              : 3,
          repTarget: it.repTarget,
          order: it.order,
        };
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat]!.push(item);
      }
    }
    for (const k in grouped) {
      (grouped[k as Category] as any[])?.sort?.((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
    }
  }
  return grouped;
}

/* 空のDayRecord（必須プロパティを満たす） */
function makeEmptyDayRecord(date: string): DayRecord {
  return { date, notes: "", notesUpper: "", notesLower: "", sets: {} } as DayRecord;
}

/* ---------- でか四角チェック（見た目重視） ---------- */
function SquareCheck({
  checked,
  onToggle,
}: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={[
        "w-11 h-11 sm:w-12 sm:h-12",           // なるべくスクショのサイズ感
        "border rounded-md",
        checked ? "bg-slate-700 border-slate-700" : "bg-white border-slate-300",
        "transition-colors"
      ].join(" ")}
    />
  );
}

/* ---------- Component ---------- */
export default function RecordTab() {
  const today = new Date();
  const todayStr = toYmd(today);

  const [exercises, setExercises] = useState<ExercisesGrouped>({});
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

  // 正規化して保存（未知フィールドrepsがあれば保持）
  const persist = (next: any) => {
    const normalized: any = {
      ...next,
      notesUpper: next?.notesUpper ?? "",
      notesLower: next?.notesLower ?? "",
      sets: next?.sets ?? {},
      ...(next?.reps ? { reps: next.reps } : {}),
    };
    saveDayRecord(todayStr, normalized as DayRecord);
    setRec(normalized as DayRecord);
    setCurrentSig(calcRecordsSignature());
  };

  const [doneIds, setDoneIds] = useState<string[]>([]);
  const markDone = (id: string) => setDoneIds(cur => (cur.includes(id) ? cur : [...cur, id]));

  /* ---------- UI ---------- */
  const displayDate = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月${String(today.getDate()).padStart(2, "0")}日`;

  return (
    <>
      {shouldPromptSave && (
        <div className="fixed top-0 left-0 right-0 z-50 text-center text-xs text-amber-700 bg-amber-50 border-b border-amber-200 py-1" role="status" aria-live="polite">
          10日以上ディスクに保存していません。右上の「保存」を押してください。
        </div>
      )}

      {/* 中央寄せ＆幅固定 */}
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {/* 保存ボタン（タイトルと日付の間の行の右側） */}
        <div className="mb-1 flex items-center justify-end">
          {hasUnsavedChanges && <span className="mr-3 text-xs text-rose-600">未保存の変更があります</span>}
          <button
            type="button"
            className="rounded-md border px-3 py-1 text-sm hover:bg-slate-50"
            onClick={() => {
              const filename = `record.latest.json`;
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
        <div className="mb-4 flex items-center justify-start text-sm text-slate-600">
          <time dateTime={todayStr}>{displayDate}</time>
        </div>

        {renderCategory("upper", "上半身")}
        {renderCategory("lower", "下半身")}
        {/* 第3カテゴリ（other / etc）いずれか存在時のみ表示 */}
        {Array.isArray((exercises as any)["other"]) && (exercises as any)["other"].length > 0
          ? renderCategory("other" as Category, "その他")
          : Array.isArray((exercises as any)["etc"]) && (exercises as any)["etc"].length > 0
          ? renderCategory("etc" as Category, "その他")
          : null}
      </div>
    </>
  );

  /* ---------- 内部：カテゴリ描画（1行レイアウト・5個折り返し） ---------- */
  function renderCategory(category: Category, title: string) {
    const items = (exercises[category] ?? []).filter((it: any) => it.enabled !== false);
    const sorted = [...items.filter((it: any) => !doneIds.includes(it.id)), ...items.filter((it: any) => doneIds.includes(it.id))];

    const memoLabel = category === "upper" ? "上半身メモ" : category === "lower" ? "下半身メモ" : "その他メモ";
    const catStr = String(category);
    const isOtherCat = catStr !== "upper" && catStr !== "lower";

    return (
      <>
        <h2 className="mb-3 mt-6 text-lg font-semibold">{title}</h2>

        <div className="space-y-6">
          {sorted.map((it: any) => {
            const mode = (it.inputMode ?? it.mode ?? "check") as InputMode | string;
            const setCount: number =
              typeof it.sets === "number" ? it.sets :
              typeof it.checkCount === "number" ? it.checkCount : 3;
            const repTarget: number = typeof it.repTarget === "number" ? it.repTarget : 10;

            return (
              <div key={it.id} className="pb-4 border-b last:border-b-0">
                {/* 行：左=種目名 / 右=インターバル表示＋入力域 */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium break-words">{it.name}</div>
                    {/* セット表記など入れる場合はここに（今回はベース画面のまま何も表示しない） */}
                  </div>

                  <div className="shrink-0">
                    <div className="text-xs text-slate-500 mb-2">前回からのインターバル：—</div>

                    {/* 入力域：回数 or チェック */}
                    {isRepsMode(mode) ? (
                      <RepInput rec={rec} id={it.id} target={repTarget} onChange={persist} markDone={markDone} />
                    ) : (
                      <Checks5PerRow rec={rec} id={it.id} setCount={setCount} onChange={persist} markDone={markDone} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* カテゴリ別メモ（文言そのまま） */}
        <div className="mt-6">
          <div className="text-sm text-slate-600 mb-1">{memoLabel}</div>
          <Textarea
            value={
              catStr === "upper" ? (rec as any).notesUpper ?? ""
              : catStr === "lower" ? (rec as any).notesLower ?? ""
              : (rec as any).notesEtc ?? (rec as any).notesOther ?? ""
            }
            onChange={(e) => {
              const v = e.target.value;
              const next: any = {
                ...rec,
                notesUpper: catStr === "upper" ? v : (rec as any).notesUpper ?? "",
                notesLower: catStr === "lower" ? v : (rec as any).notesLower ?? "",
                ...(isOtherCat ? { notesOther: v } : {}),
              };
              persist(next);
            }}
            placeholder="(例) アーチャープッシュアップも10回やった"
          />
        </div>
      </>
    );
  }
}

/* ---------- Inputs ---------- */
function RepInput({
  rec, id, target, onChange, markDone,
}: { rec: DayRecord; id: string; target: number; onChange: (next: any) => void; markDone: (id: string) => void; }) {
  const currentReps = (rec as any).reps ?? {};
  const [val, setVal] = useState<number>(Number(currentReps[id] ?? 0));
  useEffect(() => {
    setVal(Number(((rec as any).reps ?? {})[id] ?? 0));
  }, [rec, id]);

  return (
    <div className="flex items-center gap-2 justify-end">
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

/* ★ チェックボックス：5個で折り返し（最大10セット想定） */
function Checks5PerRow({
  rec, id, setCount, onChange, markDone,
}: { rec: DayRecord; id: string; setCount: number; onChange: (next: any) => void; markDone: (id: string) => void; }) {
  const MAX_PER_ROW = 5;

  function clamp(n: number) {
    const c = isFinite(n) ? Math.floor(n) : 3;
    return Math.max(1, Math.min(10, c)); // 上限10（従来想定）
  }
  const count = clamp(setCount);

  // 既存データの長さと整合を取る
  const current = Array.isArray((rec as any).sets?.[id]) ? (rec as any).sets[id] : [];
  const checks: boolean[] = Array.from({ length: count }, (_, i) => Boolean(current[i] ?? false));

  const rows: number[][] = [];
  for (let i = 0; i < count; i += MAX_PER_ROW) {
    rows.push(Array.from({ length: Math.min(MAX_PER_ROW, count - i) }, (_, k) => i + k));
  }

  const toggleAt = (idx: number) => {
    const nextChecks = [...checks];
    nextChecks[idx] = !nextChecks[idx];
    const next: any = { ...rec, sets: { ...(rec as any).sets ?? {}, [id]: nextChecks } };
    onChange(next);
    if (nextChecks[idx]) markDone(id);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, r) => (
        <div key={r} className="flex items-center justify-end gap-2">
          {row.map((idx) => (
            <SquareCheck key={idx} checked={!!checks[idx]} onToggle={() => toggleAt(idx)} />
          ))}
        </div>
      ))}
    </div>
  );
}
