"use client";

import { useEffect, useMemo, useState, CSSProperties } from "react";
import { Card } from "@/components/ui/Card";
import { loadDayRecord, loadJSON } from "@/lib/local-storage";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

/* ================== 型 ================== */
type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";

type SettingsItem = {
  id: string;
  name: string;
  category: Category;
  enabled?: boolean;
  order?: number;
  inputMode?: InputMode;
  checkCount?: number;
  sets?: number;
  repTarget?: number;
};

type Settings = { items: SettingsItem[] };

type DayRecord = {
  date: string; // "YYYY-MM-DD"
  notesUpper?: string;
  notesLower?: string;
  notesOther?: string;
  sets?: Record<string, boolean[]>;
  counts?: Record<string, number[]>;
  times?: Record<string, (string | null)[]>;
};
/* ======================================== */

/* 端末ローカル YYYY-MM-DD */
const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};

const isSameDayLocal = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/* 月内の全日付配列（ローカル時間） */
const getMonthDates = (month: Date) => {
  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1);
  const nextMonth = new Date(y, m + 1, 1);
  const days: Date[] = [];
  for (let d = new Date(first); d < nextMonth; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
};

/* 記録があるかの判定（当該日の DayRecord に何か入っているか） */
const hasAnyRecord = (rec: Partial<DayRecord> | null | undefined) => {
  if (!rec) return false;
  // メモ・チェック・回数のいずれかが存在
  if (rec.notesUpper || rec.notesLower || rec.notesOther) return true;
  if (rec.sets) {
    for (const arr of Object.values(rec.sets)) {
      if (arr?.some(Boolean)) return true;
    }
  }
  if (rec.counts) {
    for (const arr of Object.values(rec.counts)) {
      if (arr?.some((n) => (n ?? 0) > 0)) return true;
    }
  }
  return false;
};

/* order 昇順（同値時は名前） */
const sortByOrder = <T extends { order?: number; name?: string }>(a: T, b: T) =>
  (a.order ?? 0) - (b.order ?? 0) || (a.name ?? "").localeCompare(b.name ?? "");

/* 小さなチェック描画（読み取り専用・サマリー用） */
function TinyCheck({ on }: { on: boolean }) {
  return (
    <div
      className={`w-6 h-6 rounded-md border grid place-items-center ${
        on ? "bg-emerald-500 border-emerald-600 text-white" : "border-slate-300"
      }`}
    >
      {on ? "✓" : ""}
    </div>
  );
}

/* 数値チップ（読み取り専用・サマリー用） */
function TinyCount({ n }: { n: number }) {
  return (
    <div className="w-10 h-6 rounded-md border border-slate-300 text-center text-sm leading-6">
      {n}
    </div>
  );
}

/* 選択日の属する週（Mon-Sun）の開始/終了（ローカル） */
const startOfWeekMon = (d: Date) => {
  const day = d.getDay(); // 0:Sun ... 6:Sat
  const diff = (day + 6) % 7; // Mon=0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
};
const weekDatesMonSun = (d: Date) => {
  const start = startOfWeekMon(d);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
};

export default function SummaryTab() {
  /* 月/選択日（ローカル時間） */
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  /* 設定（順序反映のために利用） */
  const [items, setItems] = useState<SettingsItem[]>([]);
  useEffect(() => {
    const s = loadJSON<Settings>("settings-v1");
    const enabled = s?.items?.filter((x) => x.enabled !== false) ?? [];
    setItems(enabled.sort(sortByOrder));
  }, []);

  /* 月内の「記録あり」日付を取得（loadDayRecord を日ごと呼ぶ） */
  const daysWithRecord = useMemo(() => {
    const days = getMonthDates(month);
    const acc: Date[] = [];
    for (const d of days) {
      const rec = loadDayRecord(ymdLocal(d));
      if (hasAnyRecord(rec)) acc.push(new Date(d));
    }
    return acc;
  }, [month]);

  /* 選択日の記録を取得 */
  const [selectedRecord, setSelectedRecord] = useState<Partial<DayRecord> | null>(null);
  useEffect(() => {
    if (!selectedDate) {
      setSelectedRecord(null);
      return;
    }
    const rec = loadDayRecord(ymdLocal(selectedDate));
    setSelectedRecord(rec ?? null);
  }, [selectedDate]);

  /* 週合計（選択日の属する週） */
  const weekAgg = useMemo(() => {
    const days = weekDatesMonSun(selectedDate);
    let countSum = 0;
    let setSum = 0;
    for (const d of days) {
      const rec = loadDayRecord(ymdLocal(d)) as Partial<DayRecord> | null;
      if (!rec) continue;
      if (rec.counts) {
        for (const arr of Object.values(rec.counts)) {
          if (!arr) continue;
          for (const n of arr) countSum += Math.max(0, Number(n ?? 0));
        }
      }
      if (rec.sets) {
        for (const arr of Object.values(rec.sets)) {
          if (!arr) continue;
          for (const v of arr) setSum += v ? 1 : 0;
        }
      }
    }
    const start = days[0];
    const end = days[6];
    return {
      rangeLabel: `${ymdLocal(start)} 〜 ${ymdLocal(end)}`,
      countSum,
      setSum,
    };
  }, [selectedDate]);

  /* DayPicker の見た目（◯で囲む：小さめ） */
  const dayPickerStyles: Partial<Record<string, CSSProperties>> = {
    root: { ["--rdp-cell-size" as any]: "50px" } as CSSProperties,
    head_cell: { fontSize: "12px", color: "rgb(100 116 139)" },
    day: { margin: 2 },
  };

  return (
    <div className="space-y-6">
      {/* カレンダー */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">カレンダー</h2>
          <div className="text-sm text-slate-500">{ymdLocal(today)}（今日）</div>
        </div>

        <DayPicker
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={selectedDate}
          onSelect={(d) => d && setSelectedDate(d)}
          showOutsideDays
          weekStartsOn={1}
          className="rdp text-[15px] sm:text-base"
          styles={dayPickerStyles as any}
          modifiers={{
            recorded: daysWithRecord,
            today: today,
          }}
          /* ▼ 記録あり：◯（小さめ） */
          modifiersClassNames={{
            // relative + after: 擬似要素で小さめリングを描画
            recorded:
              "relative after:content-[''] after:absolute after:inset-[7px] after:rounded-full after:ring-2 after:ring-emerald-500 after:ring-offset-2 after:ring-offset-white dark:after:ring-offset-slate-900",
            selected: "bg-emerald-500 text-white hover:bg-emerald-600",
            today: "ring-2 ring-emerald-400",
            outside: "text-slate-300",
            disabled: "opacity-40",
          }}
        />

        {/* 凡例 */}
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            {/* ◯（小）のプレビュー */}
            <span className="relative inline-block w-4 h-4">
              <span className="absolute inset-[2px] rounded-full ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" />
            </span>
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
      </Card>

      {/* 週合計（選択日の属する週） */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">週合計（選択日の属する週）</h2>
          <div className="text-sm text-slate-500">{weekAgg.rangeLabel}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-slate-500">回数 合計</div>
            <div className="text-2xl font-bold">{weekAgg.countSum}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-slate-500">セット 合計</div>
            <div className="text-2xl font-bold">{weekAgg.setSum}</div>
          </div>
        </div>
      </Card>

      {/* 選択日の記録詳細 */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">選択日の記録</h2>
          <div className="text-sm text-slate-500">{ymdLocal(selectedDate)}</div>
        </div>

        {/* 記録なし */}
        {!hasAnyRecord(selectedRecord) && (
          <div className="text-sm text-slate-500">この日に保存された記録はありません。</div>
        )}

        {/* 記録あり（種目別） */}
        {hasAnyRecord(selectedRecord) && (
          <div className="space-y-5">
            {(["upper", "lower", "other"] as Category[]).map((cat) => {
              const catItems = items.filter((x) => x.category === cat);
              if (catItems.length === 0) return null;

              const catTitle = cat === "upper" ? "上半身" : cat === "lower" ? "下半身" : "その他";
              const anyInCat =
                catItems.some((it) => {
                  const checks = selectedRecord?.sets?.[it.id] ?? [];
                  const counts = selectedRecord?.counts?.[it.id] ?? [];
                  return checks.some(Boolean) || counts.some((n) => (n ?? 0) > 0);
                }) ||
                !!(cat === "upper"
                  ? selectedRecord?.notesUpper
                  : cat === "lower"
                  ? selectedRecord?.notesLower
                  : selectedRecord?.notesOther);

              if (!anyInCat) return null;

              return (
                <section key={cat}>
                  <h3 className="text-sm font-bold mb-2">{catTitle}</h3>

                  <div className="space-y-3">
                    {catItems.map((it) => {
                      const checks = selectedRecord?.sets?.[it.id] ?? [];
                      const counts = selectedRecord?.counts?.[it.id] ?? [];
                      const have =
                        checks.some(Boolean) || counts.some((n) => (n ?? 0) > 0);
                      if (!have) return null;

                      return (
                        <div key={it.id} className="border rounded-md p-2">
                          <div className="text-sm font-medium mb-2">{it.name}</div>

                          {/* チェックのサマリ */}
                          {checks.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {checks.map((on, idx) => (
                                <TinyCheck key={idx} on={!!on} />
                              ))}
                            </div>
                          )}

                          {/* 回数のサマリ */}
                          {counts.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {counts.map((n, idx) => (
                                <TinyCount key={idx} n={n ?? 0} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* メモ */}
                  <div className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
                    {cat === "upper"
                      ? selectedRecord?.notesUpper
                      : cat === "lower"
                      ? selectedRecord?.notesLower
                      : selectedRecord?.notesOther}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
