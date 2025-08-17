"use client";

import React, { useEffect, useMemo, useState } from "react";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: CI環境に @types/react-dom が無くてもビルドできるようにするため
import { createPortal } from "react-dom";

import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";

type Record = {
  date: string;
  exercises: {
    name: string;
    sets: boolean[];
  }[];
  notes: {
    upperBody: string;
    lowerBody: string;
  };
};

export default function RecordTab() {
  const [records, setRecords] = useState<Record[]>([]);
  const [currentDate, setCurrentDate] = useState("");
  const [upperBodyNotes, setUpperBodyNotes] = useState("");
  const [lowerBodyNotes, setLowerBodyNotes] = useState("");
  const [shouldPromptSave, setShouldPromptSave] = useState(false);

  // 保存を促すメッセージが10日以上保存されていない場合に表示
  useEffect(() => {
    const savedRecords = localStorage.getItem("workout-records");
    if (savedRecords) {
      const parsed = JSON.parse(savedRecords) as Record[];
      setRecords(parsed);

      const lastRecord = parsed[parsed.length - 1];
      if (lastRecord) {
        const lastDate = new Date(lastRecord.date);
        const now = new Date();
        const diff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diff >= 10) {
          setShouldPromptSave(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!currentDate) {
      const today = new Date().toISOString().split("T")[0];
      setCurrentDate(today);
    }
  }, [currentDate]);

  const handleCheckboxChange = (exerciseIndex: number, setIndex: number) => {
    const updatedRecords = [...records];
    const todayRecord = updatedRecords.find((r) => r.date === currentDate);

    if (todayRecord) {
      todayRecord.exercises[exerciseIndex].sets[setIndex] =
        !todayRecord.exercises[exerciseIndex].sets[setIndex];
    } else {
      updatedRecords.push({
        date: currentDate,
        exercises: [
          {
            name: "フル懸垂",
            sets: [false, false, false, false, false],
          },
          {
            name: "ネガティブ懸垂",
            sets: [false, false, false],
          },
          {
            name: "ダンベルベントオーバーロウ",
            sets: [false, false, false, false, false],
          },
          {
            name: "ダンベルプルオーバー",
            sets: [false, false, false],
          },
          {
            name: "ダンベルフライ",
            sets: [false, false, false],
          },
          {
            name: "プッシュアップバー＆片足腕立て",
            sets: [false, false, false],
          },
        ],
        notes: {
          upperBody: "",
          lowerBody: "",
        },
      });
    }

    setRecords(updatedRecords);
    localStorage.setItem("workout-records", JSON.stringify(updatedRecords));
  };

  const handleSaveNotes = () => {
    const updatedRecords = [...records];
    const todayRecord = updatedRecords.find((r) => r.date === currentDate);

    if (todayRecord) {
      todayRecord.notes.upperBody = upperBodyNotes;
      todayRecord.notes.lowerBody = lowerBodyNotes;
    } else {
      updatedRecords.push({
        date: currentDate,
        exercises: [],
        notes: {
          upperBody: upperBodyNotes,
          lowerBody: lowerBodyNotes,
        },
      });
    }

    setRecords(updatedRecords);
    localStorage.setItem("workout-records", JSON.stringify(updatedRecords));
    setShouldPromptSave(false);
  };

  const todayRecord = useMemo(
    () => records.find((r) => r.date === currentDate),
    [records, currentDate]
  );

  return (
    <div className="space-y-4">
      {/* 保存リマインドをタブ上の行に表示 */}
      {shouldPromptSave &&
        createPortal(
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 text-center text-sm font-medium">
            10日以上記録していません。忘れずに保存しましょう！
          </div>,
          document.body
        )}

      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">記録 ({currentDate})</h2>

        {/* 種目チェック欄 */}
        <div className="space-y-2">
          {todayRecord?.exercises.map((exercise, exerciseIndex) => (
            <div key={exerciseIndex}>
              <p className="font-medium">{exercise.name}</p>
              <div className="flex space-x-2">
                {exercise.sets.map((done, setIndex) => (
                  <Checkbox
                    key={setIndex}
                    checked={done}
                    onCheckedChange={() =>
                      handleCheckboxChange(exerciseIndex, setIndex)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* メモ欄 */}
        <div className="mt-4 space-y-2">
          <p className="font-medium">上半身メモ</p>
          <Textarea
            value={upperBodyNotes}
            onChange={(e) => setUpperBodyNotes(e.target.value)}
            className="w-full"
          />
          <p className="font-medium">下半身メモ</p>
          <Textarea
            value={lowerBodyNotes}
            onChange={(e) => setLowerBodyNotes(e.target.value)}
            className="w-full"
          />
        </div>

        {/* 保存ボタン */}
        <div className="mt-4">
          <button
            onClick={handleSaveNotes}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </Card>
    </div>
  );
}
