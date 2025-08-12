// src/tabs/SettingsTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

/** types.ts を触らず UI 側だけで拡張して使う */
type ExtendedExerciseItem = ExerciseItem & {
  /** 回数入力モード時のノルマ回数（任意） */
  repTarget?: number;
  /** 既存データ互換: セット数（チェック数） */
  checkCount?: number;
  /** 既存データ互換: セット数（旧フィールド） */
  sets?: number;
  /** UI用: 並び順/有効 */
  order?: number;
  enabled?: boolean;
};

type Settings = { items: ExtendedExerciseItem[] };

function newItem(cat: Category): ExtendedExerciseItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: cat,
    inputMode: "check",
    checkCount: 3, // UIでは「セット数」として扱う
    sets: 3,       // 旧フィールド互換
    enabled: true,
    order: 0,
  };
}

export default function SettingsTab() {
  const [items, setItems] = useState<ExtendedExerciseItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadJSON<Settings>(SETTINGS_KEY);
    if (saved?.items?.length) {
      setItems(saved.items);
    } else {
      // defaultExercises が ExerciseItem[] の場合も Extended に流用可
      setItems(defaultExercises as ExtendedExerciseItem[]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJSON(SETTINGS_KEY, { items });
  }, [items, ready]);

  const byCat = useMemo(() => {
    const sortByOrder = (a: ExtendedExerciseItem, b: ExtendedExerciseItem) =>
      (a.order ?? 0) - (b.order ?? 0);
    return {
      upper: items.filter((x) => x.category === "upper").sort(sortByOrder),
      lower: items.filter((x) => x.category === "lower").sort(sortByOrder),
      other: items.filter((x) => x.category === "other").sort(sortByOrder),
    };
  }, [items]);

  const update = (id: string, patch: Partial<ExtendedExerciseItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const add = (cat: Category) =>
    setItems((prev) => {
      const maxOrder =
        prev.filter((x) => x.category === cat).reduce((m, x) => Math.max(m, x.order ?? 0), 0) || 0;
      const item = newItem(cat);
      item.order = maxOrder + 1;
      return [...prev, item];
    });

  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  const move = (id: string, dir: -1 | 1) =>
    setItems((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const cat = arr[idx].category;

      const sameCatIdx = arr
        .map((x, i) => ({ x, i }))
        .filter(({ x }) => x.category === cat)
        .map(({ i }) => i);

      const posInCat = sameCatIdx.indexOf(idx);
      const nextPos = posInCat + dir;
      if (nextPos < 0 || nextPos >= sameCatIdx.length) return prev;

      const j = sameCatIdx[nextPos];
      const a = arr[idx];
      const b = arr[j];
      const tmp = a.order ?? 0;
      a.order = b.order ?? 0;
      b.order = tmp;
      return arr.slice();
    });

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

          {list.map((it) => (
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

              {/* セット数（選択式・countでも常に編集可） */}
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="text-sm opacity-80">セット数</span>
                <select
                  className="h-10 rounded-md border px-2 text-sm"
                  value={it.checkCount ?? it.sets ?? 3}
                  onChange={(e) =>
                    update(it.id, { checkCount: Number(e.target.value), sets: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* ノルマ回数（count のときだけ表示） */}
              { (it.inputMode ?? "check") === "count" && (
                <div className="flex items-center gap-2 sm:col-span-1">
                  <span className="text-sm opacity-80">ノルマ回数</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={500}
                    step={1}
                    className="w-24"
                    value={it.repTarget ?? ""}
                    onChange={(e) =>
                      update(it.id, {
                        repTarget:
                          e.target.value === ""
                            ? undefined
                            : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                    placeholder="例: 10"
                  />
                </div>
              )}

              {/* 並び替え/削除 */}
              <div className="flex gap-2 sm:col-span-1 sm:justify-end">
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
      <h2 className="text-xl font-bold">設定</h2>
      <p className="text-sm opacity-80">
        ・「セット数」はチェック方式と回数入力方式の両方で使われます（選択式 1〜10）。<br />
        ・回数入力を選ぶと「ノルマ回数」を設定でき、記録画面で薄表示/プレースホルダに反映されます。
      </p>

      {Block("upper", "上半身")}
      {Block("lower", "下半身")}
      {Block("other", "その他")}
    </div>
  );
}
