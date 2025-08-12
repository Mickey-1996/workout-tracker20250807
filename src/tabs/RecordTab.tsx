"use client";

import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { loadDayRecord, loadExercises, saveDayRecord } from "@/lib/local-storage";
import type { DayRecord, ExercisesState } from "@/lib/types";

const today = new Date().toISOString().split("T")[0];

export default function RecordTab() {
  const [ex, setEx] = useState<ExercisesState | null>(null);
  const [rec, setRec] = useState<DayRecord | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const e = loadExercises();
    setEx(e);
    const r = loadDayRecord(today);
    setRec(
      r ?? {
        date: today,
        byExercise: {},
        notes: { upper: "", lower: "", other: "" },
      }
    );
  }, []);

  const grouped = useMemo(() => {
    const items = ex?.items.filter((i) => i.active) ?? [];
    return {
      upper: items.filter((i) => i.category === "upper"),
      lower: items.filter((i) => i.category === "lower"),
      other: items.filter((i) => i.category === "other"),
    };
  }, [ex]);

  if (!ex || !rec) return <p className="p-4">読み込み中…</p>;

  const renderExercise = (id: string) => {
    const it = ex.items.find((x) => x.id === id);
    if (!it) return null;
    const entry = rec.byExercise[id] ?? {};

    if (it.inputMode === "checkbox") {
      const checks =
        entry.checks && entry.checks.length === it.checkboxCount
          ? entry.checks
          : Array(it.checkboxCount).fill(false);

      return (
        <div className="flex gap-2 flex-wrap">
          {checks.map((c, i) => (
            <Checkbox
              key={i}
              checked={c}
              onCheckedChange={(val) => {
                const next = [...checks];
                next[i] = Boolean(val);
                setRec((prev) =>
                  prev
                    ? { ...prev, byExercise: { ...prev.byExercise, [id]: { checks: next } } }
                    : prev
                );
              }}
            />
          ))}
        </div>
      );
    }

    // reps（入力あり＝1セット扱い）
    return (
      <Input
        type="number"
        min={0}
        placeholder="回数"
        value={entry.reps ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          setRec((prev) =>
            prev ? { ...prev, byExercise: { ...prev.byExercise, [id]: { reps: v } } } : prev
          );
        }}
        className="w-28"
      />
    );
  };

  const section = (key: "upper" | "lower" | "other", title: string) => {
    const list = grouped[key];
    return (
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">{title}</h3>
        <div className="space-y-2">
          {list.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3">
              <div className="flex-1">{it.name}</div>
              {renderExercise(it.id)}
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted-foreground">種目がありません。</p>}
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">備考</p>
          <Textarea
            value={rec.notes[key]}
            onChange={(e) => setRec((prev) => (prev ? { ...prev, notes: { ...prev.notes, [key]: e.target.value } } : prev))}
            placeholder="（例）メモを入力"
          />
        </div>
      </Card>
    );
  };

  const onSave = () => {
    if (!rec) return;
    saveDayRecord(rec);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">日付: {rec.date}</h2>
      </div>

      {section("upper", "上半身")}
      {section("lower", "下半身")}
      {section("other", "その他")}

      {/* Sticky アクションバー */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur p-3 border-t flex items-center gap-3">
        <Button onClick={onSave} className="w-full">保存</Button>
        {saved && <span className="text-green-600 text-sm">保存しました。</span>}
      </div>
    </div>
  );
}

