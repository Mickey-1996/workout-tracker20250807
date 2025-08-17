"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";

import type { Category, ExerciseItem, InputMode } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/local-storage";
import { defaultExercises } from "@/lib/exercises-default";

const SETTINGS_KEY = "settings-v1";

/** UIで使う拡張（保存形式は既存と互換） */
type ExtendedExerciseItem = ExerciseItem & {
  enabled?: boolean;
  order?: number;
  checkCount?: number; // (= sets 互換)
  sets?: number;
  inputMode?: InputMode; // "check" | "count"
  repTarget?: number;    // 回数入力モード時のノルマ回数（1..99）
};
type Settings = { items: ExtendedExerciseItem[] };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 48 * 60 * 60 * 1000;

/* ====== 変更検知・バックアップ促し ====== */
function nowMs() { return Date.now(); }
function getMs(key: string) {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(key);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}
function setMs(key: string, ms: number) {
  if (typeof window !== "undefined") localStorage.setItem(key, String(ms));
}
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

/* ====== 全量バックアップ（設定＋記録 すべて） ====== */
function downloadBackup(withTimestamp = true) {
  if (typeof window === "undefined") return;
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

export default function SettingsTab() {
  const [items, setItems] = useState<ExtendedExerciseItem[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");

  // 起動時：既存設定ロード（settings-v1）→ なければデフォルト
  useEffect(() => {
    const saved = loadJSON<Settings>(SETTINGS_KEY);
    const base = saved?.items?.length
      ? (saved.items as ExtendedExerciseItem[])
      : (defaultExercises as ExtendedExerciseItem[]);
    setItems(normalizeOrders(base));
    setReady(true);
  }, []);

  // 変更をlocalStorageへ保存
  useEffect(() => {
    if (!ready) return;
    saveJSON(SETTINGS_KEY, { items });
    markChanged();
  }, [items, ready]);

  const [showNudge, setShowNudge] = useState(false);
  useEffect(() => { setShowNudge(shouldNudgeToBackup()); }, [items]);

  const byCat = useMemo(() => ({
    upper: items.filter((x) => x.category === "upper").sort(cmpOrderName),
    lower: items.filter((x) => x.category === "lower").sort(cmpOrderName),
    other: items.filter((x) => x.category === "other").sort(cmpOrderName),
  }), [items]);

  const update = (id: string, patch: Partial<ExtendedExerciseItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const add = (cat: Category) =>
    setItems((prev) => {
      const maxOrder = prev.filter((x) => x.category === cat)
        .reduce((m, x) => Math.max(m, x.order ?? 0), 0) || 0;
      const item = newItem(cat);
      item.order = maxOrder + 1;
      return [...prev, item];
    });

  const remove = (id: string) =>
    setItems((prev) => normalizeOrders(prev.filter((x) => x.id !== id)));

  const move = (id: string, dir: -1 | 1) =>
    setItems((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const cat = arr[idx].category;
      const catList = arr.filter((x) => x.category === cat).sort(cmpOrderName);
      const pos = catList.findIndex((x) => x.id === id);
      const nextPos = pos + dir;
      if (nextPos < 0 || nextPos >= catList.length) return prev;
      const moved = catList.splice(pos, 1)[0];
      catList.splice(nextPos, 0, moved);
      catList.forEach((x, i) => {
        const k = arr.findIndex((y) => y.id === x.id);
        if (k >= 0) arr[k] = { ...arr[k], order: i + 1 };
      });
      return arr;
    });

  const manualSave = () => {
    const normalized = normalizeOrders(items);
    saveJSON(SETTINGS_KEY, { items: normalized });
    markChanged();
    setStatus("保存しました");
    setTimeout(() => setStatus(""), 1500);
  };

  /* ===== 全量バックアップの復元（ファイル→localStorage 全上書き） ===== */
  const fileRef = useRef<HTMLInputElement | null>(null);
  const importAll = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      if (!window.confirm("バックアップから復元します。現在のデータは上書きされます。よろしいですか？")) return;
      window.localStorage.clear();
      for (const [k, v] of Object.entries(data)) {
        const val = typeof v === "string" ? v : JSON.stringify(v);
        window.localStorage.setItem(k, val);
      }
      markBackedUp();
      alert("復元が完了しました。画面を再読み込みします。");
      window.location.reload();
    } catch (e) {
      alert("バックアップの復元に失敗しました。");
      console.error(e);
    }
  };

  const Block = (cat: Category, title: string) => {
    const list = byCat[cat];
    return (
      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <Button onClick={() => add(cat)}>＋ 追加</Button>
        </div>

        <div className="space-y-3">
          {list.length === 0 && <p className="text-sm opacity-70">（種目なし）</p>}

          {list.map((it, idxInCat) => (
            <div
              key={it.id}
              className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center rounded-md border p-3"
            >
              {/* 記録対象 */}
              <label className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  checked={it.enabled !== false}
                  onCheckedChange={(v) => update(it.id, { enabled: Boolean(v) })}
                />
                <span className="text-sm">記録対象</span>
              </label>

              {/* 種目名 */}
              <div className="sm:col-span-4">
                <Input
                  placeholder="種目名（例：フル懸垂 5回×3セット）"
                  value={it.name}
                  onChange={(e) => update(it.id, { name: e.target.value })}
                />
              </div>

              {/* 入力方式 */}
              <div className="sm:col-span-3">
                <Select
                  value={it.inputMode ?? "check"}
                  onValueChange={(v) => update(it.id, { inputMode: v as InputMode })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="入力方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">チェック（セットごと）</SelectItem>
                    <SelectItem value="count">回数入力</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* セット数（1〜5） */}
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="text-sm opacity-80">セット数</span>
                <select
                  className="h-10 rounded-md border px-2 text-sm"
                  value={it.checkCount ?? it.sets ?? 3}
                  onChange={(e) =>
                    update(it.id, { checkCount: Number(e.target.value), sets: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* ノルマ回数（回数入力のみ） */}
              {(it.inputMode ?? "check") === "count" && (
                <div className="flex items-center gap-2 sm:col-span-1">
                  <span className="text-sm opacity-80">ノルマ回数</span>
                  <select
                    className="h-10 rounded-md border px-2 text-sm w-24"
                    value={it.repTarget ?? ""}
                    onChange={(e) => update(it.id, {
                      repTarget: e.target.value === "" ? undefined : Number(e.target.value),
                    })}
                  >
                    <option value="">未設定</option>
                    {Array.from({ length: 99 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 順序（同カテゴリ内） */}
              <div className="flex gap-2 sm:col-span-12 sm:justify-end">
                <span className="text-xs px-2 py-1 rounded border">順序 {it.order ?? idxInCat + 1}</span>
                <Button onClick={() => move(it.id, -1)}>↑</Button>
                <Button onClick={() => move(it.id, 1)}>↓</Button>
                <Button onClick={() => remove(it.id)}>削除</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">設定</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{status}</span>
          <Button onClick={manualSave}>保存</Button>
          <Button
            onClick={() => {
              const normalized = normalizeOrders(items);
              saveJSON(SETTINGS_KEY, { items: normalized });
              markChanged();
              downloadBackup(true); // 全量バックアップ（JSON）
            }}
          >
            端末に保存（JSON）
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importAll(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>
            バックアップから復元
          </Button>
        </div>
      </div>

      {/* バックアップ促しバナー（1週間未保存かつ変更あり） */}
      {showNudge && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-amber-800">
              最近、端末へのバックアップが1週間以上行われていません。変更内容を失わないよう、端末に保存をおすすめします。
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const normalized = normalizeOrders(items);
                  saveJSON(SETTINGS_KEY, { items: normalized });
                  markChanged();
                  downloadBackup(true);
                }}
              >
                端末に保存（JSON）
              </Button>
              <Button onClick={() => { snoozeNudge(); }}>
                後で
              </Button>
            </div>
          </div>
        </Card>
      )}

      {Block("upper", "上半身")}
      {Block("lower", "下半身")}
      {Block("other", "その他")}

      {/* （任意）下部にも全量バックアップUIを残す */}
      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">バックアップ（エクスポート / インポート）</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const normalized = normalizeOrders(items);
              saveJSON(SETTINGS_KEY, { items: normalized });
              markChanged();
              downloadBackup(true);
            }}
          >
            端末に保存（JSON）
          </Button>

          <Button onClick={() => fileRef.current?.click()}>
            バックアップから復元
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          ※ iPhone/Safariの仕様上、ユーザー操作なしの自動ファイル保存はできません。
          必要に応じて「端末に保存（JSON）」でバックアップを取得し、「バックアップから復元」で戻してください。
        </p>
      </section>
    </div>
  );
}

/* ===== ヘルパー ===== */
const cmpOrderName = (a: ExtendedExerciseItem, b: ExtendedExerciseItem) =>
  (a.order ?? 0) - (b.order ?? 0) || (a.name ?? "").localeCompare(b.name ?? "");

function normalizeOrders(list: ExtendedExerciseItem[]): ExtendedExerciseItem[] {
  const out = list.map((x) => ({ ...x }));
  (["upper", "lower", "other"] as Category[]).forEach((cat) => {
    const grp = out.filter((x) => x.category === cat).sort(cmpOrderName);
    grp.forEach((x, i) => {
      const idx = out.findIndex((y) => y.id === x.id);
      if (idx >= 0) out[idx] = { ...out[idx], order: i + 1 };
    });
  });
  return out;
}
function newItem(cat: Category): ExtendedExerciseItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: cat,
    inputMode: "check",
    enabled: true,
    checkCount: 3,
    sets: 3,
    order: 0,
  };
}
