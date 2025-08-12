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

type Settings = { items: ExerciseItem[] };

function newItem(cat: Category): ExerciseItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: cat,
    sets: 3,
    inputMode: "check",
    checkCount: 3, // UI上は「セット数」
    enabled: true,
    order: 0,
  };
}

export default function SettingsTab() {
  const [items, setItems] = useState<ExerciseItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadJSON<Settings>(SETTINGS_KEY);
    if (saved?.items?.length) {
      setItems(saved.items);
    } else {
      setItems(defaultExercises);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJSON(SETTINGS_KEY, { items });
  }, [items, ready]);

  const byCat = useMemo(() => {
    const sortByOrder = (a: ExerciseItem, b: ExerciseItem) => a.order - b.order;
    return {
      upper: items.filter((x) => x.category === "upper").sort(sortByOrder),
      lower: items.filter((x) => x.category === "lower").sort(sortByOrder),
      other: items.filter((x) => x.category === "other").sort(sortByOrder),
    };
  }, [items]);

  const update = (id: string, patch: Partial<ExerciseItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const add = (cat: Category) =>
    setItems((prev) => {
      const maxOrder =
        prev.filter((x) => x.category === cat).reduce((m, x) => Math.max(m, x.order), 0) || 0;
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
      const tmp = a.order;
      a.order = b.order;
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
              <label className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  checked={it.enabled}
                  onCheckedChange={(v) => update(it.id, { enabled: Boolean(v) })}
                />
                <span className="text-sm">記録対象</span>
              </label>

              <div className="sm:col-span-4">
                <Input
                  placeholder="種目名（例：フル懸垂 5回×3セット）"
                  value={it.name}
                  onChange={(e) => update(it.id, { name: e.target.value })}
                />
              </div>

              <div className="sm:col-span-3">
                <Select
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
              </div>

              {/* セット数：数値で直接入力できるように変更（count時も常に編集可） */}
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="text-sm opacity-80">セット数</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  step={1}
                  className="w-24"
                  value={it.checkCount ?? 3}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const n = Number.isFinite(raw) ? Math.floor(raw) : 1;
                    const clamped = Math.min(20, Math.max(1, n));
                    update(it.id, { checkCount: clamped });
                  }}
                />
              </div>

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
        ・「セット数」はチェック方式のチェック個数、回数入力方式の“セット数”の両方に使われます（1〜20）。<br />
        ・回数入力を選ぶと、記録画面ではセット数ぶんの回数入力欄が表示されます。
      </p>

      {Block("upper", "上半身")}
      {Block("lower", "下半身")}
      {Block("other", "その他")}
    </div>
  );
}
