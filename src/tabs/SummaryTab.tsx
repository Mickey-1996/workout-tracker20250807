// src/tabs/SummaryTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { loadDayRecord, loadJSON } from "@/lib/local-storage";
import { defaultExercises } from "@/lib/exercises-default";

// この画面だけで使う軽量型（types.tsは不変更）
type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";

type ExtendedExerciseItem = {
  id: string;
  name: string;
  category: Category;
  inputMode?: InputMode;
  checkCount?: number; // セット数（旧: sets 互換あり）
  sets?: number;
  enabled?: boolean;
  order?: number;
};

type Settings = { items: ExtendedExerciseItem[] };

type DayRecord = {
  date: string;
  // チェック入力: 種目ID => セットごとの完了フラグ
  sets: Record<string, boolean[]>;
  // 回数入力: 種目ID => セットごとの回数
  counts?: Record<string, number[] | number>; // 互換のため number も許容
};

type Row = {
  id: string;
  name: string;
  category: Category;
  mode: InputMode;
  total: number;        // count: 回数合計 / check: 完了セット合計
  unit: "回" | "セット";
};

// --------- 日付ユーティリティ ---------
const tz = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()); // ローカル日付固定
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => tz(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
const enumerateDates = (from: Date, to: Date) => {
  const out: string[] = [];
  for (let cur = tz(from); cur <= tz(to); cur = addDays(cur, 1)) out.push(toStr(cur));
  return out;
};
const startOfWeekMon = (d: Date) => {
  const day = d.getDay(); // 0:日
  const diff = day === 0 ? -6 : 1 - day; // 月始まり
  return addDays(d, diff);
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

// 既存データ互換：counts が number の場合は配列化
function normalizeCounts(counts: DayRecord["counts"]): Record<string, number[]> {
  if (!counts || typeof counts !== "object") return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(counts)) {
    if (Array.isArray(v)) out[k] = v.map((n) => Math.max(0, Math.floor(Number(n) || 0)));
    else if (typeof v === "number") out[k] = [Math.max(0, Math.floor(v))];
  }
  return out;
}

export default function SummaryTab() {
  const today = useMemo(() => tz(new Date()), []);
  const [from, setFrom] = useState<Date>(startOfMonth(today));
  const [to, setTo] = useState<Date>(today);

  // 設定（なければデフォルト）
  const [items, setItems] = useState<ExtendedExerciseItem[]>([]);
  useEffect(() => {
    const saved = loadJSON<Settings>("settings-v1");
    const arr = saved?.items?.length ? saved.items : (defaultExercises as ExtendedExerciseItem[]);
    // 非表示は集計対象から除外
    setItems(arr.filter((x) => x.enabled !== false));
  }, []);

  // 種目別の合計だけを算出（カテゴリ合計は表示しない）
  const rows: Row[] = useMemo(() => {
    if (!items.length) return [];

    const dates = enumerateDates(from, to);
    // 初期化
    const acc: Record<string, Row> = {};
    for (const it of items) {
      const mode: InputMode = it.inputMode ?? "check";
      acc[it.id] = {
        id: it.id,
        name: it.name,
        category: it.category,
        mode,
        total: 0,
        unit: mode === "count" ? "回" : "セット",
      };
    }

    // 走査
    for (const ds of dates) {
      const rec = loadDayRecord(ds) as DayRecord | null;
      if (!rec) continue;
      const counts = normalizeCounts(rec.counts);

      for (const it of items) {
        const row = acc[it.id];
        if (!row) continue;

        if (row.mode === "count") {
          // 回数合計
          const arr = counts[it.id] || [];
          row.total += arr.reduce((s, n) => s + (Number.isFinite(n) ? (n as number) : 0), 0);
        } else {
          // 完了セット合計（true数）
          const flags = rec.sets?.[it.id] || [];
          row.total += flags.reduce((s, b) => s + (b ? 1 : 0), 0);
        }
      }
    }

    // 表示順：カテゴリ→order→名前
    const orderMap = new Map(items.map((x) => [x.id, x.order ?? 0]));
    const catOrder: Record<Category, number> = { upper: 0, lower: 1, other: 2 };

    return Object.values(acc).sort((a, b) => {
      const ca = catOrder[a.category] - catOrder[b.category];
      if (ca !== 0) return ca;
      const oa = (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0);
      if (oa !== 0) return oa;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [items, from, to]);

  // クイック期間
  const setPreset = (key: "today" | "week" | "month" | "year") => {
    const base = tz(new Date());
    if (key === "today") {
      setFrom(base);
      setTo(base);
    } else if (key === "week") {
      setFrom(startOfWeekMon(base));
      setTo(base);
    } else if (key === "month") {
      setFrom(startOfMonth(base));
      setTo(base);
    } else {
      setFrom(startOfYear(base));
      setTo(base);
    }
  };

  return (
    <div className="space-y-4">
      {/* 期間コントロール */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex gap-3">
            <div>
              <div className="text-xs opacity-70">開始日</div>
              <Input
                type="date"
                value={toStr(from)}
                onChange={(e) => setFrom(new Date(e.target.value))}
                className="w-40"
              />
            </div>
            <div>
              <div className="text-xs opacity-70">終了日</div>
              <Input
                type="date"
                value={toStr(to)}
                onChange={(e) => setTo(new Date(e.target.value))}
                className="w-40"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPreset("today")}>今日</Button>
            <Button variant="secondary" onClick={() => setPreset("week")}>今週</Button>
            <Button variant="secondary" onClick={() => setPreset("month")}>今月</Button>
            <Button variant="secondary" onClick={() => setPreset("year")}>今年</Button>
          </div>
        </div>
      </Card>

      {/* 種目別集計のみ（カテゴリ合計は非表示） */}
      <Card className="p-4">
        <h2 className="text-base font-bold mb-3">種目別集計</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-3">カテゴリ</th>
                <th className="text-left py-2 pr-3">種目</th>
                <th className="text-left py-2 pr-3">方式</th>
                <th className="text-right py-2">合計</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center opacity-60">
                    集計対象のデータがありません
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">
                    {r.category === "upper" ? "上半身" : r.category === "lower" ? "下半身" : "その他"}
                  </td>
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3">{r.mode === "count" ? "回数入力" : "チェック"}</td>
                  <td className="py-2 text-right">
                    {r.total.toLocaleString()} {r.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
