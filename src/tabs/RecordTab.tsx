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

/** ===== 端末ローカル日付ユーティリティ ===== */
const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};
const todayStr = ymdLocal(new Date());

/** ===== 型（最低限） ===== */
type ExerciseItem = {
  id: string;
  name: string;
  category: "upper" | "lower" | "etc";
  enabled?: boolean;
  mode?: "check" | "count";
  sets?: number;        // 1..5
  repTarget?: number;   // 回数入力時のノルマ
  order?: number;
};

type ExercisesState = {
  upper: ExerciseItem[];
  lower: ExerciseItem[];
  etc: ExerciseItem[];
};

type DayRecord = {
  date: string;
  // 完了時刻（ISO文字列）: UI でチェック/回数入力した瞬間に push
  times?: Record<string, string[]>;
  // チェック/回数の保存
  sets?: Record<string, boolean[]>;  // check 用
  counts?: Record<string, number[]>; // count 用
  // メモ（カテゴリ別）
  notesUpper?: string;
  notesLower?: string;
  notesEtc?: string;
};

/** ===== メモ欄の記述例 ===== */
const MEMO_EXAMPLE = "（例）アーチャープッシュアップも10回やった";

/** ===== 設定ロード ===== */
function loadExercises(): ExercisesState {
  // 既存の KEY は "exercises" 前提
  const raw = loadJSON<any>("exercises");
  const fallback: ExercisesState = { upper: [], lower: [], etc: [] };
  if (!raw) return fallback;
  const pick = (arr?: any[]) =>
    Array.isArray(arr)
      ? arr.map((it: any) => ({
          id: String(it.id ?? ""),
          name: String(it.name ?? ""),
          category: (it.category ?? "etc") as ExerciseItem["category"],
          enabled: Boolean(it.enabled ?? true),
          mode: (it.mode ?? "check") as ExerciseItem["mode"],
          sets: Number(it.sets ?? 3),
          repTarget: it.mode === "count" ? Number(it.repTarget ?? 10) : undefined,
          order: Number(it.order ?? 1),
        }))
      : [];
  return {
    upper: pick(raw.upper).sort((a,b)=> (a.order??0)-(b.order??0)),
    lower: pick(raw.lower).sort((a,b)=> (a.order??0)-(b.order??0)),
    etc:   pick(raw.etc).sort((a,b)=> (a.order??0)-(b.order??0)),
  };
}

/** ===== インターバル（最新完了時刻との差）h ===== */
function hoursSince(iso?: string): number | null {
  if (!iso) return null;
  const last = new Date(iso).getTime();
  if (Number.isNaN(last)) return null;
  const now = Date.now();
  return Math.max(0, Math.floor((now - last) / (1000 * 60 * 60)));
}

export default function RecordTab() {
  const [ex, setEx] = useState<ExercisesState>({ upper: [], lower: [], etc: [] });
  const [rec, setRec] = useState<DayRecord>(() => {
    return (
      (loadDayRecord(todayStr) as DayRecord | null) ?? {
        date: todayStr,
        times: {},
        sets: {},
        counts: {},
      }
    );
  });

  useEffect(() => {
    setEx(loadExercises());
  }, []);

  // 保存ヘルパ
  const persist = (next: DayRecord) => {
    setRec(next);
    saveDayRecord(todayStr, next);
  };

  // 直近の完了時刻（種目ごと）
  const lastDoneMap = useMemo(() => {
    const m = new Map<string, string | undefined>();
    const t = rec.times ?? {};
    for (const [id, arr] of Object.entries(t)) {
      // 配列の中で最新（最大）を採用
      let latest: string | undefined = undefined;
      if (Array.isArray(arr)) {
        for (const v of arr) {
          if (!v) continue;
          if (!latest || v > latest) latest = v;
        }
      }
      if (latest) m.set(id, latest);
    }
    return m;
  }, [rec.times]);

  // UI：セクション共通レンダラ
  const renderCategory = (key: "upper" | "lower" | "etc", label: string) => {
    const items = ex[key].filter((i) => i.enabled !== false);

    return (
      <Card key={key} className="mb-4 p-3">
        <div className="mb-2 text-base font-bold">{label}</div>

        <div className="space-y-3">
          {items.map((it) => {
            const id = it.id;
            const setsArr = rec.sets?.[id] ?? [];
            const cntsArr = rec.counts?.[id] ?? [];
            const latestIso = lastDoneMap.get(id);
            const hours = hoursSince(latestIso ?? undefined);

            const nowISO = new Date().toISOString();

            const setSetsArr = (a: boolean[]) =>
              persist({
                ...rec,
                sets: { ...(rec.sets ?? {}), [id]: a },
                times: {
                  ...(rec.times ?? {}),
                  [id]: (rec.times?.[id] ?? []).slice(), // 触らない
                },
              });

            const setCountsArr = (a: number[]) =>
              persist({
                ...rec,
                counts: { ...(rec.counts ?? {}), [id]: a },
                times: {
                  ...(rec.times ?? {}),
                  [id]: (rec.times?.[id] ?? []).slice(), // 触らない
                },
              });

            // チェックのトグル時：true にしたら現在時刻を記録。false にしたらそのセットの時刻は削除。
            const toggleCheck = (idx: number) => {
              const next = [...setsArr];
              next[idx] = !next[idx];
              // times を同期
              const times = (rec.times?.[id] ?? []).slice();
              if (next[idx]) {
                times[idx] = nowISO;
              } else {
                times[idx] = ""; // 空なら無視される
              }
              persist({
                ...rec,
                sets: { ...(rec.sets ?? {}), [id]: next },
                times: { ...(rec.times ?? {}), [id]: times },
              });
            };

            // 回数入力：値が 0 以上なら時刻を記録、空/0 に戻したら時刻を消す
            const changeCount = (idx: number, val: number) => {
              const next = [...cntsArr];
              next[idx] = val;
              const times = (rec.times?.[id] ?? []).slice();
              if (val > 0) {
                times[idx] = nowISO;
              } else {
                times[idx] = "";
              }
              persist({
                ...rec,
                counts: { ...(rec.counts ?? {}), [id]: next },
                times: { ...(rec.times ?? {}), [id]: times },
              });
            };

            // 表示セット数
            const n = Math.max(1, Math.min(5, Number(it.sets ?? 3)));

            return (
              <div key={id} className="rounded-md border border-slate-200 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[15px] font-medium">{it.name}</div>
                  <div className="text-xs text-slate-500">
                    前回からのインターバル：{hours == null ? "-" : `${hours}H`}
                  </div>
                </div>

                {/* 入力ブロック（チェック or 回数） */}
                {it.mode !== "count" ? (
                  // チェックモード
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
                    {Array.from({ length: n }, (_, i) => (
                      <label key={i} className="flex items-center justify-center gap-2 rounded-md border p-2">
                        <Checkbox
                          className="h-[24px] w-[24px]"
                          checked={!!setsArr[i]}
                          onCheckedChange={() => toggleCheck(i)}
                        />
                        <span className="text-sm text-slate-600">{i + 1}セット</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  // 回数入力モード（セレクト）
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
                    {Array.from({ length: n }, (_, i) => (
                      <Select
                        key={i}
                        value={String(cntsArr[i] ?? "")}
                        onValueChange={(v) => changeCount(i, Number(v || 0))}
                      >
                        <SelectTrigger className="w-full h-[40px] justify-end pr-3">
                          <SelectValue placeholder={it.repTarget ? `ノルマ ${it.repTarget}` : "回数"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="">未入力</SelectItem>
                          {Array.from({ length: 99 }, (_, k) => k + 1).map((v) => (
                            <SelectItem key={v} value={String(v)}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* メモ欄 */}
        <div className="mt-3">
          <label className="mb-1 block text-sm text-slate-600">
            メモ（{label}） <span className="text-slate-400"> {MEMO_EXAMPLE}</span>
          </label>
          <Textarea
            className="text-sm"
            value={
              key === "upper"
                ? rec.notesUpper ?? ""
                : key === "lower"
                ? rec.notesLower ?? ""
                : rec.notesEtc ?? ""
            }
            onChange={(e) =>
              persist({
                ...rec,
                notesUpper: key === "upper" ? e.target.value : rec.notesUpper,
                notesLower: key === "lower" ? e.target.value : rec.notesLower,
                notesEtc: key === "etc" ? e.target.value : rec.notesEtc,
              })
            }
            placeholder={MEMO_EXAMPLE}
          />
        </div>
      </Card>
    );
  };

  // ====== 表示日付（右肩のみ表示／保存・復元UIは無し） ======
  const displayDate = useMemo(() => {
    const d = new Date();
    const w = ["日","月","火","水","木","金","土"][d.getDay()];
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}(${w})`;
  }, []);

  return (
    <div className="p-4 sm:p-6">
      {/* ヘッダー：右肩に日付のみ（保存/復元UIは削除） */}
      <div className="mb-4 flex items-center justify-end text-slate-600 whitespace-nowrap">
        {displayDate}
      </div>

      {renderCategory("upper", "上半身")}
      {renderCategory("lower", "下半身")}
      {renderCategory("etc", "その他")}
    </div>
  );
}
