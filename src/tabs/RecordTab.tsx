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

/* --- 型（保存時に必須化） --- */
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

/* --- ユーティリティ --- */
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

// iOS Safari：アンカーでJSONダウンロード（通常は「ダウンロード」フォルダ）
function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename; // 例: "workoutrecord.2508172230"
  a.click();
  URL.revokeObjectURL(a.href);
}

// 軽量ハッシュ（保存漏れ検知）
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
      try {
        out[k] = JSON.parse(localStorage.getItem(k) || "{}");
      } catch {}
    }
  }
  return out;
}
function calcRecordsSignature(): string {
  const obj = collectAllDayRecords();
  const ordered = Object.keys(obj)
    .sort()
    .map(k => `${k}:${JSON.stringify(obj[k])}`)
    .join("|");
  return hashString(ordered);
}

function hasAnyData(r: DayRecord | DayRecordStrict | null | undefined) {
  if (!r) return false;
  const anySets = r.sets && Object.values(r.sets).some((arr) => (arr ?? []).some(Boolean));
  const anyCounts = r.counts && Object.values(r.counts).some((arr) => (arr ?? []).some((n) => (n ?? 0) > 0));
  const anyTimes = r.times && Object.values(r.times).some((arr) => (arr ?? []).length > 0);
  const anyNotes = (r.notesUpper ?? "") + (r.notesLower ?? "") + (r.notesEtc ?? "") + ((r as any).notesOther ?? "");
  return Boolean(anySets || anyCounts || anyTimes || anyNotes.trim());
}

/* --- 設定ロード（v2優先→旧フォーマット） --- */
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
      if (item.category === "upper" || item.category === "lower" || item.category === "etc") {
        grouped[item.category].push(item);
      } else {
        grouped.etc.push(item);
      }
    }
    for (const k of ["upper", "lower", "etc"] as const) {
      grouped[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return grouped;
  }

  const raw = loadJSON<any>("exercises");
  const fallback: ExercisesGrouped = { upper: [], lower: [], etc: [] };
  if (!raw) return fallback;

  const norm = (arr?: any[]) =>
    Array.isArray(arr)
      ? arr.map((it: any) => ({
          id: String(it.id ?? ""),
          name: String(it.name ?? ""),
          category: (it.category ?? "etc") as Category,
          enabled: Boolean(it.enabled ?? true),
          mode: (it.mode ?? it.inputMode ?? "check") as InputMode,
          inputMode: (it.inputMode ?? it.mode) as InputMode | undefined,
          sets: Number(it.sets ?? it.checkCount ?? 3),
          checkCount: it.checkCount,
          repTarget: it.repTarget,
          order: Number(it.order ?? 1),
        }))
      : [];

  const grouped: ExercisesGrouped = {
    upper: norm(raw.upper),
    lower: norm(raw.lower),
    etc: norm(raw.etc),
  };
  for (const k of ["upper", "lower", "etc"] as const) {
    grouped[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return grouped;
}

/* --- 本体 --- */
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

  // ディスク保存の最終時刻／シグネチャ（未保存検知）
  const [lastDiskSaveAt, setLastDiskSaveAt] = useState<number>(0);
  const [lastSavedSig, setLastSavedSig] = useState<string>("");
  const [currentSig, setCurrentSig] = useState<string>("");

  // バナーDOMノード（直接挿入で Portal 不要／package.json 変更も不要）
  const [bannerNode, setBannerNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      setExercises(loadExercises());
    } catch {}

    try {
      const loaded = loadDayRecord(todayStr) as DayRecord | null | undefined;
      if (loaded) {
        setRec({
          ...loaded,
          notesUpper: loaded.notesUpper ?? "",
          notesLower: loaded.notesLower ?? "",
          notesEtc: loaded.notesEtc ?? "",
          ...(loaded.notesOther !== undefined ? { notesOther: loaded.notesOther } : {}),
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

  /* --- 保存リマインド：10日 --- */
  const hoursSinceSave = useMemo(() => {
    if (!lastDiskSaveAt) return Infinity;
    return (Date.now() - lastDiskSaveAt) / (1000 * 60 * 60);
  }, [lastDiskSaveAt]);
  const shouldPromptSave = hoursSinceSave > 24 * 10;
  const hasUnsavedChanges = currentSig !== "" && lastSavedSig !== "" && currentSig !== lastSavedSig;

  // 離脱警告（保存漏れ抑止）
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

  // 10日未保存バナー：タブの上の行に直接差し込み（タブ= role="tablist" 想定）
  useEffect(() => {
    // 既存ノードがあれば一旦片付け
    if (bannerNode && (!shouldPromptSave)) {
      bannerNode.remove();
      setBannerNode(null);
      return;
    }
    if (!shouldPromptSave || bannerNode) return;

    const banner = document.createElement("div");
    banner.setAttribute("data-wt-banner", "save-reminder");
    banner.style.width = "100%";
    banner.style.textAlign = "center";
    banner.style.fontSize = "11px";
    banner.style.lineHeight = "1.4";
    banner.style.padding = "6px 8px";
    banner.style.color = "#92400e";      // amber-700
    banner.style.background = "#fffbeb"; // amber-50
    banner.style.borderBottom = "1px solid #fcd34d"; // amber-200
    banner.textContent = "10日以上ディスクに保存していません。右上の「保存」を押してください。";

    // タブ直上に入れる（role="tablist" が見つからない場合は本文先頭にフォールバック）
    const tablist = document.querySelector<HTMLElement>('[role="tablist"]');
    if (tablist?.parentElement) {
      tablist.parentElement.insertAdjacentElement("beforebegin", banner);
    } else {
      // 本文(このコンポーネントの最上位div)の直前へ
      const root = document.getElementById("__next") || document.body;
      root.insertAdjacentElement("afterbegin", banner);
    }
    setBannerNode(banner);

    // クリーンアップ
    return () => {
      banner.remove();
      setBannerNode(null);
    };
  }, [shouldPromptSave, bannerNode]);

  // 保存ヘルパー（空上書き防止）
  const persist = (next: DayRecord) => {
    const normalized: DayRecord = {
      ...next,
      notesUpper: next.notesUpper ?? "",
      notesLower: next.notesLower ?? "",
      notesEtc: next.notesEtc ?? "",
      ...(next.notesOther !== undefined ? { notesOther: next.notesOther } : {}),
    };
    const normalizedStrict: DayRecordStrict = {
      date: normalized.date,
      times: (normalized.times ?? {}) as Record<string, string[]>,
      sets: (normalized.sets ?? {}) as Record<string, boolean[]>,
      counts: (normalized.counts ?? {}) as Record<string, number[]>,
      notesUpper: normalized.notesUpper ?? "",
      notesLower: normalized.notesLower ?? "",
      notesEtc: normalized.notesEtc ?? "",
    };
    const current = loadDayRecord(todayStr) as DayRecord | null | undefined;
    if (!hasAnyData(normalizedStrict) && hasAnyData(current ?? undefined)) {
      if (current) setRec(current);
      return;
    }
    setRec(normalizedStrict);
    saveDayRecord(todayStr, normalizedStrict);
    setCurrentSig(calcRecordsSignature());
  };

  // 完了時刻の更新
  const markDone = (id: string) => {
    const iso = new Date().toISOString();
    persist({
      ...rec,
      times: { ...(rec.times ?? {}), [id]: [...(rec.times?.[id] ?? []), iso] },
    });
  };

  /* --- UI: カテゴリ --- */
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

            // 1行目：種目名 + 入力UI
            const row1 = (
              <div className="flex items-center gap-3 whitespace-nowrap overflow-x-auto">
                <div className="text-sm text-slate-700 min-w-[6rem]">{it.name}</div>
                {mode === "count" ? (
                  <div className="flex items-center gap-2">
                    {(rec.counts?.[id] ?? Array.from({ length: setCount }, () => 0)).map((val, idx) => {
                      const update = (v: number) => {
                        const prev = rec.counts?.[id] ?? Array.from({ length: setCount }, () => 0);
                        const nextCounts = [...prev];
                        nextCounts[idx] = v;
                        persist({ ...rec, counts: { ...(rec.counts ?? {}), [id]: nextCounts } });
                      };
                      const max = it.repTarget ?? 20;
                      return (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">S{idx + 1}</span>
                          <Select value={String(val)} onValueChange={(v) => update(Number(v))}>
                            <SelectTrigger className="h-8 w-20">
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
                ) : (
                  <div className="flex items-center gap-2">
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
                        <label key={idx} className="flex items-center gap-2 rounded-md border px-2 py-1">
                          <Checkbox checked={!!checks[idx]} onCheckedChange={toggle} />
                          <span className="text-xs text-slate-600">S{idx + 1}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );

            // 2行目：インターバル
            const times = rec.times?.[id] ?? [];
            const n = times.length;
            const last = n ? new Date(times[n - 1]) : null;
            const prev = n > 1 ? new Date(times[n - 2]) : null;
            const intervalMs =
              last && prev ? last.getTime() - prev.getTime() : last ? Date.now() - last.getTime() : undefined;

            const row2 = (
              <div className="mt-1 text-xs text-slate-500 whitespace-nowrap overflow-x-auto">
                前回から：{intervalMs !== undefined ? formatDuration(intervalMs) : "—"}{" "}
                {last && <span className="ml-3">最終：{last.toLocaleTimeString()}</span>}
              </div>
            );

            return (
              <div key={id} className="rounded-lg border border-slate-200 p-3">
                {row1}
                {row2}
              </div>
            );
          })}
        </div>

        {/* カテゴリメモ（placeholderは指定しない＝空欄） */}
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

  // YYMMDDTT（TT=時分：HHmm）形式のファイル名を生成
  const buildYYMMDDTT = () => {
    const now = new Date();
    const YY = String(now.getFullYear()).slice(-2);
    const MM = String(now.getMonth() + 1).padStart(2, "0");
    const DD = String(now.getDate()).padStart(2, "0");
    const TT = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    return `${YY}${MM}${DD}${TT}`;
  };

  return (
    <div className="p-4 sm:p-6">
      {/* ヘッダー：上＝保存ボタン（右寄せ）、下＝日付表示 */}
      <div className="mb-1 flex items-center justify-end">
        {hasUnsavedChanges && <span className="mr-3 text-xs text-rose-600">未保存の変更があります</span>}
        <button
          type="button"
          className="rounded-md border px-3 py-1 text-sm hover:bg-slate-50"
          onClick={() => {
            const filename = `workoutrecord.${buildYYMMDDTT()}`; // 要件②
            const payload = collectAllDayRecords();
            downloadJSON(filename, payload); // iPhone の「ダウンロード」に保存

            const sig = calcRecordsSignature();
            const t = Date.now();
            localStorage.setItem("wt:lastDiskSaveAt", String(t));
            localStorage.setItem("wt:lastSavedSig", sig);
            setLastDiskSaveAt(t);
            setLastSavedSig(sig);
            setCurrentSig(sig);
          }}
          aria-label="記録データを端末に保存"
        >
          保存
        </button>
      </div>

      {/* 日付表示（本文内のリマインドは表示しない。バナーはDOM直挿しでタブ上に表示） */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-slate-700">{displayDate}</div>
      </div>

      {renderCategory("upper", "上半身")}
      {renderCategory("lower", "下半身")}
      {renderCategory("etc", "その他")}
    </div>
  );
}

/* --- 末尾の小関数 --- */
function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}時間${m}分${sec}秒` : m > 0 ? `${m}分${sec}秒` : `${sec}秒`;
}
