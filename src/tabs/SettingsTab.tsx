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

// ---- 設定保存キー ----
const SETTINGS_KEY = "settings-v1";

// ---- 設定型：必要な最小だけ ----
type Settings = {
  items: ExerciseItem[];
};

/** 空の1件を作る */
function newItem(cat: Category): ExerciseItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: cat,
    sets: 3, // 初期3セット
    inputMode: "check",
    checkCount: 3,
    enabled: true,
    order: 0,
  };
}

export default function SettingsTab() {
  const [items, setItems] = useState<ExerciseItem[]>([]); // 一覧
  const [ready, setReady] = useState(false);

  // 初期ロード
  useEffect(() => {
    const saved = loadJSON<Settings>(SETTINGS_KEY);
    if (saved?.items?.length) {
      setItems(saved.items);
    } else {
      // デフォルトを初期登録
      setItems(defaultExercises);
    }
    setReady(true);
  }, []);

  // 永続化
  useEffect(() => {
    if (!ready) return;
    saveJSON(SETTINGS_KEY, { items } as Settings);
  }, [items, ready]);

  // カテゴリ別
  const byCat = useMemo(() => {
    const u = items.filter((x) => x.category === "upper").sort((a, b) => a.order - b.order);
    const l = items.filter((x) => x.category === "lower").sort((a, b) => a.order - b.order);
    const o = items.filter((x) => x.category === "other").sort((a, b) => a.order - b.order);
    return { upper: u, lower: l, other: o };
  }, [items]);

  // 1件更新
  const update = (id: string, patch: Partial<ExerciseItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  // 追加
  const add = (cat: Category) =>
    setItems((prev) => {
      const maxOrder =
        prev.filter((x) => x.category === cat).reduce((m, x) => Math.max(m, x.order), 0) || 0;
      const item = newItem(cat);
      item.order = maxOrder + 1;
      return [...prev, item];
    });

  // 削除
  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  // 並び替え（↑/↓）
  const move = (id: string, dir: -1 | 1) =>
    setItems((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      // 同カテゴリ内だけで移動
      const cat = arr[idx].category;
      const sameCatIdx = arr
        .map((x, i) => ({ x, i }))
        .filter(({ x }) => x.category === cat)
        .map(({ i }) => i);

      const posInCat = sameCatIdx.indexOf(idx);
      const nextPos = posInCat + dir;
      if (nextPos < 0 || nextPos >= sameCatIdx.length) return prev;

      const j = sameCatIdx[nextPos];
      // order を交換
      const a = arr[idx];
      const b = arr[j];
      const tmp = a.order;
      a.order = b.order;
      b.order = tmp;
      return arr.slice();
    });

  // ブロック描画
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
              {/* 有効/無効 */}
              <label className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  checked={it.enabled}
                  onCheckedChange={(v) => update(it.id, { enabled: Boolean(v) })}
                />
                <span className="text-sm">記録対象</span>
              </label>

              {/* 名前 */}
              <div className="sm:col-span-4">
                <Input
                  placeholder="種目名（例：フル懸垂 5回×3セット）"
                  value={it.name}
                  onChange={(e) => update(it.id, { name: e.target.value })}
                />
              </div>

              {/* 入力方式 */}
              <Select
                containerClassName="sm:col-span-3"
                value={it.inputMode}
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

              {/* チェックボックス数（1〜10） */}
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="text-sm opacity-80">チェック数</span>
                <select
                  className="h-10 rounded-md border px-2 text-sm"
                  value={it.checkCount ?? 3}
                  onChange={(e) => update(it.id, { checkCount: Number(e.target.value) })}
                  disabled={it.inputMode !== "check"}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

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
        ・チェックあり＝1セット、初期は3セットです。<br />
        ・入力方式が「チェック」のときは、チェックボックスの個数（1〜10）を設定できます。
      </p>

      {Block("upper", "上半身")}
      {Block("lower", "下半身")}
      {Block("other", "その他")}
    </div>
  );
}
