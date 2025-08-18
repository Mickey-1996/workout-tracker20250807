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
  Category,
} from "@/lib/types";

/* ================== Utils ================== */
const EXPORT_FILENAME = "workoutrecord.latest"; // SettingsTabに合わせ拡張子なし

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const clampSets = (n: number) =>
  Math.max(1, Math.min(10, isFinite(n) ? Math.floor(n) : 3));

const padCounts = (src: number[] | undefined, setCount: number) => {
  const c = clampSets(setCount);
  const base = Array.isArray(src) ? [...src] : [];
  while (base.length < c) base.push(0);
  return base.slice(0, c);
};
const padChecks = (src: boolean[] | undefined, setCount: number) => {
  const c = clampSets(setCount);
  const base = Array.isArray(src) ? [...src] : [];
  while (base.length < c) base.push(false);
  return base.slice(0, c);
};

const jsonString = (data: unknown) => JSON.stringify(data, null, 2);

function hashString(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

/** localStorage の day:* を全取得（壊れた値も空オブジェクトで保持） */
function collectAllDayRecords(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("day:")) {
      try {
        const v = localStorage.getItem(k);
        out[k] = v ? JSON.parse(v) : {};
      } catch {
        out[k] = {};
      }
    }
  }
  return out;
}
const calcRecordsSignature = () => {
  const obj = collectAllDayRecords();
  const ordered = Object.keys(obj)
    .sort()
    .map((k) => `${k}:${JSON.stringify(obj[k])}`)
    .join("|");
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

/** SettingsTab と同等の保存（Blob→a[download]→失敗時 data:URL） */
function saveAsJson_LikeSettingsTab(filename: string, data: unknown): boolean {
  const text = jsonString(data);
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    try {
      const dataUrl =
        "data:application/json;charset=utf-8," + encodeURIComponent(text);
      window.open(dataUrl, "_blank");
      return true;
    } catch {
      return false;
    }
  }
}

/* -------- 設定ロード（SettingsTabの保存形式に対応） -------- */
function loadExercises(): ExercisesGrouped {
  // v2形式（settingsタブの最新仕様）
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
        sets:
          typeof it.sets === "number"
            ? it.sets
            : typeof it.checkCount === "number"
            ? it.checkCount
            : 3,
        checkCount: it.checkCount,
        repTarget: it.repTarget,
        order: it.order,
      };
      (item.category === "upper"
        ? grouped.upper
        : item.category === "lower"
        ? grouped.lower
        : grouped.etc
      ).push(item);
    }
    for (const k of ["upper", "lower", "etc"] as const)
      grouped[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return grouped;
  }
  // 旧形式フォールバック
  const raw = loadJSON<any>("exercises");
  if (raw?.upper || raw?.lower || raw?.etc)
    return { upper: raw.upper ?? [], lower: raw.lower ?? [], etc: raw.etc ?? [] };
  const legacy = loadJSON<any>("wt:settings");
  if (legacy?.upper || legacy?.lower || legacy?.etc)
    return { upper: legacy.upper ?? [], lower: legacy.lower ?? [], etc: legacy.etc ?? [] };
  return { upper: [], lower: [], etc: [] };
}

/* ================== Component ================== */
export default function RecordTab() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toYmd(today), [today]);
  const displayDate = useMemo(
    () =>
      `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(
        2,
        "0"
      )}月${String(today.getDate()).padStart(2, "0")}日`,
    [today]
  );

  const [exercises, setExercises] = useState<ExercisesGrouped>({
    upper: [],
    lower: [],
    etc: [],
  });
  const [rec, setRec] = useState<DayRecord>({
    date: todayStr,
    times: {},
    sets: {},
    counts: {},
    notesUpper: "",
    notesLower: "",
    notesEtc: "",
  });

  // 保存リマインド
  const [lastDiskSaveAt, setLastDiskSaveAt] = useState<number>(0);
  const [lastSavedSig, setLastSavedSig] = useState<string>("");
  const [currentSig, setCurrentSig] = useState<string>("");

  useEffect(() => {
    try {
      setExercises(loadExercises());
    } catch {}
    try {
      const loaded = loadDayRecord(todayStr) as DayRecord | null | undefined;
      if (loaded)
        setRec({
          ...loaded,
          notesUpper: loaded.notesUpper ?? "",
          notesLower: loaded.notesLower ?? "",
          notesEtc: loaded.notesEtc ?? "",
        });
    } catch {}
    try {
      const t = Number(localStorage.getItem("wt:lastDiskSaveAt") || 0);
      setLastDiskSaveAt(t);
      setLastSavedSig(localStorage.getItem("wt:lastSavedSig") ?? "");
      setCurrentSig(calcRecordsSignature());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hoursSinceSave = useMemo(
    () => (!lastDiskSaveAt ? Infinity : (Date.now() - lastDiskSaveAt) / (1000 * 60 * 60)),
    [lastDiskSaveAt]
  );
  const shouldPromptSave = hoursSinceSave > 24 * 10;
  const hasUnsavedChanges =
    currentSig !== "" && lastSavedSig !== "" && currentSig !== lastSavedSig;

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

  /** saveDayRecord の引数に合わせて正規化して保存 */
  const saveSafe = (date: string, data: DayRecord) => {
    const normalized: DayRecord = {
      date: data.date,
      times: (data.times ?? {}) as Record<string, string[]>,
      sets: (data.sets ?? {}) as Record<string, boolean[]>,
      counts: (data.counts ?? {}) as Record<string, number[]>,
      notesUpper: data.notesUpper ?? "",
      notesLower: data.notesLower ?? "",
      notesEtc: data.notesEtc ?? "",
    };
    saveDayRecord(date, normalized as Parameters<typeof saveDayRecord>[1]);
  };

  const persist = (next: DayRecord) => {
    const normalized: DayRecord = {
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
    saveSafe(todayStr, normalized);
    setCurrentSig(calcRecordsSignature());
  };

  /* ================== UI Parts ================== */
  const Banner = () =>
    shouldPromptSave ? (
      <div className="fixed top-0 left-0 right-0 z-50 text-center text-[11px] sm:text-xs text-amber-700 bg-amber-50 border-b border-amber-200 py-1">
        10日以上保存していません。右上の「保存」を押してください。
      </div>
    ) : null;

  const Header = () => (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <div className="mx-auto w-full max-w-none px-3 sm:px-6 py-2 flex items-center justify-end">
        {hasUnsavedChanges && (
          <span className="mr-3 text-xs text-rose-600">未保存の変更があります</span>
        )}
        <button
          type="button"
          className="rounded-md border px-3 py-1 text-sm hover:bg-slate-50"
          onClick={() => {
            const payload = collectAllDayRecords();
            const ok = saveAsJson_LikeSettingsTab(EXPORT_FILENAME, payload);

            // 署名・時刻の更新（保存経路に関係なく）
            const sig = calcRecordsSignature();
            const t = Date.now();
            localStorage.setItem("wt:lastDiskSaveAt", String(t));
            localStorage.setItem("wt:lastSavedSig", sig);
            setLastDiskSaveAt(t);
            setLastSavedSig(sig);
            setCurrentSig(sig);
            alert(ok ? `保存しました（${EXPORT_FILENAME}）` : "保存に失敗しました");
          }}
          aria-label="記録データを保存"
        >
          保存
        </button>
      </div>

      <div className="mx-auto w-full max-w-none px-3 sm:px-6 pb-2">
        <div className="text-slate-700">{displayDate}</div>
      </div>
    </div>
  );

  // 56px 正方形：iOSの重なり回避（min-* + shrink-0 + block/relative + leading-none）
  const SquareCount = ({
    value,
    onChange,
    max,
  }: {
    value: number;
    onChange: (n: number) => void;
    max: number;
  }) => (
    <div className="w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 relative block">
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-14 w-14 p-0 text-lg justify-center leading-none box-border">
          <SelectValue placeholder="0" />
        </SelectTrigger>
        {/* iPhoneでも必ず下に出す／高z-index／スクロール可 */}
        <SelectContent
          side="bottom"
          align="start"
          position="popper"
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
      className={`w-14 h-14 min-w-[56px] min-h-[56px] shrink-0 relative block rounded-md border flex items-center justify-center ${
        on ? "bg-emerald-500 border-emerald-600 text-white" : "border-slate-300"
      }`}
    >
      {on ? (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M20 6L9 17l-5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );

  const renderCategory = (key: "upper" | "lower" | "etc", label: string) => {
    const items = exercises[key].filter((it) => it.enabled ?? true);
    return (
      <Card className="mb-6 p-3 sm:p-5">
        <div className="mb-2 font-semibold">{label}</div>

        <div className="space-y-4">
          {items.map((it) => {
            const id = it.id;
            const mode = (it.mode ?? it.inputMode ?? "check") as InputMode;
            const setCount = clampSets(it.sets ?? it.checkCount ?? 3);

            const countsArr = padCounts(rec.counts?.[id], setCount);
            const checksArr = padChecks(rec.sets?.[id], setCount);

            // インターバル（最後と直前／なければ現在との差）
            const times = rec.times?.[id] ?? [];
            const n = times.length;
            const last = n ? new Date(times[n - 1]) : null;
            const prev = n > 1 ? new Date(times[n - 2]) : null;
            const intervalMs =
              last && prev
                ? last.getTime() - prev.getTime()
                : last
                ? Date.now() - last.getTime()
                : undefined;

            return (
              <div key={id} className="rounded-lg border border-slate-200 p-3 sm:p-4">
                {/* 種目名 */}
                <div className="text-sm text-slate-700 break-words font-medium">
                  {it.name}
                </div>

                {/* インターバル（右寄せ） */}
                <div className="mt-2 text-xs text-slate-500 text-right">
                  前回からのインターバル：
                  {intervalMs !== undefined ? formatHours(intervalMs) : "—"}
                </div>

                {/* 入力UI：右端寄せ・折返し時も重ならない（iPhone対策） */}
                <div className="mt-2 w-full flex justify-end">
                  <div className="inline-grid grid-cols-5 gap-x-2 gap-y-3 auto-rows-[64px]">
                    {mode === "count"
                      ? countsArr.map((val, idx) => {
                          const update = (v: number) => {
                            setRec((prev) => {
                              const prevCounts = padCounts(prev.counts?.[id], setCount);
                              const nextCounts = [...prevCounts];
                              nextCounts[idx] = v;
                              const next: DayRecord = {
                                ...prev,
                                counts: { ...(prev.counts ?? {}), [id]: nextCounts },
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
                              type="button"
                              onClick={toggle}
                              aria-pressed={on}
                              aria-label="チェック"
                              className="inline-block align-top"
                            >
                              <SquareCheck on={!!on} />
                            </button>
                          );
                        })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* メモ（入力幅：w-full） */}
        <div className="mt-4">
          <div className="mb-1 text-xs text-slate-500">メモ（{label}）</div>
          <Textarea
            className="w-full"
            value={
              key === "upper"
                ? rec.notesUpper
                : key === "lower"
                ? rec.notesLower
                : rec.notesEtc
            }
            onChange={(e) => {
              const v = e.target.value;
              const next: DayRecord = {
                ...rec,
                notesUpper: key === "upper" ? v : rec.notesUpper ?? "",
                notesLower: key === "lower" ? v : rec.notesLower ?? "",
                notesEtc: key === "etc" ? v : rec.notesEtc ?? "",
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
      {/* バナー */}
      <Banner />

      {/* ヘッダー＋本文（他タブと同等の余白） */}
      <div className={shouldPromptSave ? "pt-7 sm:pt-8" : ""}>
        <Header />
        <div className="w-full max-w-none px-4 sm:px-6 py-4">
          {renderCategory("upper", "上半身")}
          {renderCategory("lower", "下半身")}
          {renderCategory("etc", "その他")}
        </div>
      </div>
    </>
  );
}

/* ===== インターバル時間（時間単位） ===== */
function formatHours(ms: number): string {
  const hours = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
  return `${hours}時間`;
}
