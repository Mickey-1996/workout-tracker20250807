"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";

import type { Category, DayRecord, ExerciseItem, InputMode } from "@/lib/types";
import { loadDayRecord, saveDayRecord, loadJSON } from "@/lib/local-storage";

/* ===== 未バックアップ促し & iPhone向けバックアップ（既存仕様を維持） ===== */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 48 * 60 * 60 * 1000;

function nowMs() { return Date.now(); }
function getMs(key: string) {
  const v = localStorage.getItem(key);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}
function setMs(key: string, ms: number) { localStorage.setItem(key, String(ms)); }
function markChanged() { setMs("wt-last-change-at", nowMs()); }
function markBackedUp() { setMs("wt-last-backup-at", nowMs()); }
function shouldNudgeToBackup(): boolean {
  const lastChange = getMs("wt-last-change-at");
  const lastBackup = getMs("wt-last-backup-at");
  const snoozeUntil = getMs("wt-nudge-snooze-until");
  const _now = nowMs();
  if (_now < snoozeUntil) return false;
  if (lastChange <= lastBackup) return false;
  if (_now - lastBackup < WEEK_MS) return false;
  return true;
}
function snoozeNudge(ms = SNOOZE_MS) { setMs("wt-nudge-snooze-until", nowMs() + ms); }

function downloadBackup(withTimestamp = true) {
  const dump: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    const raw = localStorage.getItem(k);
    try { dump[k] = raw ? JSON.parse(raw) : raw; } catch { dump[k] = raw; }
  }
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  const now = new Date();
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const filename = withTimestamp ? `workout-backup-${ts}.json` : "workout-backup.json";
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  try { markBackedUp(); } catch {}
}
/* ========================================================= */

type SettingsItem = ExerciseItem & {
  enabled?: boolean;
  order?: number;
  checkCount?: number;
  sets?: number;
  repTarget?: number;
  inputMode?: InputMode; // "check" | "count"
};
type Settings = { items: SettingsItem[] };

const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};

const sortByOrder = <T extends { order?: number; name?: string }>(a: T, b: T) =>
  (a.order ?? 0) - (b.order ?? 0) || (a.name ?? "").localeCompare(b.name ?? "");

/* 過去N日から「前回実施のISO時刻」を探す（チェック or 回数>0 の最新） */
function findLastDoneISO(id: string, base: Date, lookbackDays = 180): string | null {
  let latest: string | null = null;
  for (let i = 1; i <= lookbackDays; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    const rec = loadDayRecord(ymdLocal(d)) as Partial<DayRecord> | null;
    if (!rec) continue;
    const times = rec.times?.[id];
    const sets = rec.sets?.[id];
    const counts = rec.counts?.[id];

    if (times && times.length) {
      for (const t of times) {
        if (t) latest = !latest || t > latest ? t : latest;
      }
    } else {
      const anyCheck = sets?.some(Boolean);
      const anyCnt = counts?.some((n) => (n ?? 0) > 0);
      if (anyCheck || anyCnt) {
        const fallback = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0).toISOString();
        latest = !latest || fallback > latest ? fallback : latest;
      }
    }
  }
  return latest;
}

export default function RecordTab() {
  const today = useMemo(() => new Date(), []);
  const todayStr = ymdLocal(today);

  /* 設定ロード（有効 + 並び順） */
  const [items, setItems] = useState<SettingsItem[]>([]);

  const reloadSettings = () => {
    const s = loadJSON<Settings>("settings-v1");
    const enabled = s?.items?.filter((x) => x.enabled !== false) ?? [];
    setItems(enabled.sort(sortByOrder));
  };

  useEffect(() => {
    // 初回読み込み
    reloadSettings();

    // 設定変更の「即時反映」：storage / visibilitychange を購読
    const onStorage = (e: StorageEvent) => {
      if (e.key === "settings-v1") reloadSettings();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") reloadSettings();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* 今日の記録をロード */
  const [dayRecord, setDayRecord] = useState<DayRecord>(() => {
    const rec = loadDayRecord(todayStr) as DayRecord | null;
    return (
      rec ?? {
        date: todayStr,
        sets: {},
        counts: {},
        times: {},
        notesUpper: "",
        notesLower: "",
        notesOther: "",
      }
    );
  });

  const persist = (rec: DayRecord) => {
    setDayRecord(rec);
    saveDayRecord(todayStr, rec);
    markChanged();
  };

  const [showNudge, setShowNudge] = useState(false);
  useEffect(() => { setShowNudge(shouldNudgeToBackup()); }, [dayRecord]);

  const ensureLen = (arr: any[] | undefined, len: number, filler: any = null) => {
    const a = (arr ?? []).slice(0, len);
    while (a.length < len) a.push(filler);
    return a;
  };

  const lastIntervalHours = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      const lastISO = findLastDoneISO(it.id, today);
      if (!lastISO) continue;
      const ms = Date.now() - new Date(lastISO).getTime();
      map[it.id] = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
    }
    return map;
  }, [items, todayStr]);

  const groups = useMemo(() => {
    const order = (items ?? []).sort(sortByOrder);
    const pack = (cat: Category, title: string) => ({
      key: cat,
      title,
      list: order.filter((x) => x.category === cat),
      noteKey: cat === "upper" ? "notesUpper" : cat === "lower" ? "notesLower" : "notesOther",
    });
    return [pack("upper", "上半身"), pack("lower", "下半身"), pack("other", "その他")];
  }, [items]);

  const toggleCheck = (id: string, idx: number, on: boolean) => {
    const item = items.find((x) => x.id === id);
    const len = item ? (item.checkCount ?? item.sets ?? 3) : 3;
    const setsArr = ensureLen(dayRecord.sets?.[id], len, false) as boolean[];
    const timesArr = ensureLen(dayRecord.times?.[id], len, null) as (string | null)[];
    setsArr[idx] = on;
    timesArr[idx] = on ? new Date().toISOString() : null;
    persist({
      ...dayRecord,
      sets: { ...(dayRecord.sets ?? {}), [id]: setsArr },
      times: { ...(dayRecord.times ?? {}), [id]: timesArr },
    });
  };

  const changeCount = (id: string, idx: number, val: number) => {
    const item = items.find((x) => x.id === id);
    const len = item ? (item.checkCount ?? item.sets ?? 3) : 3;
    const cntArr = ensureLen(dayRecord.counts?.[id], len, 0) as number[];
    const timesArr = ensureLen(dayRecord.times?.[id], len, null) as (string | null)[];
    const before = cntArr[idx] ?? 0;
    cntArr[idx] = Math.max(0, Math.floor(val || 0));
    if ((before ?? 0) <= 0 && cntArr[idx] > 0) timesArr[idx] = new Date().toISOString();
    if ((before ?? 0) > 0 && cntArr[idx] <= 0) timesArr[idx] = null;

    persist({
      ...dayRecord,
      counts: { ...(dayRecord.counts ?? {}), [id]: cntArr },
      times: { ...(dayRecord.times ?? {}), [id]: timesArr },
    });
  };

  const [status, setStatus] = useState("");
  const handleManualSave = () => {
    persist(dayRecord);
    setStatus("保存しました");
    setTimeout(() => setStatus(""), 1500);
  };

  const updateNote = (noteKey: "notesUpper" | "notesLower" | "notesOther", v: string) => {
    persist({ ...dayRecord, [noteKey]: v });
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー＆保存 */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-semibold">記録</h2>
          <div className="text-sm text-slate-500">{todayStr}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{status}</span>
          <Button onClick={handleManualSave}>保存</Button>
          <Button
            onClick={() => {
              persist(dayRecord);    // まず確定保存
              downloadBackup(true);  // その後に全量バックアップ
            }}
          >
            端末に保存（JSON）
          </Button>
        </div>
      </div>

      {/* 促しバナー */}
      {showNudge && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-amber-800">
              最近、端末へのバックアップが1週間以上行われていません。変更内容を失わないよう、端末に保存をおすすめします。
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  persist(dayRecord);
                  downloadBackup(true);
                }}
              >
                端末に保存（JSON）
              </Button>
              <Button onClick={() => snoozeNudge()}>
                後で
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 各カテゴリ */}
      {groups.map((g) => {
        const noteKey = g.noteKey as "notesUpper" | "notesLower" | "notesOther";
        return (
          <Card key={g.key} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{g.title}</h3>
            </div>

            {/* 種目リスト */}
            <div className="space-y-3">
              {g.list.map((it) => {
                const setsLen = it.checkCount ?? it.sets ?? 3;
                const mode = it.inputMode ?? "check";
                const checks = (dayRecord.sets?.[it.id] ?? []) as boolean[];
                const counts = (dayRecord.counts?.[it.id] ?? []) as number[];
                const repTarget = it.repTarget;

                const hours = lastIntervalHours[it.id];
                const intervalText = typeof hours === "number"
                  ? `前回からのインターバル：${hours}H`
                  : "前回データなし";

                return (
                  <div key={it.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{it.name}</div>
                      <div className="text-[12px] text-slate-500">{intervalText}</div>
                    </div>

                    {/* 入力UI（UIは現状維持） */}
                    {mode === "check" ? (
                      <div className="mt-2 flex flex-wrap gap-2 justify-end">
                        {Array.from({ length: setsLen }).map((_, i) => (
                          <label key={i} className="inline-flex items-center justify-center w-10 h-10 border rounded-md">
                            <Checkbox
                              checked={!!checks[i]}
                              onCheckedChange={(v) => toggleCheck(it.id, i, Boolean(v))}
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2 justify-end">
                        {Array.from({ length: setsLen }).map((_, i) => (
                          <div key={i} className="flex items-center justify-center">
                            <select
                              className="w-14 h-10 rounded-md border px-1 text-sm text-right"
                              value={counts[i] ?? 0}
                              onChange={(e) => changeCount(it.id, i, Number(e.target.value))}
                            >
                              {Array.from({ length: 100 }, (_, n) => n).map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                        {typeof repTarget === "number" && (
                          <div className="w-full text-right text-[12px] text-slate-400">
                            ノルマ {repTarget} 回
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* メモ欄（カテゴリごと） */}
            <div className="pt-1">
              <textarea
                className="w-full min-h-[72px] rounded-md border px-3 py-2 text-sm"
                placeholder="（例）アーチャープッシュアップも10回やった"
                value={dayRecord[noteKey] ?? ""}
                onChange={(e) => updateNote(noteKey, e.target.value)}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

