"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";

type RecordData = {
  [key: string]: {
    [setIndex: number]: boolean;
  };
};

const exercises = ["懸垂", "ダンベルローイング", "腕立て伏せ", "ダンベルフライ"];
const setsPerExercise = 3;

export default function RecordTab() {
  const [records, setRecords] = useState<RecordData>({});
  const [upperBodyMemo, setUpperBodyMemo] = useState("");
  const [lowerBodyMemo, setLowerBodyMemo] = useState("");

  // ロード時に localStorage から復元
  useEffect(() => {
    const savedRecords = localStorage.getItem("records");
    const savedUpperMemo = localStorage.getItem("upperBodyMemo");
    const savedLowerMemo = localStorage.getItem("lowerBodyMemo");
    if (savedRecords) setRecords(JSON.parse(savedRecords));
    if (savedUpperMemo) setUpperBodyMemo(savedUpperMemo);
    if (savedLowerMemo) setLowerBodyMemo(savedLowerMemo);
  }, []);

  // 自動保存
  useEffect(() => {
    localStorage.setItem("records", JSON.stringify(records));
    localStorage.setItem("upperBodyMemo", upperBodyMemo);
    localStorage.setItem("lowerBodyMemo", lowerBodyMemo);
  }, [records, upperBodyMemo, lowerBodyMemo]);

  const toggleCheckbox = (exercise: string, setIndex: number) => {
    setRecords((prev) => ({
      ...prev,
      [exercise]: {
        ...prev[exercise],
        [setIndex]: !prev[exercise]?.[setIndex],
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">トレーニング記録</h2>
        <div className="grid gap-4">
          {exercises.map((exercise) => (
            <div key={exercise}>
              <div className="font-medium">{exercise}</div>
              <div className="flex space-x-2">
                {[...Array(setsPerExercise)].map((_, i) => (
                  <Checkbox
                    key={i}
                    checked={records[exercise]?.[i] || false}
                    onCheckedChange={() => toggleCheckbox(exercise, i)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">メモ</h2>
        <div className="grid gap-4">
          <div>
            <div className="font-medium">上半身</div>
            <Textarea
              placeholder="上半身のトレーニングメモ"
              value={upperBodyMemo}
              onChange={(e) => setUpperBodyMemo(e.target.value)}
            />
          </div>
          <div>
            <div className="font-medium">下半身</div>
            <Textarea
              placeholder="下半身のトレーニングメモ"
              value={lowerBodyMemo}
              onChange={(e) => setLowerBodyMemo(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
