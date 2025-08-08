"use client";

import { useEffect, useState } from "react";

interface Record {
  date: string;
  upperBodyMemo: string;
  lowerBodyMemo: string;
}

export default function SummaryTab() {
  const [records, setRecords] = useState<Record[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("training-record");
    if (stored) {
      setRecords(JSON.parse(stored));
    }
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">記録の集計</h2>
      {records.length === 0 ? (
        <p>記録がまだありません。</p>
      ) : (
        <ul className="space-y-2">
          {records.map((record, index) => (
            <li key={index} className="p-4 border rounded">
              <p className="font-semibold">{record.date}</p>
              <p className="text-sm text-gray-700">上半身メモ: {record.upperBodyMemo}</p>
              <p className="text-sm text-gray-700">下半身メモ: {record.lowerBodyMemo}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
