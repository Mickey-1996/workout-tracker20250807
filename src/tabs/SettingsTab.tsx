"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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

import type { Category, ExerciseItem, InputMode } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/local-storage";
import { defaultExercises } from "@/lib/exercises-default";

const SETTINGS_KEY = "settings-v1";
// ✅ 仕様：固定ファイル名に変更（.jsonは付けない）
const SETTINGS_DOWNLOAD_FILENAME = "settings.latest";

/** types.ts は触らず UI 側だけで拡張 */
type ExtendedExerciseItem = ExerciseItem & {
  repTarget?: number;   // 回数入力モード時のノルマ回数
  checkCount?: number;  // セット数（旧: sets 互換あり）
  sets?: number;
  order?: number;
  enabled?: boolean;
};

type Settings = { items: ExtendedExerciseItem[] };

/* ===== ユーティリティ（順序正規化・比較） ===== */
const cmpOrderName = (a: ExtendedExerciseItem, b: ExtendedExerciseItem) =>
  (a.order ?? 0) - (b.order ?? 0) || (a.name ?? "").localeCompare(b.name ?? "");

type Cat3 = "upper" | "lower" | "other";
const toCat3 = (c: any): Cat3 =>
  c === "upper" || c === "lower" ? c : "other";

function normalizeOrders(list: ExtendedExerciseItem[]): ExtendedExerciseItem[] {
  const out = list.map((x) => ({ ...x, category: toCat3(x.category) }));
  (["upper", "lower", "other"] as Cat3[]).forEach((cat) => {
    const grp = out.filter((x) => toCat3(x.category) === cat).sort(cmpOrderName);
    grp.forEach((x, i) => {
      const idx = out.findIndex((y) => y.id === x.id);
      if (idx >= 0) out[idx] = { ...out[idx], order: i + 1, category: cat };
    });
  });
  return out;
}

function toItemSafe(raw: any, fallbackCat: Cat3 = "other"): ExtendedExerciseItem {
  const cat = toCat3(raw?.category ?? fallbackCat);
  const checkCount =
    typeof raw?.checkCount === "number"
      ? raw.checkCount
      : typeof raw?.sets === "number"
      ? raw.sets
      : 3;
  return {
    id: String(raw?.id ?? crypto.randomUUID()),
    name: String(raw?.name ?? ""),
    category: cat,
    enabled: raw?.enabled !== false,
    order: Number(raw?.order ?? 0),
    inputMode: (raw?.inputMode ?? raw?.mode ?? "check") as InputMode,
    checkCount,
    sets: typeof raw?.sets === "number" ? raw.sets : checkCount,
    repTarget: typeof raw?.repTarget === "number" ? raw.repTarget : undefined,
  };
}

/** RecordTab 互換の "exercises" 形式（upper/lower/other）を作る */
function groupForCompat(list: ExtendedExerciseItem[]) {
  const g: Record<Cat3, any[]> = { upper: [], lower: [], other: [] };
  for (const it of list) {
    const key = toCat3(it.category);
    g[key].push({
      id: it.id,
      name: it.name,
      category: key,
      enabled: it.enabled !== false,
      order: it.order ?? 0,
      inputMode: it.inputMode ?? "check",
      checkCount: it.checkCount ?? it.sets ?? 3,
      sets: it.sets,
      repTarget: it.repTarget,
    });
  }
  return g;
}

function newItem(cat: Cat3): ExtendedExerciseItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: cat,
    inputMode: "check",
    checkCount: 3,
    sets: 3,
    enabled: true,
    order: 0, // 後で normalize される
  };
}

export default function SettingsTab() {
  const [items, setItems] = useState<ExtendedExerciseItem[]>([]);
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // 既存データ → なければデフォルト種目
    const saved = loadJSON<Settings>(SETTINGS_KEY);
    const base =
      saved?.items?.length
        ? (saved.items as ExtendedExerciseItem[])
        : (defaultExercises as ExtendedExerciseItem[]);
    setItems(normalizeOrders(base));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const normalized = normalizeOrders(items);
    // v1 / v2 / 互換キーに保存
    saveJSON(SETTINGS_KEY, { items: normalized });
    saveJSON("wt:settings.v2", { items: normalized });
    saveJSON("exercises", groupForCompat(normalized));
  }, [items, ready]);

  const byCat = useMemo(() => {
    const g: Record<Cat3, ExtendedExerciseItem[]> = { upper: [], lower: [], other: [] };
    for (const it of items) {
      g[toCat3(it.category)].push({ ...it, category: toCat3(it.category) });
    }
    (Object.keys(g) as Cat3[]).forEach((k) => g[k].sort(cmpOrderName));
    return g;
  }, [items]);

  const update = (id: string, patch: Partial<ExtendedExerciseItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const add = (cat: Cat3) =>
    setItems((prev) => {
      const maxOrder =
        prev
          .filter((x) => toCat3(x.category) === cat)
          .reduce((m, x) => Math.max(m, x.order ?? 0), 0) || 0;
      const item = newItem(cat);
      item.order = maxOrder + 1;
      return [...prev, item];
    });

  const remove = (id: string) =>
    setItems((prev) => normalizeOrders(prev.filter((x) => x.id !== id)));

  /** ↑/↓：カテゴリ内で1つ移動し、連動して連番を振り直す */
  const move = (id: string, dir: -1 | 1) =>
    setItems((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const cat = toCat3(arr[idx].category);

      // 対象カテゴリの並び（現在の order で整列）
      const catList = arr
        .filter((x) => toCat3(x.category) === cat)
        .sort(cmpOrderName);
      const pos = catList.findIndex((x) => x.id === id);
      const nextPos = pos + dir;
      if (nextPos < 0 || nextPos >= catList.length) return prev;

      // 1つ移動
      const moved = catList.splice(pos, 1)[0];
      catList.splice(nextPos, 0, moved);

      // 連番を再付与
      catList.forEach((x, i) => {
        const k = arr.findIndex((y) => y.id === x.id);
        if (k >= 0) arr[k] = { ...arr[k], order: i + 1, category: cat };
      });

      return arr;
    });

  /* ---------- 保存/復元（ファイル） ---------- */
  const handleClickSave = () => {
    const normalized = normalizeOrders(items);
    const data: Settings = { items: normalized };

    // localStorage（互換キーにも保存）
    saveJSON(SETTINGS_KEY, data);
    saveJSON("wt:settings.v2", data);
    saveJSON("exercises", groupForCompat(normalized));

    // ✅ ダウンロード（固定名：settings.latest）
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = SETTINGS_DOWNLOAD_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    alert("設定を保存しました（Downloads に settings.latest を出力）。");
  };

  const handleClickRestore = () => fileRef.current?.click();

  const handleRestoreFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);

      let list: ExtendedExerciseItem[] = [];

      if (Array.isArray(json?.items)) {
        list = (json.items as any[]).map((x) => toItemSafe(x));
      } else if (json && typeof json === "object" && json["settings-v1"]?.items) {
        const arr = (json["settings-v1"]?.items ?? []) as any[];
        list = arr.map((x) => toItemSafe(x));
      } else if (json?.upper || json?.lower || json?.other || json?.etc) {
        const push = (arr: any[] | undefined, cat: Cat3) => {
          if (!Array.isArray(arr)) return;
          for (const raw of arr) list.push(toItemSafe(raw, cat));
        };
        push(json.upper, "upper");
        push(json.lower, "lower");
        push(json.other ?? json.etc, "other");
      } else {
        alert("復元できる形式ではありません。");
        e.target.value = "";
        return;
      }

      const normalized = normalizeOrders(list);

      // 保存（localStorage）
      saveJSON(SETTINGS_KEY, { items: normalized });
      saveJSON("wt:settings.v2", { items: normalized });
      saveJSON("exercises", groupForCompat(normalized));

      setItems(normalized);
      alert(`復元完了（${normalized.length} 件）`);
    } catch (err: any) {
      alert(`復元に失敗しました: ${err?.message ?? err}`);
    } finally {
      e.target.value = "";
    }
  };

  const Block = (cat: Cat3, title: string) => {
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

              {/* セット数（選択式 1〜5） */}
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
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* ノルマ回数（回数入力のときだけ選択式：1〜99、未設定あり） */}
              {(it.inputMode ?? "check") === "count" && (
                <div className="flex items-center gap-2 sm:col-span-1">
                  <span className="text-sm opacity-80">ノルマ回数</span>
                  <select
                    className="h-10 rounded-md border px-2 text-sm w-24"
                    value={it.repTarget ?? ""}
                    onChange={(e) =>
                      update(it.id, {
                        repTarget: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  >
                    <option value="">未設定</option>
                    {Array.from({ length: 99 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 順序表示 + 並び替え/削除 */}
              <div className="flex gap-2 sm:col-span-12 sm:justify-end">
                <span className="text-xs px-2 py-1 rounded border">
                  順序 {it.order ?? idxInCat + 1}
                </span>
                <Button variant="secondary" onClick={() => move(it.id, -1)}>
                  ↑
                </Button>
                <Button variant="secondary" onClick={() => move(it.id, 1)}>
                  ↓
                </Button>
                <Button variant="destructive" onClick={() => remove(it.id)}>
                  削除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      {/* 保存／復元（ページ上部・右寄せ） */}
      <div className="flex justify-end gap-2">
        <input
          ref={fileRef}
          type="file"
          // ✅ 拡張子なし（settings.latest）を拾えるよう accept を広げる
          accept=".latest,.json,application/json,*/*"
          className="hidden"
          onChange={handleRestoreFile}
        />
        <Button variant="secondary" onClick={handleClickRestore}>復元</Button>
        <Button onClick={handleClickSave}>保存</Button>
      </div>

      <h2 className="text-xl font-bold">設定</h2>
      <p className="text-sm opacity-80">
        ・「セット数」は選択式（1〜5）です。<br />
        ・回数入力を選ぶと「ノルマ回数」を選択式（1〜99）で設定できます。未設定も可。
      </p>

      {Block("upper", "上半身")}
      {Block("lower", "下半身")}
      {Block("other", "その他")}
    </div>
  );
}
