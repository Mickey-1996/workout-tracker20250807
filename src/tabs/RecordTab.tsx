"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "./ui/Checkbox";
import { Textarea } from "./ui/Textarea";

type Record = {
  date: string;
  upperBodyDone: boolean[];
  lowerBodyDone: boolean[];
  upperBodyNote: string;
  lowerBodyNote: string;
};

const upperExercises = [
  "懸垂（フル）",
  "懸垂（ネガティブ）",
  "ダンベルローイング",
  "ダンベルプルオーバー",
  "ダンベルフライ",
  "腕立て伏せ（片足など）",
];

const lowerExercises = ["バックランジ", "ワイドスクワット"];

const today = new Date().toISOString().split("T")[0];

export default function RecordTab() {
  const [record, setRecord] = useState<Record>(() => {
    const saved = localStorage.getItem("training-record");
    return (
      (saved && JSON.parse(saved)) || {
        date: today,
        upperBodyDone: Array(upperExercises.length).fill(false),
        lowerBodyDone: Array(lowerExercises.length).fill(false),
        upperBodyNote: "",
        lowerBodyNote: "",
      }
    );
  });

  useEffect(() => {
    localStorage.setItem("training-record", JSON.stringify(record));
  }, [record]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">日付: {record.date}</h2>
      </div>

      <section>
        <h3 className="text-lg font-semibold mb-2">上半身トレーニング</h3>
        <ul className="space-y-1">
          {upperExercises.map((label, idx) => (
            <li key={idx} className="flex items-center space-x-2">
              <Checkbox
                checked={record.upperBodyDone[idx]}
                onCheckedChange={(checked) =>
                  setRecord((prev) => {
                    const updated = [...prev.upperBodyDone];
                    updated[idx] = Boolean(checked);
                    return { ...prev, upperBodyDone: updated };
                  })
                }
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <Textarea
          className="mt-2"
          placeholder="部位ごとのメモ（例：懸垂の回数、ダンベルの重量など）"
          value={record.upperBodyNote}
          onChange={(e) =>
            setRecord((prev) => ({ ...prev, upperBodyNote: e.target.value }))
          }
        />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-2">下半身トレーニング</h3>
        <ul className="space-y-1">
          {lowerExercises.map((label, idx) => (
            <li key={idx} className="flex items-center space-x-2">
              <Checkbox
                checked={record.lowerBodyDone[idx]}
                onCheckedChange={(checked) =>
                  setRecord((prev) => {
                    const updated = [...prev.lowerBodyDone];
                    updated[idx] = Boolean(checked);
                    return { ...prev, lowerBodyDone: updated };
                  })
                }
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <Textarea
          className="mt-2"
          placeholder="部位ごとのメモ（例：ランジの回数、負荷など）"
          value={record.lowerBodyNote}
          onChange={(e) =>
            setRecord((prev) => ({ ...prev, lowerBodyNote: e.target.value }))
          }
        />
      </section>
    </div>
  );
}

