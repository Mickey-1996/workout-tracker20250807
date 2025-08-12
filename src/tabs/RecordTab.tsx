// src/tabs/RecordTab.tsx
"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";

import {
  loadDayRecord,
  loadExercises,
  saveDayRecord,
} from "@/lib/local-storage";

import type { DayRecord, ExercisesState } from "@/lib/types";

const today = new Date().toISOString().split("T")[0];

export default function RecordTab() {
  const [exercises, setExercises] = useState<ExercisesState | null>(null);
  const [dayRecord, setDayRecord] = useState<DayRecord>({
    date: today,
    notesUpper: "",
    notesLower: "",
    sets: {},
  });

  useEffect(() => {
    const loadedExercises = loadExercises();
    if (loadedExercises) {
      setExercises(loadedExercises);
    }
    const loadedRecord = loadDayRecord(today);
    if (loadedRecord) {
      setDayRecord(loadedRecord);
    }
  }, []);

  const toggleSet = (exerciseId: string, setIndex: number) => {
    const updatedSets = { ...dayRecord.sets };
    if (!updatedSets[exerciseId]) {
      updatedSets[exerciseId] = [];
    }
    updatedSets[exerciseId][setIndex] = !updatedSets[exerciseId][setIndex];
    const updatedRecord = { ...dayRecord, sets: updatedSets };
    setDayRecord(updatedRecord);
    saveDayRecord(today, updatedRecord);
  };

  const handleNotesChange = (field: "notesUpper" | "notesLower", value: string) => {
    const updatedRecord = { ...dayRecord, [field]: value };
    setDayRecord(updatedRecord);
    saveDayRecord(today, updatedRecord);
  };

  if (!exercises) {
    return <div>種目データがありません。（設定タブで種目を追加してください）</div>;
  }

  return (
    <div className="space-y-4">
      {Object.entries(exercises).map(([category, categoryExercises]) => (
        <Card key={category} className="p-4">
          <h2 className="text-lg font-bold mb-2">{category}</h2>
          {categoryExercises.map((exercise) => (
            <div key={exercise.id} className="mb-3">
              <div className="font-medium">{exercise.name}</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {Array.from({ length: exercise.sets }).map((_, idx) => (
                  <Checkbox
                    key={idx}
                    checked={dayRecord.sets[exercise.id]?.[idx] || false}
                    onCheckedChange={() => toggleSet(exercise.id, idx)}
                  />
                ))}
              </div>
            </div>
          ))}
        </Card>
      ))}

      <Card className="p-4">
        <h2 className="text-lg font-bold mb-2">上半身メモ</h2>
        <Textarea
          value={dayRecord.notesUpper}
          onChange={(e) => handleNotesChange("notesUpper", e.target.value)}
          placeholder="上半身トレーニングに関するメモ"
        />
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-bold mb-2">下半身メモ</h2>
        <Textarea
          value={dayRecord.notesLower}
          onChange={(e) => handleNotesChange("notesLower", e.target.value)}
          placeholder="下半身トレーニングに関するメモ"
        />
      </Card>
    </div>
  );
}
