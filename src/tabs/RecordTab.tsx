// components/RecordTab.tsx

'use client';

import { useState, useEffect } from 'react';
import ExerciseSection from './ExerciseSection';
import Notes from './Notes';
import WeeklySummary from './WeeklySummary';

export default function RecordTab() {
  const [data, setData] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem('trainingData');
    if (saved) setData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('trainingData', JSON.stringify(data));
  }, [data]);

  return (
    <div className="space-y-8">
      <ExerciseSection title="上半身" category="upper" data={data} setData={setData} />
      <ExerciseSection title="下半身" category="lower" data={data} setData={setData} />
      <ExerciseSection title="その他" category="other" data={data} setData={setData} />

      <Notes category="upper" data={data} setData={setData} />
      <Notes category="lower" data={data} setData={setData} />
      <Notes category="other" data={data} setData={setData} />

      <WeeklySummary data={data} />
    </div>
  );
}
