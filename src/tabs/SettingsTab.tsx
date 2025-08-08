"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/Button";

export default function SettingsTab() {
  const [cleared, setCleared] = useState(false);

  const handleReset = () => {
    localStorage.removeItem("training-record");
    setCleared(true);
  };

  useEffect(() => {
    if (cleared) {
      const timeout = setTimeout(() => setCleared(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [cleared]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">設定</h2>
      <p>保存されたトレーニング記録データをリセットします。</p>
      <Button onClick={handleReset}>記録をリセット</Button>
      {cleared && <p className="text-green-600">記録をリセットしました。</p>}
    </div>
  );
}
