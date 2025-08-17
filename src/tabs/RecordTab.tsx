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
  ExercisesState,
  DayRecord,
  InputMode,
  Category,
} from "@/lib/types";

/** ===== 端末ローカル日付ユーティリティ ===== */
function toYmd(d: Date): string {
  // 端末ローカルのYYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ===== 設定ロード（v2優先→旧フォーマットfallback） ===== */
function loadExercises(): ExercisesGrouped {
  // 1) v2: items+order 形式(SettingsTab 保存先)
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
        sets: it.sets ?? it.checkCount ?? 3,
        checkCount: it.checkCount,
        repTarget: it.repTarget,
        order: it.order,
      };
      if (item.category === "upper" || item.category === "lower" || item.category === "etc") {
        grouped[item.category].push(item);
      } else {
        // その他カテゴリは etc に寄せる
        grouped.etc.push(item);
      }
    }
    for (const k of ["upper", "lower", "etc"] as const) {
      grouped[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return grouped;
  }

  // 2) 旧：カテゴリごとの配列
  const raw = loadJSON<any>("exercises");
  const fallback: ExercisesGrouped = { upper: [], lower: [], etc: [] };
  if (!raw) return fallback;

  const pick = (arr?: any[]) =>
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
    upper: pick(raw.upper),
    lower: pick(raw.lower),
    etc: pick(raw.etc),
  };
  for (const k of ["upper", "lower", "etc"] as const) {
    grouped[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return grouped;
}

/** ====== セット数の配列を作る ====== */
function makeSetArray(n: number): number[] {
  const c = Math.max(1, Math.min(10, isFinite(n) ? Math.floor(n) : 3));
  return Array.from({ length: c }, (_, i) => i);
}

/** ===== 本体 ===== */
export default function RecordTab() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toYmd(today), [today]);
  const displayDate = useMemo(
    () => `${today.getMonth() + 1}/${today.getDate()} (${["日","月","火","水","木","金","土"][today.getDay()]})`,
    [today]
  );

  const exercises = useMemo(() => loadExercises(), []);

  // 記録の初期値（notesは必須に寄せて空文字で用意）
  const [rec, setRec] = useState<DayRecord>(() => {
    const loaded = loadDayRecord(todayStr) as DayRecord | undefined;
    const base: DayRecord = loaded ?? {
      date: todayStr,
      times: {},
      sets: {},
      counts: {},
      notesUpper: "",
      notesLower: "",
      notesEtc: "",
      // notesOther は任意
    };
    // 念のため穴埋め
    return {
      ...base,
      notesUpper: base.notesUpper ?? "",
      notesLower: base.notesLower ?? "",
      notesEtc: base.notesEtc ?? "",
      // @ts-expect-error 任意フィールドの互換穴埋め
      notesOther: (base as any).notesOther ?? "",
    };
  });

  // 直近の完了時刻（種目ID -> ISO）
  const [lastDone, setLastDone] = useState<Record<string, string>>({});

  // 保存ヘルパー：notesを必須化してから保存（★ビルドエラー対処の本丸）
  const persist = (next: DayRecord) => {
    const normalized: DayRecord = {
      ...next,
      notesUpper: next.notesUpper ?? "",
      notesLower: next.notesLower ?? "",
      notesEtc: next.notesEtc ?? "",
      // @ts-expect-error 互換
      notesOther: (next as any).notesOther ?? "",
    };
    setRec(normalized);
    saveDayRecord(todayStr, normalized);
  };

  // 完了時刻の更新
  const markDone = (id: string) => {
    const iso = new Date().toISOString();
    setLastDone((prev) => ({ ...prev, [id]: iso }));
    persist({
      ...rec,
      times: { ...(rec.times ?? {}), [id]: [...(rec.times?.[id] ?? []), iso] },
    });
  };

  /** ===== UI: カテゴリレンダリング ===== */
  const renderCategory = (key: "upper" | "lower" | "etc", label: string) => {
    const items = exercises[key].filter((it) => (it.enabled ?? true));
    return (
      <Card className="mb-6 p-4">
        <div className="mb-2 font-semibold">{label}</div>
        <div className="space-y-4">
          {items.map((it) => {
            const id = it.id;
            const mode = (it.mode ?? it.inputMode ?? "check") as InputMode;
            const setCount = it.sets ?? it.checkCount ?? 3;

            if (mode === "count") {
              const counts = rec.counts?.[id] ?? Array.from({ length: setCount }, () => 0);
              const update = (idx: number, val: number) => {
                const nextCounts = [...counts];
                nextCounts[idx] = val;
                const next = {
                  ...rec,
                  counts: { ...(rec.counts ?? {}), [id]: nextCounts },
                };
                persist(next);
              };
              return (
                <div key={id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 text-sm text-slate-700">{it.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {makeSetArray(setCount).map((idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">S{idx + 1}</span>
                        <Select
                          value={String(counts[idx] ?? 0)}
                          onValueChange={(v) => update(idx, Number(v))}
                        >
                          <SelectTrigger className="h-8 w-20">
                            <SelectValue placeholder="0" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: (it.repTarget ?? 20) + 1 }, (_, n) => n).map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // check モード
            const checks = rec.sets?.[id] ?? Array.from({ length: setCount }, () => false);
            const toggle = (idx: number) => {
              const nextChecks = [...checks];
              nextChecks[idx] = !nextChecks[idx];
              const next = {
                ...rec,
                sets: { ...(rec.sets ?? {}), [id]: nextChecks },
              };
              persist(next);
              if (nextChecks[idx]) markDone(id);
            };

            return (
              <div key={id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-sm text-slate-700">{it.name}</div>
                <div className="flex flex-wrap gap-2">
                  {makeSetArray(setCount).map((idx) => (
                    <label key={idx} className="flex items-center gap-2 rounded-md border px-2 py-1">
                      <Checkbox checked={!!checks[idx]} onCheckedChange={() => toggle(idx)} />
                      <span className="text-xs text-slate-600">S{idx + 1}</span>
                    </label>
                  ))}
                </div>
                {lastDone[id] && (
                  <div className="mt-1 text-xs text-slate-400">
                    最終: {new Date(lastDone[id]).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* カテゴリメモ */}
        <div className="mt-4">
          <div className="mb-1 text-xs text-slate-500">メモ（{label}）</div>
          <Textarea
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
            placeholder="今日の気づき・注意点など"
          />
        </div>
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {/* ヘッダー：右肩に日付 */}
      <div className="mb-4 flex items-center justify-end text-slate-600 whitespace-nowrap">
        {displayDate}
      </div>

      {renderCategory("upper", "上半身")}
      {renderCategory("lower", "下半身")}
      {renderCategory("etc", "その他")}
    </div>
  );
}
