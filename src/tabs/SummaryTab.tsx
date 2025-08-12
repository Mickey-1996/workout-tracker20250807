// src/tabs/SummaryTab.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { DayPicker } from "react-day-picker";

// 設定/記録の読み書き
import { loadDayRecord, loadJSON } from "@/lib/local-storage";
import { defaultExercises } from "@/lib/exercises-default";

/* ===================== 画面内限定の軽量型（types.tsは不変更） ===================== */
type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";

type ExtendedExerciseItem = {
  id: string;
  name: string;
  category: Category;
  inputMode?: InputMode;
  checkCount?: number;   // セット数（旧: sets 互換）
  sets?: number;
  enabled?: boolean;
  order?: number;
  repTarget?: number;    // 回数入力時のノルマ
};

type Settings = { items: ExtendedExerciseItem[] };

type DayRecord = {
  date: string;
  sets: Record<string, boolean[]>;
  counts?: Record<string, number[] | number>;
  notesUpper?: string;
  notesLower?: string;
  notesOther?: string;
};

/* ===================== 日付ユーティリティ ===================== */
const tz = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => tz(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
const enumerateDates = (from: Date, to: Date) => {
  const out: string[] = [];
  for (let cur = tz(from); cur <= tz(to); cur = addDays(cur, 1)) out.push(toStr(cur));
  return out;
};
const startOfWeekMon = (d: Date) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

/* ===================== 互換ヘルパ ===================== */
function normalizeCounts(counts: DayRecord["counts"]): Record<string, number[]> {
  if (!counts || typeof counts !== "object") return {};
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(counts)) {
    if (Array.isArray(v)) out[k] = v.map((n) => Math.max(0, Math.floor(Number(n) || 0)));
    else if (typeof v === "number") out[k] = [Math.max(0, Math.floor(v))];
  }
  return out;
}
function hasContent(rec: DayRecord | null): boolean {
  if (!rec) return false;
  if (rec.notesUpper || rec.notesLower || rec.notesOther) return true;
  for (const arr of Object.values(rec.sets || {})) if (arr?.some(Boolean)) return true;
  const counts = normalizeCounts(rec.counts);
  for (const arr of Object.values(counts)) if (arr?.some((n) => (n ?? 0) > 0)) return true;
  return false;
}

/* ===================== 種目別集計テーブルの行型 ===================== */
type Row = {
  id: string;
  name: string;
  category: Category;
  mode: InputMode;
  total: number;
  unit: "回" | "セット";
};

export default function SummaryTab() {
  const today = useMemo(() => tz(new Date()), []);
  const [from, setFrom] = useState<Date>(startOfMonth(today));
  const [to, setTo] = useState<Date>(today);

  // ===== 設定（なければデフォルト） =====
  const [items, setItems] = useState<ExtendedExerciseItem[]>([]);
  useEffect(() => {
    const saved = loadJSON<Settings>("settings-v1");
    const arr = saved?.items?.length ? saved.items : (defaultExercises as ExtendedExerciseItem[]);
    setItems(arr.filter((x) => x.enabled !== false));
  }, []);

  // ===== カレンダー（月） =====
  const [month, setMonth] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [daysWithRecord, setDaysWithRecord] = useState<Date[]>([]);
  useEffect(() => {
    const mStart = startOfMonth(month);
    const mEnd = endOfMonth(month);
    const list: Date[] = [];
    for (let d = tz(mStart); d <= mEnd; d = addDays(d, 1)) {
      const rec = loadDayRecord(toStr(d)) as DayRecord | null;
      if (hasContent(rec)) list.push(new Date(d));
    }
    setDaysWithRecord(list);
  }, [month]);

  const [snapshot, setSnapshot] = useState<DayRecord | null>(null);
  useEffect(() => {
    if (!selectedDate) {
      setSnapshot(null);
      return;
    }
    const rec = loadDayRecord(toStr(selectedDate)) as DayRecord | null;
    setSnapshot(rec && hasContent(rec) ? rec : null);
  }, [selectedDate]);

  // ===== 種目別の合計（カテゴリ合計は表示しない） =====
  const rows: Row[] = useMemo(() => {
    if (!items.length) return [];

    const dates = enumerateDates(from, to);
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

    for (const ds of dates) {
      const rec = loadDayRecord(ds) as DayRecord | null;
      if (!rec) continue;
      const counts = normalizeCounts(rec.counts);

      for (const it of items) {
        const row = acc[it.id];
        if (!row) continue;

        if (row.mode === "count") {
          const arr = counts[it.id] || [];
          row.total += arr.reduce((s, n) => s + (Number.isFinite(n) ? (n as number) : 0), 0);
        } else {
          const flags = rec.sets?.[it.id] || [];
          row.total += flags.reduce((s, b) => s + (b ? 1 : 0), 0);
        }
      }
    }

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

  const setPreset = (key: "today" | "week" | "month" | "year") => {
    const base = tz(new Date());
    if (key === "today") {
      setFrom(base); setTo(base);
    } else if (key === "week") {
      setFrom(startOfWeekMon(base)); setTo(base);
    } else if (key === "month") {
      setFrom(startOfMonth(base)); setTo(base);
    } else {
      setFrom(startOfYear(base)); setTo(base);
    }
  };

  /* ===================== UI ===================== */
  return (
    <div className="space-y-4">
      {/* カレンダー & 日別スナップショット */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* カレンダー */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">日別記録カレンダー</h2>
            <div className="flex gap-1">
              <Button variant="secondary" onClick={() => setMonth(addDays(startOfMonth(month), -1))}>
                ←
              </Button>
              <Button variant="secondary" onClick={() => setMonth(addDays(endOfMonth(month), 1))}>
                →
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-2">
            {/* CSS 変数はラッパーに適用して型安全に */}
            <div
              className="rdp text-[15px] sm:text-base"
              style={{ ["--rdp-cell-size" as any]: "48px" } as CSSProperties}
            >
              <DayPicker
                mode="single"
                month={month}
                onMonthChange={setMonth}
                selected={selectedDate}
                onSelect={setSelectedDate}
                showOutsideDays
                weekStartsOn={1}
                styles={{
                  head_cell: { fontSize: "12px", color: "rgb(100 116 139)" } as CSSProperties,
                  day: { margin: 2 } as CSSProperties,
                }}
                modifiers={{
                  recorded: daysWithRecord,
                  today: tz(new Date()),
                }}
                modifiersClassNames={{
                  recorded:
                    "relative after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-emerald-500",
                  selected: "bg-emerald-500 text-white hover:bg-emerald-600",
                  today: "ring-2 ring-emerald-400",
                  outside: "text-slate-300",
                  disabled: "opacity-40",
                }}
              />
            </div>
          </div>

          {/* 凡例 */}
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              記録あり
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded-sm ring-2 ring-emerald-400" />
              今日
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded-sm bg-emerald-500" />
              選択日
            </div>
          </div>

          <p className="mt-2 text-xs opacity-70">
            月を移動すると、その月で記録がある日に自動でドットが表示されます。日付をタップすると、右側に内容が表示されます。
          </p>
        </Card>

        {/* 日別スナップショット */}
        <Card className="p-4">
          <h2 className="text-base font-bold mb-3">
            {selectedDate ? `${toStr(selectedDate)} の記録` : "日付を選択してください"}
          </h2>

          {!selectedDate && <div className="text-sm opacity-70">カレンダーから日付を選ぶと内容が表示されます。</div>}

          {selectedDate && !snapshot && (
            <div className="text-sm opacity-70">この日には保存された記録がありません。</div>
          )}

          {selectedDate && snapshot && (
            <div className="space-y-4">
              {(["upper", "lower", "other"] as Category[]).map((cat) => {
                const catItems = items.filter((x) => x.category === cat);
                if (catItems.length === 0) return null;

                return (
                  <div key={cat}>
                    <div className="font-semibold mb-1">
                      {cat === "upper" ? "上半身" : cat === "lower" ? "下半身" : "その他"}
                    </div>
                    <div className="space-y-2">
                      {catItems.map((it) => {
                        const mode: InputMode = it.inputMode ?? "check";
                        const checks = Math.max(1, it.checkCount ?? it.sets ?? 3);

                        if (mode === "count") {
                          const counts = normalizeCounts(snapshot.counts)[it.id] || [];
                          const shown = Array.from({ length: checks }).map((_, i) => counts[i] ?? 0);
                          const sum = shown.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
                          return (
                            <div key={it.id} className="text-sm">
                              <div className="font-medium">{it.name}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {shown.map((n, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <span className="text-xs opacity-70">S{i + 1}</span>
                                    <span className="rounded border px-2 py-1">{n} 回</span>
                                  </div>
                                ))}
                                <span className="ml-auto text-xs opacity-70">合計 {sum} 回</span>
                              </div>
                            </div>
                          );
                        } else {
                          const flags = (snapshot.sets?.[it.id] || []).slice(0, checks);
                          const done = flags.filter(Boolean).length;
                          return (
                            <div key={it.id} className="text-sm">
                              <div className="font-medium">{it.name}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {Array.from({ length: checks }).map((_, i) => (
                                  <Checkbox key={i} checked={Boolean(flags[i])} disabled className="h-5 w-5" />
                                ))}
                                <span className="ml-auto text-xs opacity-70">
                                  完了 {done}/{checks} セット
                                </span>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>

                    {( (cat === "upper" && snapshot.notesUpper) ||
                       (cat === "lower" && snapshot.notesLower) ||
                       (cat === "other" && snapshot.notesOther) ) && (
                      <div className="mt-2 text-xs opacity-80 whitespace-pre-wrap">
                        {cat === "upper" ? snapshot.notesUpper : cat === "lower" ? snapshot.notesLower : snapshot.notesOther}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

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

      {/* 種目別集計のみ */}
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
