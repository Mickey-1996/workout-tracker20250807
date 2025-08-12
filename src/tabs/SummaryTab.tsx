// src/tabs/SummaryTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loadExercises } from "@/lib/local-storage";

// ---- 既存フォーマットに依存しない最小型（後方互換で柔軟に解釈） ----
type DayRecordLoose = {
  date?: unknown;
  sets?: unknown;    // Record<string, boolean[]>
  counts?: unknown;  // Record<string, number | number[] | { total?: number; reps?: number[] }>
};

type DayRecord = {
  date: string;
  sets: Record<string, boolean[]>;
  counts?: Record<string, number | number[] | { total?: number; reps?: number[] }>;
};

type ExerciseLike = { id: string; name: string; category?: string };
type ExercisesState = Record<string, ExerciseLike[]>;

function normalizeCat(key: string): "upper" | "lower" | "other" {
  const k = key.toLowerCase();
  if (k.includes("upper") || k.includes("上")) return "upper";
  if (k.includes("lower") || k.includes("下")) return "lower";
  return "other";
}
const catLabel: Record<"upper" | "lower" | "other", string> = {
  upper: "上半身",
  lower: "下半身",
  other: "その他",
};

// ---------- 日付ユーティリティ（YYYY-MM-DD 前提） ----------
const fmt = (d: Date) => d.toISOString().split("T")[0];
const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
// ISO週の月曜始まり
const startOfISOWeek = (d: Date) => {
  const day = d.getDay(); // 0=Sun,...,6=Sat
  const offset = (day + 6) % 7; // Mon=0, Sun=6
  const x = new Date(d);
  x.setDate(d.getDate() - offset);
  return x;
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

// ---------- localStorage 全走査で DayRecord を推定 ----------
function readAllDayRecords(): DayRecord[] {
  if (typeof window === "undefined") return [];
  const arr: DayRecord[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const v: DayRecordLoose = JSON.parse(raw);
      if (
        v &&
        typeof v === "object" &&
        v.date &&
        typeof v.date === "string" &&
        v.sets &&
        typeof v.sets === "object"
      ) {
        const rec: DayRecord = {
          date: v.date,
          sets: v.sets as Record<string, boolean[]>,
        };
        if (v.counts && typeof v.counts === "object") {
          rec.counts = v.counts as Record<
            string,
            number | number[] | { total?: number; reps?: number[] }
          >;
        }
        arr.push(rec);
      }
    } catch {
      // JSON じゃないキーは無視
    }
  }
  return arr.sort((a, b) => a.date.localeCompare(b.date));
}

// counts の多様な形を合計値に丸める（後方互換）
function normalizeCountValue(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (Array.isArray(v)) {
    return v.reduce((s, x) => (typeof x === "number" && Number.isFinite(x) ? s + x : s), 0);
  }
  if (v && typeof v === "object") {
    const obj = v as { total?: unknown; reps?: unknown };
    if (typeof obj.total === "number" && Number.isFinite(obj.total)) return obj.total;
    if (Array.isArray(obj.reps)) {
      return obj.reps.reduce(
        (s, x) => (typeof x === "number" && Number.isFinite(x) ? s + x : s),
        0
      );
    }
  }
  return 0;
}

export default function SummaryTab() {
  const [exercises, setExercises] = useState<ExercisesState | null>(null);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  // 初期ロード：種目・全レコード
  useEffect(() => {
    const ex = loadExercises();
    if (ex) setExercises(ex);
    const all = readAllDayRecords();
    setRecords(all);

    // 期間初期値：直近30日（レコードがあれば最終日基準）
    const today = fmt(new Date());
    const endDate = all.length ? all[all.length - 1].date : today;
    const d = new Date(endDate);
    d.setDate(d.getDate() - 29);
    setStart(fmt(d));
    setEnd(endDate);
  }, []);

  // 種目マップ（id -> name, cat）
  const exIndex = useMemo(() => {
    const map = new Map<string, { name: string; cat: "upper" | "lower" | "other" }>();
    if (exercises) {
      for (const [k, arr] of Object.entries(exercises)) {
        const cat = normalizeCat(k);
        for (const ex of arr) {
          map.set(ex.id, { name: ex.name, cat });
        }
      }
    }
    return map;
  }, [exercises]);

  // 期間でフィルタ
  const ranged = useMemo(() => {
    if (!start || !end) return [];
    return records.filter((r) => r.date >= start && r.date <= end);
  }, [records, start, end]);

  // 集計（完了セット数 + 回数合計）
  const rows = useMemo(() => {
    type Acc = {
      name: string;
      cat: "upper" | "lower" | "other";
      setTotal: number;  // 完了セット数
      repTotal: number;  // 回数合計
      days: Set<string>; // 実施日集合（セット or 回数のどちらか>0でカウント）
    };
    const acc = new Map<string, Acc>(); // exId -> acc

    for (const r of ranged) {
      const setEntries = Object.entries(r.sets || {});
      const countEntries = r.counts && typeof r.counts === "object"
        ? Object.entries(r.counts as Record<string, unknown>)
        : [];

      // sets 側
      for (const [exId, arr] of setEntries) {
        const info = exIndex.get(exId) ?? { name: "（削除済みの種目）", cat: "other" as const };
        const done = Array.isArray(arr) ? arr.filter(Boolean).length : 0;
        if (!acc.has(exId)) {
          acc.set(exId, { name: info.name, cat: info.cat, setTotal: 0, repTotal: 0, days: new Set() });
        }
        const a = acc.get(exId)!;
        a.setTotal += done;
        if (done > 0) a.days.add(r.date);
      }

      // counts 側
      for (const [exId, val] of countEntries) {
        const info = exIndex.get(exId) ?? { name: "（削除済みの種目）", cat: "other" as const };
        const reps = normalizeCountValue(val);
        if (!acc.has(exId)) {
          acc.set(exId, { name: info.name, cat: info.cat, setTotal: 0, repTotal: 0, days: new Set() });
        }
        const a = acc.get(exId)!;
        a.repTotal += reps;
        if (reps > 0) a.days.add(r.date);
      }
    }

    const out = Array.from(acc.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      cat: v.cat,
      daysCount: v.days.size,
      setTotal: v.setTotal,
      repTotal: v.repTotal,
    }));
    // 並び：カテゴリ -> 回数合計 desc -> セット合計 desc -> 名前
    out.sort((a, b) => {
      const cg = a.cat.localeCompare(b.cat);
      if (cg !== 0) return cg;
      if (b.repTotal !== a.repTotal) return b.repTotal - a.repTotal;
      if (b.setTotal !== a.setTotal) return b.setTotal - a.setTotal;
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [ranged, exIndex]);

  // カテゴリ別合計（セット/回数）
  const catTotals = useMemo(() => {
    const init = {
      upper: { sets: 0, reps: 0 },
      lower: { sets: 0, reps: 0 },
      other: { sets: 0, reps: 0 },
    } as Record<"upper" | "lower" | "other", { sets: number; reps: number }>;
    for (const r of rows) {
      init[r.cat].sets += r.setTotal;
      init[r.cat].reps += r.repTotal;
    }
    return init;
  }, [rows]);

  // ========== クイック期間プリセット ==========
  const endBound = useMemo(() => {
    const today = fmt(new Date());
    if (records.length === 0) return today;
    const last = records[records.length - 1].date;
    return last < today ? last : today; // データ最終日と今日の早い方
  }, [records]);

  const setQuickDays = (days: number) => {
    const e = endBound;
    const d = toDate(e);
    d.setDate(d.getDate() - (days - 1));
    setStart(fmt(d));
    setEnd(e);
  };

  const setThisWeek = () => {
    const e = endBound;
    const s = startOfISOWeek(toDate(e));
    setStart(fmt(s));
    setEnd(e);
  };

  const setThisMonth = () => {
    const e = endBound;
    const s = startOfMonth(toDate(e));
    setStart(fmt(s));
    setEnd(e);
  };

  const setThisYear = () => {
    const e = endBound;
    const s = startOfYear(toDate(e));
    setStart(fmt(s));
    setEnd(e);
  };

  const setAll = () => {
    if (!records.length) return;
    setStart(records[0].date);
    setEnd(records[records.length - 1].date);
  };

  // ========== UI ==========
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">集計</h2>

      {/* 期間コントロール */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-center">
          <label className="sm:col-span-2">
            <div className="text-sm opacity-80">開始日</div>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <div className="text-sm opacity-80">終了日</div>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 sm:justify-end">
            {/* 既存 */}
            <Button variant="secondary" onClick={() => setQuickDays(7)}>直近7日</Button>
            <Button variant="secondary" onClick={() => setQuickDays(30)}>直近30日</Button>
            {/* 追加プリセット */}
            <Button variant="secondary" onClick={setThisWeek}>今週</Button>
            <Button variant="secondary" onClick={setThisMonth}>今月</Button>
            <Button variant="secondary" onClick={setThisYear}>今年</Button>
            {/* 全期間 */}
            <Button onClick={setAll}>全期間</Button>
          </div>
        </div>
        <p className="text-xs opacity-70">
          ※ 記録は端末の localStorage を走査して集計します（保存形式は変更しません）。<br />
          ※ <code>counts</code> が存在すれば回数も集計します（数値 / 数値配列 / {"{ total }"} / {"{ reps: [...] }"} に対応）。<br />
          ※ 「今週」は月曜はじまりで計算します（ISO週）。
        </p>
      </Card>

      {/* カテゴリ合計（セット / 回数） */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">カテゴリ合計</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {(["upper", "lower", "other"] as const).map((k) => (
            <div key={k} className="rounded-md border p-3 space-y-1">
              <div className="text-xs opacity-70">{catLabel[k]}</div>
              <div className="text-sm opacity-70">完了セット数</div>
              <div className="text-xl font-bold">{catTotals[k].sets}</div>
              <div className="text-sm opacity-70 mt-2">回数合計</div>
              <div className="text-xl font-bold">{catTotals[k].reps}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 明細テーブル（セット / 回数 / 実施日数） */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 pb-0">
          <h3 className="font-semibold">種目別 集計（{start || "—"} 〜 {end || "—"}）</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/5">
              <tr>
                <th className="px-4 py-2 text-left whitespace-nowrap">カテゴリ</th>
                <th className="px-4 py-2 text-left">種目</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">完了セット数</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">回数合計</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">実施日数</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center opacity-70">
                    集計対象の記録がありません
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">{catLabel[r.cat]}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-right">{r.setTotal}</td>
                    <td className="px-4 py-2 text-right">{r.repTotal}</td>
                    <td className="px-4 py-2 text-right">{r.daysCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
