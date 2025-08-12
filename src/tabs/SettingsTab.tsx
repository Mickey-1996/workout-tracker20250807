"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { loadExercises, saveExercises } from "@/lib/local-storage";
import { DEFAULT_EXERCISES } from "@/lib/exercises-default";
import type { ExercisesState, Exercise, Category, InputMode } from "@/lib/types";

const categories: { value: Category; label: string }[] = [
  { value: "upper", label: "上半身" },
  { value: "lower", label: "下半身" },
  { value: "other", label: "その他" },
];

const modes: { value: InputMode; label: string }[] = [
  { value: "checkbox", label: "チェックボックス" },
  { value: "reps", label: "回数入力" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function SettingsTab() {
  const [ex, setEx] = useState<ExercisesState | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loaded = loadExercises();
    setEx(loaded ?? DEFAULT_EXERCISES);
  }, []);

  const byCat = useMemo(() => {
    const items = ex?.items ?? [];
    return {
      upper: items.filter((i) => i.category === "upper"),
      lower: items.filter((i) => i.category === "lower"),
      other: items.filter((i) => i.category === "other"),
    };
  }, [ex]);

  if (!ex) return <p className="p-4">読み込み中…</p>;

  const updateItem = (id: string, patch: Partial<Exercise>) => {
    setEx((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
          }
        : prev
    );
  };

  const addItem = (cat: Category) => {
    const item: Exercise = {
      id: uid(),
      name: "新しい種目",
      category: cat,
      inputMode: "checkbox",
      checkboxCount: 3,
      active: true,
    };
    setEx((prev) => (prev ? { ...prev, items: [...prev.items, item] } : prev));
  };

  const removeItem = (id: string) => {
    setEx((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== id) } : prev));
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    setEx((prev) => {
      if (!prev) return prev;
      const idx = prev.items.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const to = idx + dir;
      if (to < 0 || to >= prev.items.length) return prev;
      const arr = [...prev.items];
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return { ...prev, items: arr };
    });
  };

  const onSave = () => {
    if (!ex) return;
    saveExercises(ex);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const block = (cat: Category, title: string) => {
    const list = byCat[cat];
    return (
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <Button onClick={() => addItem(cat)}>＋ 追加</Button>
        </div>
        <div className="space-y-3">
          {list.map((it) => (
            <div key={it.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <Input
                className="sm:col-span-5"
                value={it.name}
                onChange={(e) => updateItem(it.id, { name: e.target.value })}
                placeholder="種目名"
              />
              <Select
                className="sm:col-span-3"
                value={it.inputMode}
                onValueChange={(v) => updateItem(it.id, { inputMode: v as InputMode })}
              >
                {modes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>

              <Input
                className="sm:col-span-2"
                type="number"
                min={1}
                max={10}
                value={it.checkboxCount}
                onChange={(e) =>
                  updateItem(it.id, { checkboxCount: Math.max(1, Math.min(10, Number(e.target.value || 1))) })
                }
                disabled={it.inputMode !== "checkbox"}
                placeholder="個数(1-10)"
                title="チェックボックスの個数"
              />

              <div className="sm:col-span-2 flex gap-1 justify-end">
                <Button variant="secondary" onClick={() => moveItem(it.id, -1)}>
                  ▲
                </Button>
                <Button variant="secondary" onClick={() => moveItem(it.id, +1)}>
                  ▼
                </Button>
                <Button variant="destructive" onClick={() => removeItem(it.id)}>
                  削除
                </Button>
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted-foreground">まだ種目がありません。</p>}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">設定</h2>
      {block("upper", "上半身")}
      {block("lower", "下半身")}
      {block("other", "その他")}
      <div className="flex items-center gap-3">
        <Button onClick={onSave}>保存</Button>
        {saved && <span className="text-green-600 text-sm">保存しました。</span>}
        <Button
          variant="secondary"
          onClick={() => {
            localStorage.removeItem("exercises:v1");
            setEx(DEFAULT_EXERCISES);
          }}
        >
          初期化（種目）
        </Button>
      </div>
    </div>
  );
}
