"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** セルサイズ（チェック/回数とも同じサイズ） */
const CELL = 52; // px
const GAP_PX = 8; // gap-2 相当
const GRID_WIDTH_PX = 3 * CELL + 2 * GAP_PX; // 1行3セル＋2ギャップを右寄せ

/* === 端末タイムゾーンで YYYY-MM-DD を作る === */
const ymdLocal = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayStr = ymdLocal();
const fmtDateJP = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

type DayRecord = {
  date: string;
  notesUpper?: string;
  notesLower?: string;
  notesOther?: string;
  sets: Record<string, boolean[]>;
  counts?: Record<string, number[]>;
  /** 各セットで「正の入力（チェックor回数>0）」が行われたISO時刻 */
  times?: Record<string, (string | null)[]>;
};

type ExercisesState = Record<
  string,
  { id: string; name: string; sets: number }[]
>;

type SettingsItem = {
  id: string;
  name: string;
  inputMode?: "check" | "count";
  checkCount?: number;
  sets?: number;
  repTarget?: number;
  order?: number;
  category: "upper" | "lower" | "other";
  enabled?: boolean;
};
type Settings = { items?: SettingsItem[] };
type Category = "upper" | "lower" | "other";
type InputMode = "check" | "count";
type MetaMap = Record<
  string,
  { mode: InputMode; setCount: number; repTarget?: number }
>;

const COUNT_MAX = 99;

/* 最終実施保持（ローカルストレージキー） */
type LastDoneMap = Record<string, string | undefined>;
type LastPrevMap = Record<string, string | undefined>;
const KEY_V1 = "lastDone-v1";
const KEY_V0 = "lastDone-v0"; // 互換キー
const KEY_PREV = "lastDone-prev";
const KEY_ALT = "lastDone";

/* 記録タブのバックアップ・変更監視キー */
const KEY_BACKUP_SAVED_AT = "records:backup:lastSavedAt";
const KEY_LAST_CHANGED_AT = "records:lastChangeAt";

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

/* 端末保存（全量バックアップ）：このドメインの localStorage を全部JSON保存 */
function saveAllLocalStorageToFile() {
  const data: Record<string, string | null> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)!;
    data[k] = window.localStorage.getItem(k);
  }
  const payload = {
    type: "workout-records-backup",
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  const ymd = todayStr.replaceAll("-", "");
  a.href = URL.createObjectURL(blob);
  a.download = `workout-records-backup-${ymd}.json`;
  a.click();
  URL.revokeObjectURL(a.href);

  try {
    window.localStorage.setItem(KEY_BACKUP_SAVED_AT, new Date().toISOString());
  } catch {}
}

/* 復元（JSONファイル→ localStorage に書き戻し） */
async function restoreAllFromFile(file: File) {
  const text = await file.text();
  const json = JSON.parse(text);
  if (!json || json.type !== "workout-records-backup" || !json.data) {
    alert("バックアップファイルの形式が不正です。");
    return;
  }
  const data: Record<string, string | null> = json.data;
  for (const [k, v] of Object.entries(data)) {
    if (v === null) {
      window.localStorage.removeItem(k);
    } else {
      window.localStorage.setItem(k, v);
    }
  }
  window.localStorage.setItem(KEY_BACKUP_SAVED_AT, new Date().toISOString());
  alert("復元が完了しました。ページを再読み込みします。");
  window.location.reload();
}

/* 直近のバックアップから1週間以上経過＆変更ありなら true */
function shouldRemindBackup(): boolean {
  const savedAt = window.localStorage.getItem(KEY_BACKUP_SAVED_AT);
  const changedAt = window.localStorage.getItem(KEY_LAST_CHANGED_AT);
  if (!changedAt) return false; // 変更なし
  if (!savedAt) return true;
  const weekMs = 7 * 24 * 3600 * 1000;
  return Date.now() - Date.parse(savedAt) > weekMs && Date.parse(changedAt) > Date.parse(savedAt);
}

/* 変更マーク（保存促しに使う） */
function markChangedNow() {
  try {
    window.localStorage.setItem(KEY_LAST_CHANGED_AT, new Date().toISOString());
  } catch {}
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

    const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
    const loaded = (loadDayRecord as any)(todayStr) as Partial<DayRecord> | null;
    if (loaded) {
      setDayRecord({
        date: todayStr,
        notesUpper: loaded.notesUpper ?? "",
        notesLower: loaded.notesLower ?? "",
        notesOther: loaded.notesOther ?? "",
        sets: loaded.sets ?? {},
        counts: loaded.counts ?? {},
        times: loaded.times ?? {}, // 後方互換
      });
    }
  }, []);

  const persist = (rec: DayRecord) => {
    setDayRecord(rec);
    (saveDayRecord as any)(todayStr, rec);
    markChangedNow();
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
          setLastPrev((pp) => {
            const nextPrev = { ...pp, [exerciseId]: cur[exerciseId] };
            const next = { ...cur, [exerciseId]: latest };
            writeLastAll(next, nextPrev);
            return nextPrev;
          });
          return { ...cur, [exerciseId]: latest };
        }
        return cur;
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

    const needLen = Math.max(setIndex + 1, arr.length);
    for (let i = 0; i < needLen; i++) if (arr[i] == null) arr[i] = false;

    arr[setIndex] = nowOn;
    sets[exerciseId] = arr;

    const times = { ...(dayRecord.times || {}) };
    const tArr = [...(times[exerciseId] ?? [])];
    tArr[setIndex] = nowOn ? new Date().toISOString() : null;
    times[exerciseId] = tArr;

    const next: DayRecord = { ...dayRecord, sets, times };
    persist(next);
    recomputeAndSyncLastDone(exerciseId, next);
  };

  /* 回数選択 */
  const changeCount = (exerciseId: string, setIndex: number, value: string) => {
    let n = Math.floor(Number(value || "0"));
    if (!Number.isFinite(n) || n < 0) n = 0;

    const counts = { ...(dayRecord.counts || {}) };
    const cArr = [...(counts[exerciseId] ?? [])];
    const needLen = Math.max(setIndex + 1, cArr.length);
    for (let i = 0; i < needLen; i++) if (cArr[i] == null) cArr[i] = 0;
    cArr[setIndex] = n;
    counts[exerciseId] = cArr;

    const times = { ...(dayRecord.times || {}) };
    const tArr = [...(times[exerciseId] ?? [])];
    tArr[setIndex] = n > 0 ? new Date().toISOString() : null;
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
  const hoursSince = (iso?: string): number | null => {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 3600000));
  };
  const recoveryText = (exerciseId: string) => {
    const h = hoursSince(lastDone[exerciseId]);
    if (h == null) return "—";
    if (h < 1) return "<1H";
    return `${h}H`;
  };

  /* 復元ファイル入力 */
  const fileRef = useRef<HTMLInputElement>(null);
  const onClickRestore = () => fileRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await restoreAllFromFile(f);
  };

  const [showRemind, setShowRemind] = useState(false);
  useEffect(() => {
    setShowRemind(shouldRemindBackup());
  }, []);

  if (!exercises) {
    return <div>種目データがありません。（設定タブで種目を追加してください）</div>;
  }

  /* 見出し行：タイトル左、日付＋ボタン群右 */
  const Header = () => (
    <div className="flex items-center gap-3 mb-4">
      <img src="/icons/icon-192x192.png" alt="icon" className="w-10 h-10 rounded-md" />
      <h1 className="text-lg font-bold">筋トレ記録</h1>
      <div className="ml-auto flex items-center gap-2 text-slate-600">
        <CalendarIcon />
        <span className="text-sm">{fmtDateJP(todayStr)}</span>
        <button
          className="ml-3 px-3 py-1 text-sm rounded bg-slate-900 text-white"
          onClick={saveAllLocalStorageToFile}
        >
          端末に保存（JSON）
        </button>
        <button
          className="px-3 py-1 text-sm rounded border border-slate-300"
          onClick={onClickRestore}
        >
          バックアップから復元
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={onFile}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <Header />

      {/* バックアップの促し（1週間以上保存なし＆変更あり） */}
      {showRemind && (
        <Card className="p-4 bg-amber-50 text-amber-900">
          <div className="text-sm leading-relaxed">
            最近、端末へのバックアップが1週間以上行われていません。変更内容を失わないよう、端末に保存をおすすめします。
          </div>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => {
                saveAllLocalStorageToFile();
                setShowRemind(false);
              }}
              className="px-4 py-2 rounded bg-slate-900 text-white"
            >
              端末に保存（JSON）
            </button>
            <button
              onClick={() => setShowRemind(false)}
              className="px-4 py-2 rounded border border-slate-300"
            >
              後で
            </button>
          </div>
        </Card>
      )}

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
            <h2 className="text-base font-bold mb-3">
              {cat === "upper" ? "上半身トレ" : cat === "lower" ? "下半身トレ" : "その他"}
            </h2>

            {categoryExercises.map((ex) => {
              const m = meta[ex.id];
              const mode = m?.mode ?? "check";
              const setCount = m?.setCount ?? ex.sets ?? 3;
              const repTarget = m?.repTarget;

              return (
                <div key={ex.id} className="border-b last:border-b-0 py-3">
                  {/* 1行目：種目名 + インターバル */}
                  <div className="flex items-center gap-3">
                    <div className="text-[15px] sm:text-base font-medium">{ex.name}</div>
                    <div className="ml-auto w-full sm:w-auto text-sm text-slate-500 text-right">
                      前回からのインターバル：{recoveryText(ex.id)}
                    </div>
                  </div>

                  {/* 2行目：右寄せ 3列グリッド */}
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
                                  placeholder={repTarget != null ? String(repTarget) : undefined}
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
                                onCheckedChange={(v) => toggleSet(ex.id, idx, !!v)}
                                className="w-[26px] h-[26px]"
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
