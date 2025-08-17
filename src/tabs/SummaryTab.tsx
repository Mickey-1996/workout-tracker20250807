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
  notesUpper?: string;
  notesLower?: string;
  notesEtc?: string;
};

// ===== ローカル日付ユーティリティ =====
const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};

// ===== 復元（localStorage 全量インポート） =====
function importAllLocalStorageFromFile(file?: File | null) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result ?? "");
      const obj = JSON.parse(text) as Record<string, string | null>;
      Object.entries(obj).forEach(([k, v]) => {
        if (v == null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      });
      alert("復元が完了しました。必要に応じてページを再読み込みしてください。");
    } catch (e) {
      alert("JSON の読み込み/復元に失敗しました。");
      console.error(e);
    }
  };
  reader.readAsText(file);
}

// ===== exercises を読み出す（設定タブ保存フォーマットを想定） =====
function loadExercises(): ExercisesState {
  try {
    const raw = localStorage.getItem("exercises");
    const obj = raw ? JSON.parse(raw) : null;
    const pick = (arr?: any[]) =>
      Array.isArray(arr)
        ? arr.map((it) => ({
            id: String(it.id ?? ""),
            name: String(it.name ?? ""),
            category: (it.category ?? "etc") as ExerciseItem["category"],
          }))
        : [];
    return {
      upper: pick(obj?.upper),
      lower: pick(obj?.lower),
      etc: pick(obj?.etc),
    };
  } catch {
    return { upper: [], lower: [], etc: [] };
  }
}

// ===== 記録キー探索（day:YYYY-MM-DD 互換） =====
function loadRecordByDate(ymd: string): DayRecord | null {
  const candidates = [`day:${ymd}`, `record:${ymd}`, ymd];
  for (const k of candidates) {
    const v = localStorage.getItem(k);
    if (!v) continue;
    try {
      const obj = JSON.parse(v);
      if (obj && typeof obj === "object") {
        return { date: ymd, ...obj };
      }
    } catch {}
  }
  return null;
}

function monthMatrix(base: Date) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const startDay = first.getDay(); // 0..6
  const days = last.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export default function SummaryTab() {
  const [ex, setEx] = useState<ExercisesState>({ upper: [], lower: [], etc: [] });
  const [base, setBase] = useState<Date>(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEx(loadExercises());
  }, []);

  const weeks = useMemo(() => monthMatrix(base), [base]);

  const recordsMap = useMemo(() => {
    // 月内すべて読み込んでマップ化
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

  const selectedRecord = selected ? recordsMap.get(selected) ?? null : null;

  // 種目名解決
  const nameOf = (id: string) => {
    for (const g of [ex.upper, ex.lower, ex.etc]) {
      const hit = g.find((x) => x.id === id);
      if (hit) return hit.name || id;
    }
    return id;
  };

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
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
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

        {/* カレンダー */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {["日","月","火","水","木","金","土"].map((w) => (
            <div key={w} className="py-1 text-center text-xs text-slate-500">{w}</div>
          ))}
          {weeks.flat().map((d, i) => {
            if (!d) {
              return <div key={i} className="h-10 sm:h-12 rounded-md bg-slate-50" />;
            }
            const ymd = ymdLocal(d);
            const active = selected === ymd;
            const marked = hasRecord(d);
            return (
              <button
                key={i}
                onClick={() => setSelected(ymd)}
                className={`relative h-10 sm:h-12 rounded-md border text-sm hover:bg-slate-50 ${
                  active ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200"
                }`}
              >
                <span className="absolute left-1 top-1 text-[11px] text-slate-600">
                  {d.getDate()}
                </span>
                {marked && (
                  <span className="absolute bottom-1 right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-blue-500 text-[10px] text-blue-600">
                    ●
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 選択日のサマリ */}
      <div className="mt-4">
        {!selectedRecord ? (
          <Card className="p-3 text-sm text-slate-500">日付を選択すると、その日の記録を表示します。</Card>
        ) : (
          <Card className="p-3">
            <div className="mb-2 text-base font-semibold">{selected} の記録</div>
            <div className="space-y-2">
              {/* counts */}
              {selectedRecord.counts &&
                Object.entries(selectedRecord.counts).map(([id, arr]) => (
                  <div key={id} className="text-sm">
                    <span className="font-medium">{nameOf(id)}</span>{" "}
                    <span className="text-slate-500">（回数）</span>：{arr.filter((v) => (v ?? 0) > 0).join(", ")}
                  </div>
                ))}
              {/* sets */}
              {selectedRecord.sets &&
                Object.entries(selectedRecord.sets).map(([id, arr]) => (
                  <div key={id} className="text-sm">
                    <span className="font-medium">{nameOf(id)}</span>{" "}
                    <span className="text-slate-500">（セット）</span>：
                    {arr.map((b, i) => (b ? `#${i + 1}` : null)).filter(Boolean).join(" ")}
                  </div>
                ))}

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
