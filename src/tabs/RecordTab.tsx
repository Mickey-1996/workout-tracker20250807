"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveAs } from "file-saver";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  type?: "checkbox" | "number";
}

interface RecordData {
  date: string;
  exercises: { [key: string]: (boolean | number)[] };
}

const upperBodyExercises: Exercise[] = [
  { name: "フル懸垂 できる限り", sets: 5, reps: "", type: "checkbox" },
  { name: "ネガティブ懸垂", sets: 3, reps: "5", type: "number" },
  { name: "フル懸垂", sets: 3, reps: "5", type: "checkbox" },
];

const lowerBodyExercises: Exercise[] = [
  { name: "バックランジ", sets: 3, reps: "20", type: "number" },
  { name: "ワイドスクワット", sets: 3, reps: "15", type: "checkbox" },
];

export default function RecordTab() {
  const [records, setRecords] = useState<RecordData[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // データ読み込み
  useEffect(() => {
    const saved = localStorage.getItem("workoutRecords");
    if (saved) {
      setRecords(JSON.parse(saved));
    }
  }, []);

  // 保存
  const handleSave = () => {
    const now = new Date();
    const newRecord: RecordData = {
      date: now.toISOString().split("T")[0],
      exercises: {},
    };
    localStorage.setItem("workoutRecords", JSON.stringify([...records, newRecord]));
    setLastSaved(now);

    const blob = new Blob([JSON.stringify([...records, newRecord], null, 2)], {
      type: "application/json",
    });
    saveAs(blob, `workoutrecord.${now.toISOString().replace(/[-:.]/g, "").slice(0, 12)}`);
  };

  // インターバル計算
  const getInterval = (exerciseName: string) => {
    const lastDates = records
      .filter((r) => r.exercises[exerciseName])
      .map((r) => new Date(r.date).getTime());

    if (lastDates.length === 0) return "—";
    const diffDays = Math.floor(
      (Date.now() - Math.max(...lastDates)) / (1000 * 60 * 60 * 24)
    );
    return `${diffDays}日`;
  };

  // 共通スタイル（チェックボックス＆数値入力）
  const inputBoxClass =
    "w-12 h-12 text-lg text-center border rounded flex items-center justify-center";

  return (
    <div className="space-y-4 p-4">
      {/* バナー */}
      {lastSaved &&
        (Date.now() - lastSaved.getTime()) / (1000 * 60 * 60 * 24) >= 10 && (
          <div className="bg-yellow-100 text-yellow-800 p-2 rounded">
            10日間保存されていません
          </div>
        )}

      {/* 上半身 */}
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-bold">上半身</h2>
          {upperBodyExercises.map((exercise) => (
            <div key={exercise.name} className="space-y-2">
              <div className="font-medium">{exercise.name}</div>
              <div>前回からのインターバル：{getInterval(exercise.name)}</div>
              <div className="flex justify-end gap-2 flex-wrap">
                {Array.from({ length: exercise.sets }).map((_, i) =>
                  exercise.type === "checkbox" ? (
                    <input
                      key={i}
                      type="checkbox"
                      className={inputBoxClass}
                    />
                  ) : (
                    <input
                      key={i}
                      type="number"
                      defaultValue={exercise.reps}
                      className={inputBoxClass}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 下半身 */}
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-bold">下半身</h2>
          {lowerBodyExercises.map((exercise) => (
            <div key={exercise.name} className="space-y-2">
              <div className="font-medium">{exercise.name}</div>
              <div>前回からのインターバル：{getInterval(exercise.name)}</div>
              <div className="flex justify-end gap-2 flex-wrap">
                {Array.from({ length: exercise.sets }).map((_, i) =>
                  exercise.type === "checkbox" ? (
                    <input
                      key={i}
                      type="checkbox"
                      className={inputBoxClass}
                    />
                  ) : (
                    <input
                      key={i}
                      type="number"
                      defaultValue={exercise.reps}
                      className={inputBoxClass}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 保存ボタン */}
      <Button onClick={handleSave} className="w-full">
        保存
      </Button>
    </div>
  );
}

