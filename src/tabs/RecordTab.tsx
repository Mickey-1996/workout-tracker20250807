"use client";

import { useEffect, useState } from "react";
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

/* ========= メモ欄の記述例（全カテゴリ共通） ========= */
const MEMO_EXAMPLE = "（例）アーチャープッシュアップも10回やった";
/* ================================================ */

/** セルサイズ（チェック/回数とも同じサイズ：約1.3倍） */
const CELL = 52; // px
const GAP_PX = 8; // gap-2 相当
const GRID_WIDTH_PX = 3 * CELL + 2 * GAP_PX; // 1行3セル＋2ギャップを右寄せ

type DayRecord = {
  date: string;
  notesUpper?: string;
  notesLower?: string;
  notesOther?: string;
  sets: Record<string, boolean[]>;
  counts?: Record<string, number[]>;
  /** 追加：各セットの「正の入力（チェックON or 回数>0）」が最後に行われたISO時刻 */
  times?: Record<string, (string | null)[]>;
};

type ExercisesState = Record<
  string,
  { id: string; name: string; sets: number }[]
>;

type SettingsItem = {
  id: string;
  name: string;
  /** "check" or "count" */
  inputMode?: "check" | "count";
  /** セット数（チェック式の時の最大セット数） */
  checkCount?: number;
  /** セット数（count でも使う） */
  sets?: number;
  /** count入力のときのノルマ回数（プレースホルダー） */
  repTarget?: number;
  /** 表示順（小さいほど上） */
  order?: number;
  /** 所属カテゴリ */
  category: "upper" | "lower" | "other";
  /** 無効化フラグ */
  enabled?: boolean;
};

type Settings = {
  items?: SettingsItem[];
};

type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";

type MetaMap = Record<
  string,
  {
    mode: InputMode;
    setCount: number;
    repTarget?: number;
  }
>;

const todayStr = new Date().toISOString().split("T")[0];
const fmtDateJP = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

const hoursSince = (iso?: string): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 3600000));
};

const catLabel = (c: string) =>
  c === "upper" ? "上半身トレ" : c === "lower" ? "下半身トレ" : "その他";

const COUNT_MAX = 99;

/* 最終実施保持（ローカルストレージキー） */
type LastDoneMap = Record<string, string | undefined>;
type LastPrevMap = Record<string, string | undefined>;
const KEY_V1 = "lastDone-v1";
const KEY_V0 = "lastDone-v0"; // 互換キー
const KEY_PREV = "lastDone-prev";
const KEY_ALT = "lastDone";

function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="text-slate-600"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

export default function RecordTab() {
  /* 設定→メタ */
  const [meta, setMeta] = useState<MetaMap>({});
  useEffect(() => {
    const settings = loadJSON<Settings>("settings-v1");
    const items = settings?.items?.filter((x) => x.enabled !== false) ?? [];

    const m: MetaMap = {};
    for (const it of items) {
      const mode: InputMode = it.inputMode ?? "check";
      const setCount = Math.max(1, it.checkCount ?? it.sets ?? 3);
      m[it.id] = { mode, setCount, repTarget: it.repTarget };
    }
    setMeta(m);
  }, []);

  /* カテゴリ別配列 */
  const [exercises, setExercises] = useState<ExercisesState | null>(null);
  useEffect(() => {
    if (Object.keys(meta).length === 0) return;
    const settings = loadJSON<Settings>("settings-v1");
    const items = settings?.items?.filter((x) => x.enabled !== false) ?? [];
    const grouped: ExercisesState = { upper: [], lower: [], other: [] } as any;

    const sorted = [...items].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    for (const it of sorted) {
      grouped[it.category].push({
        id: it.id,
        name: it.name,
        sets: meta[it.id]?.setCount ?? it.sets ?? 3,
      });
    }
    setExercises(grouped);
  }, [meta]);

  /* 当日レコード */
  const [dayRecord, setDayRecord] = useState<DayRecord>({
    date: todayStr,
    notesUpper: "",
    notesLower: "",
    notesOther: "",
    sets: {},
    counts: {},
    times: {},
  });

  useEffect(() => {
    const loaded = loadDayRecord(todayStr) as Partial<DayRecord> | null;
    if (loaded) {
      setDayRecord({
        date: todayStr,
        notesUpper: loaded.notesUpper ?? "",
        notesLower: loaded.notesLower ?? "",
        notesOther: loaded.notesOther ?? "",
        sets: loaded.sets ?? {},
        counts: loaded.counts ?? {},
        times: loaded.times ?? {}, // 追加フィールドは後方互換
      });
    }
  }, []);

  const persist = (rec: DayRecord) => {
    setDayRecord(rec);
    (saveDayRecord as any)(todayStr, rec);
  };

  /* 最終実施（インターバル表示用） */
  const [lastDone, setLastDone] = useState<LastDoneMap>({});
  const [lastPrev, setLastPrev] = useState<LastPrevMap>({});
  useEffect(() => {
    const v1 = loadJSON<LastDoneMap>(KEY_V1);
    const v0 = loadJSON<LastDoneMap>(KEY_V0);
    const alt = loadJSON<LastDoneMap>(KEY_ALT);
    setLastDone(v1 ?? v0 ?? alt ?? {});
    setLastPrev(loadJSON<LastPrevMap>(KEY_PREV) ?? {});
  }, []);

  const writeLastAll = (map: LastDoneMap, prev: LastPrevMap) => {
    try {
      window.localStorage.setItem(KEY_V1, JSON.stringify(map));
      window.localStorage.setItem(KEY_V0, JSON.stringify(map)); // 互換
      window.localStorage.setItem(KEY_PREV, JSON.stringify(prev));
    } catch {}
  };

  /** 当日の times[*] から「その種目の最新実施時刻（最大）」を計算し、last-done を同期 */
  const recomputeAndSyncLastDone = (exerciseId: string, record: DayRecord) => {
    const arr = record.times?.[exerciseId] ?? [];
    // 有効なISOのみ→数値（エポック）で最大を算出
    let latestTs = 0;
    for (const t of arr) {
      if (!t) continue;
      const ts = Date.parse(t as string);
      if (!Number.isNaN(ts)) latestTs = Math.max(latestTs, ts);
    }
    const latest = latestTs ? new Date(latestTs).toISOString() : undefined;

    setLastDone((cur) => {
      if (latest) {
        if (cur[exerciseId] !== latest) {
          // 上書き前を prev に退避
          setLastPrev((pp) => {
            const nextPrev = { ...pp, [exerciseId]: cur[exerciseId] };
            const next = { ...cur, [exerciseId]: latest };
            writeLastAll(next, nextPrev);
            return nextPrev;
          });
          return { ...cur, [exerciseId]: latest };
        }
        return cur; // 変更なし
      } else {
        if (cur[exerciseId]) {
          const next = { ...cur };
          delete next[exerciseId];
          writeLastAll(next, lastPrev);
          return next;
        }
        return cur;
      }
    });
  };

  /* チェック切り替え */
  const toggleSet = (exerciseId: string, setIndex: number, on?: boolean) => {
    const sets = { ...(dayRecord.sets || {}) };
    const arr = [...(sets[exerciseId] ?? [])];
    const nowOn = on ?? !arr[setIndex];

    // 足りない分は false で埋める
    const needLen = Math.max(setIndex + 1, arr.length);
    for (let i = 0; i < needLen; i++) if (arr[i] == null) arr[i] = false;

    arr[setIndex] = nowOn;
    sets[exerciseId] = arr;

    // times を更新
    const times = { ...(dayRecord.times || {}) };
    const tArr = [...(times[exerciseId] ?? [])];
    if (nowOn) {
      tArr[setIndex] = new Date().toISOString();
    } else {
      tArr[setIndex] = null; // 取消
    }
    times[exerciseId] = tArr;

    const next: DayRecord = { ...dayRecord, sets, times };
    persist(next);
    // 最新実施時刻を再計算して反映
    recomputeAndSyncLastDone(exerciseId, next);
  };

  /* 回数選択（0～99のセレクト） */
  const changeCount = (exerciseId: string, setIndex: number, value: string) => {
    let n = Math.floor(Number(value || "0"));
    if (!Number.isFinite(n) || n < 0) n = 0;

    const counts = { ...(dayRecord.counts || {}) };
    const cArr = [...(counts[exerciseId] ?? [])];
    // 足りない分は0で埋める
    const needLen = Math.max(setIndex + 1, cArr.length);
    for (let i = 0; i < needLen; i++) if (cArr[i] == null) cArr[i] = 0;
    cArr[setIndex] = n;
    counts[exerciseId] = cArr;

    // times を更新（回数>0 なら記録、0なら取消）
    const times = { ...(dayRecord.times || {}) };
    const tArr = [...(times[exerciseId] ?? [])];
    if (n > 0) {
      tArr[setIndex] = new Date().toISOString();
    } else {
      tArr[setIndex] = null;
    }
    times[exerciseId] = tArr;

    const next: DayRecord = { ...dayRecord, counts, times };
    persist(next);
    recomputeAndSyncLastDone(exerciseId, next);
  };

  /* ノート */
  const handleCatNotesChange = (cat: Category, value: string) => {
    if (cat === "upper") return persist({ ...dayRecord, notesUpper: value ?? "" });
    if (cat === "lower") return persist({ ...dayRecord, notesLower: value ?? "" });
    return persist({ ...dayRecord, notesOther: value ?? "" });
  };

  /* ラベル */
  const recoveryText = (exerciseId: string) => {
    const h = hoursSince(lastDone[exerciseId]);
    if (h == null) return "—";
    if (h < 1) return "<1H";
    return `${h}H`;
  };

  if (!exercises) {
    return <div>種目データがありません。（設定タブで種目を追加してください）</div>;
  }

  /* 見出し行：タイトル左、日付右 */
  const Header = () => (
    <div className="flex items-center gap-3 mb-4">
      <img
        src="/icons/icon-192x192.png"
        alt="icon"
        className="w-10 h-10 rounded-md"
      />
      <h1 className="text-lg font-bold">筋トレ記録</h1>
      <div className="ml-auto flex items-center gap-1 text-slate-600">
        <CalendarIcon />
        <span className="text-sm">{fmtDateJP(todayStr)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <Header />

      {Object.entries(exercises).map(([category, categoryExercises]) => {
        const cat = category as Category;
        const notesValue =
          cat === "upper"
            ? dayRecord.notesUpper ?? ""
            : cat === "lower"
            ? dayRecord.notesLower ?? ""
            : dayRecord.notesOther ?? "";

        return (
          <Card key={category} className="p-4">
            <h2 className="text-base font-bold mb-3">{catLabel(category)}</h2>

            {categoryExercises.map((ex) => {
              const m = meta[ex.id];
              const mode = m?.mode ?? "check";
              const setCount = m?.setCount ?? ex.sets ?? 3;
              const repTarget = m?.repTarget;

              return (
                <div key={ex.id} className="border-b last:border-b-0 py-3">
                  {/* 1行目：種目名 + インターバル */}
                  <div className="flex items-center gap-3">
                    <div className="text-[15px] sm:text-base font-medium">
                      {ex.name}
                    </div>
                    <div className="ml-auto w-full sm:w-auto text-sm text-slate-500 text-right">
                      前回からのインターバル：{recoveryText(ex.id)}
                    </div>
                  </div>

                  {/* 2行目：右寄せ 3列グリッド（幅は style で確実に適用） */}
                  <div className="mt-2 ml-auto" style={{ width: GRID_WIDTH_PX }}>
                    {mode === "count" ? (
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: setCount }).map((_, idx) => {
                          const cur = dayRecord.counts?.[ex.id]?.[idx] ?? 0;
                          return (
                            <Select
                              key={idx}
                              value={String(cur)}
                              onValueChange={(v) => changeCount(ex.id, idx, v)}
                            >
                              <SelectTrigger
                                className="h-[52px] w-[52px] text-base justify-center"
                                style={{ width: CELL, height: CELL }}
                              >
                                <SelectValue
                                  placeholder={
                                    repTarget != null ? String(repTarget) : undefined
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                {Array.from({ length: COUNT_MAX + 1 }, (_, n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: setCount }).map((_, idx) => {
                          const on = !!dayRecord.sets?.[ex.id]?.[idx];
                          return (
                            <button
                              key={idx}
                              onClick={() => toggleSet(ex.id, idx)}
                              className="inline-flex items-center justify-center rounded-md border border-slate-300"
                              style={{ width: CELL, height: CELL }}
                            >
                              <Checkbox
                                checked={on}
                                onCheckedChange={(v) =>
                                  toggleSet(ex.id, idx, !!v)
                                }
                                className="w-[26px] h-[26px]" // 視認性を上げるため大きめ
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* メモ（カテゴリごと） */}
            <div className="mt-3">
              <label className="block text-sm text-slate-600 mb-1">
                {cat === "upper" ? "上半身メモ" : cat === "lower" ? "下半身メモ" : "その他メモ"}
              </label>
              <Textarea
                className="text-sm"
                value={notesValue}
                onChange={(e) => handleCatNotesChange(cat, e.target.value)}
                placeholder={MEMO_EXAMPLE}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
