// src/tabs/SummaryTab.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ExerciseItem = {
  id: string;
  name: string;
  category: "upper" | "lower" | "etc";
};

type ExercisesState = {
  upper: ExerciseItem[];
  lower: ExerciseItem[];
  etc: ExerciseItem[];
};

type DayRecord = {
  date: string;
  sets?: Record<string, boolean[]>;
  counts?: Record<string, number[]>;
  times?: Record<string, string[]>;
  notesUpper: string;
  notesLower: string;
  notesEtc: string;
  notesOther?: string;
};

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** localStorage helpers（要：現行キー `day:YYYY-MM-DD`） */
function loadRecordByDate(ymd: string): DayRecord | undefined {
  try {
    const raw = localStorage.getItem(`day:${ymd}`);
    if (!raw) return undefined;
    const r = JSON.parse(raw) as Partial<DayRecord>;
    return {
      date: ymd,
      times: r.times ?? {},
      sets: r.sets ?? {},
      counts: r.counts ?? {},
      notesUpper: r.notesUpper ?? "",
      notesLower: r.notesLower ?? "",
      notesEtc: r.notesEtc ?? "",
      ...(r.notesOther !== undefined ? { notesOther: r.notesOther } : {}),
    };
  } catch {
    return undefined;
  }
}

function loadExercisesFromSettings(): ExercisesState {
  try {
    // v2（SettingsTab 新形式）
    const v2Raw = localStorage.getItem("wt:settings.v2");
    if (v2Raw) {
      const v2 = JSON.parse(v2Raw);
      if (v2?.items && Array.isArray(v2.items)) {
        const upper: ExerciseItem[] = [];
        const lower: ExerciseItem[] = [];
        const etc: ExerciseItem[] = [];
        for (const it of v2.items as any[]) {
          const item: ExerciseItem = {
            id: String(it.id ?? ""),
            name: String(it.name ?? ""),
            category: (it.category ?? "etc") as ExerciseItem["category"],
          };
          if (item.category === "upper") upper.push(item);
          else if (item.category === "lower") lower.push(item);
          else etc.push(item);
        }
        return { upper, lower, etc };
      }
    }
  } catch {}

  // 旧形式 fallback
  try {
    const raw = localStorage.getItem("exercises");
    if (!raw) return { upper: [], lower: [], etc: [] };
    const old = JSON.parse(raw);
    const norm = (arr?: any[]): ExerciseItem[] =>
      Array.isArray(arr)
        ? arr.map((x) => ({
            id: String(x.id ?? ""),
            name: String(x.name ?? ""),
            category: (x.category ?? "etc") as ExerciseItem["category"],
          }))
        : [];
    return {
      upper: norm(old.upper),
      lower: norm(old.lower),
      etc: norm(old.etc),
    };
  } catch {
    return { upper: [], lower: [], etc: [] };
  }
}

/** エクスポート */
function exportAllDayRecords() {
  const data: Record<string, DayRecord> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("day:")) {
      try {
        data[k] = JSON.parse(localStorage.getItem(k)!) as DayRecord;
      } catch {}
    }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "backup-day-records.json";
  a.click();
}

/** インポート（単純上書きではなく結合） */
async function importAllLocalStorageFromFile(file: File | null) {
  if (!file) return;
  const text = await file.text();
  let imported: any;
  try {
    imported = JSON.parse(text);
  } catch {
    alert("JSONの解析に失敗しました");
    return;
  }
  const keys = Object.keys(imported).filter((k) => k.startsWith("day:"));

  const mergeBoolArr = (a: boolean[] = [], b: boolean[] = []) => {
    const n = Math.max(a.length, b.length);
    const out = new Array<boolean>(n);
    for (let i = 0; i < n; i++) out[i] = Boolean(a[i] || b[i]);
    return out;
  };
  const mergeNumArr = (a: number[] = [], b: number[] = []) => {
    const n = Math.max(a.length, b.length);
    const out = new Array<number>(n);
    for (let i = 0; i < n; i++) out[i] = Math.max(a[i] ?? 0, b[i] ?? 0);
    return out;
  };
  const uniq = <T,>(arr: T[] = []) => Array.from(new Set(arr));

  const mergeDay = (dst: Partial<DayRecord> = {}, src: Partial<DayRecord> = {}): DayRecord => {
    const out: DayRecord = {
      date: (src.date as string) || (dst.date as string) || "",
      times: { ...(dst.times ?? {}) },
      sets: { ...(dst.sets ?? {}) },
      counts: { ...(dst.counts ?? {}) },
      notesUpper: (dst.notesUpper ?? "") || (src.notesUpper ?? ""),
      notesLower: (dst.notesLower ?? "") || (src.notesLower ?? ""),
      notesEtc: (dst.notesEtc ?? "") || (src.notesEtc ?? ""),
      ...(dst.notesOther !== undefined || src.notesOther !== undefined
        ? { notesOther: (dst.notesOther ?? "") || (src.notesOther ?? "") }
        : {}),
    };

    const timeIds = new Set([
      ...Object.keys(dst.times ?? {}),
      ...Object.keys(src.times ?? {}),
    ]);
    for (const id of timeIds) {
      const a = dst.times?.[id] ?? [];
      const b = src.times?.[id] ?? [];
      out.times![id] = uniq([...(a || []), ...(b || [])]).sort();
    }

    const setIds = new Set([
      ...Object.keys(dst.sets ?? {}),
      ...Object.keys(src.sets ?? {}),
    ]);
    for (const id of setIds) {
      const a = dst.sets?.[id] ?? [];
      const b = src.sets?.[id] ?? [];
      out.sets![id] = mergeBoolArr(a, b);
    }

    const countIds = new Set([
      ...Object.keys(dst.counts ?? {}),
      ...Object.keys(src.counts ?? {}),
    ]);
    for (const id of countIds) {
      const a = dst.counts?.[id] ?? [];
      const b = src.counts?.[id] ?? [];
      out.counts![id] = mergeNumArr(a, b);
    }

    // メモが両方非空で異なる場合は dst を優先し src を追記
    const appendIfBoth = (d = "", s = "") =>
      d && s && d !== s ? `${d}\n[import] ${s}` : d || s || "";
    out.notesUpper = appendIfBoth(dst.notesUpper ?? "", src.notesUpper ?? "");
    out.notesLower = appendIfBoth(dst.notesLower ?? "", src.notesLower ?? "");
    out.notesEtc = appendIfBoth(dst.notesEtc ?? "", src.notesEtc ?? "");

    return out;
  };

  const report: any[] = [];
  for (const k of keys) {
    const src = imported[k] as Partial<DayRecord>;
    let dst: Partial<DayRecord> = {};
    try {
      const raw = localStorage.getItem(k);
      if (raw) dst = JSON.parse(raw);
    } catch {}
    const merged = mergeDay(dst, src);
    localStorage.setItem(k, JSON.stringify(merged));
    report.push({ key: k, action: dst ? "merge" : "create" });
  }
  console.table(report);
  alert(`完了: ${report.length}件をインポート/マージしました。ページを再読み込みしてください。`);
}

export default function SummaryTab() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 設定（種目名解決用）
  const ex = useMemo(() => loadExercisesFromSettings(), []);

  // id→name の辞書を作成（nameOf のため）
  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const list of [ex.upper, ex.lower, ex.etc]) {
      for (const it of list) m.set(it.id, it.name);
    }
    return m;
  }, [ex]);
  const nameOf = (id: string) => nameMap.get(id) ?? id;

  // カレンダーのベース月（1日固定）
  const [base, setBase] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // base 月の週配列（6週固定表示）
  const weeks = useMemo(() => {
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7)); // 月曜起点

    const grid: (Date | null)[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: (Date | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + w * 7 + d);
        if (cur.getMonth() !== base.getMonth()) row.push(null);
        else row.push(cur);
      }
      grid.push(row);
    }
    return grid;
  }, [base]);

  // 各日の有無（高速化のためマップ化）
  const recordsMap = useMemo(() => {
    const map = new Map<string, DayRecord>();
    for (const wk of weeks) {
      for (const d of wk) {
        if (!d) continue;
        const ymd = ymdLocal(d);
        const rec = loadRecordByDate(ymd);
        if (rec) map.set(ymd, rec);
      }
    }
    return map;
  }, [weeks]);

  const hasRecord = (d: Date | null) => {
    if (!d) return false;
    return recordsMap.has(ymdLocal(d));
  };

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const selectedRecord = useMemo(
    () => (selectedYmd ? recordsMap.get(selectedYmd) : undefined),
    [recordsMap, selectedYmd]
  );

  return (
    <div className="p-4 sm:p-6">
      {/* ヘッダー（右寄せ）：復元 */}
      <div className="mb-4 flex items-center justify-end gap-2 whitespace-nowrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => importAllLocalStorageFromFile(e.target.files?.[0] ?? null)}
        />
        <Button onClick={() => fileInputRef.current?.click()}>
          復元
        </Button>
      </div>

      <Card className="p-3">
        {/* 月移動 */}
        <div className="mb-2 flex items-center justify-between">
          <button
            className="rounded-md border px-3 py-1"
            onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() - 1, 1))}
          >
            ←
          </button>
          <div className="text-base font-semibold">
            {base.getFullYear()}年 {base.getMonth() + 1}月
          </div>
          <button
            className="rounded-md border px-3 py-1"
            onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() + 1, 1))}
          >
            →
          </button>
        </div>

        {/* 曜日ヘッダ（Mon-Sun） */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
          {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        {/* カレンダー本体 */}
        <div className="mt-1 grid grid-cols-7 gap-1">
          {weeks.map((row, ri) =>
            row.map((d, ci) => {
              const ymd = d ? ymdLocal(d) : "";
              const has = hasRecord(d);
              const isToday =
                d &&
                (() => {
                  const t = new Date();
                  const ymdT = ymdLocal(t);
                  return ymdT === ymd;
                })();

              return (
                <button
                  key={`${ri}-${ci}`}
                  className={[
                    "h-16 rounded-md border p-1 text-left",
                    has ? "border-green-400" : "border-slate-200",
                    isToday ? "bg-yellow-50" : "",
                    ymd === selectedYmd ? "ring-2 ring-blue-400" : "",
                  ].join(" ")}
                  onClick={() => (d ? setSelectedYmd(ymd) : void 0)}
                >
                  <div className="text-xs">{d ? d.getDate() : ""}</div>
                  {has && <div className="mt-1 text-[10px] text-green-600">記録あり</div>}
                </button>
              );
            })
          )}
        </div>
      </Card>

      {/* 詳細パネル */}
      <div className="mt-4">
        {selectedRecord && (
          <Card className="p-3">
            <div className="text-sm text-slate-600">
              <div className="mb-1">
                <span className="font-medium">{selectedYmd}</span> の記録
              </div>

              {/* times */}
              {selectedRecord.times && Object.entries(selectedRecord.times).length > 0 && (
                <div className="mb-2">
                  <div className="text-slate-500">完了時刻</div>
                  {Object.entries(selectedRecord.times).map(([id, arr]) => (
                    <div key={id} className="text-sm">
                      <span className="font-medium">{nameOf(id)}</span>：
                      {(arr || []).map((iso) => new Date(iso).toLocaleTimeString()).join(", ")}
                    </div>
                  ))}
                </div>
              )}

              {/* counts */}
              {selectedRecord.counts && Object.entries(selectedRecord.counts).length > 0 && (
                <div className="mb-2">
                  <div className="text-slate-500">回数</div>
                  {Object.entries(selectedRecord.counts).map(([id, arr]) => (
                    <div key={id} className="text-sm">
                      <span className="font-medium">{nameOf(id)}</span>：
                      {(arr || []).map((n, i) => `S${i + 1}:${n}`).join(" / ")}
                    </div>
                  ))}
                </div>
              )}

              {/* sets */}
              {selectedRecord.sets && Object.entries(selectedRecord.sets).length > 0 && (
                <div className="mb-2">
                  <div className="text-slate-500">セット完了</div>
                  {Object.entries(selectedRecord.sets).map(([id, arr]) => (
                    <div key={id} className="text-sm">
                      <span className="font-medium">{nameOf(id)}</span>{" "}
                      <span className="text-slate-500">（セット）</span>：
                      {arr.map((b, i) => (b ? `#${i + 1}` : null)).filter(Boolean).join(" ")}
                    </div>
                  ))}
                </div>
              )}

              {/* メモ */}
              {(selectedRecord.notesUpper || selectedRecord.notesLower || selectedRecord.notesEtc) && (
                <div className="pt-2 text-sm">
                  <div className="text-slate-500">メモ</div>
                  {selectedRecord.notesUpper && <div>上半身：{selectedRecord.notesUpper}</div>}
                  {selectedRecord.notesLower && <div>下半身：{selectedRecord.notesLower}</div>}
                  {selectedRecord.notesEtc && <div>その他：{selectedRecord.notesEtc}</div>}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
