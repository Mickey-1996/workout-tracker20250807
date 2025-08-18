// src/tabs/RecordTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

// ====== ダミー型（既存プロジェクトで同名型/関数がある場合はそのまま使われます） ======
type SetBox = { value?: string };
type Exercise = {
  id: string;
  title: string;
  subtitle?: string;
  lastIntervalHours?: number | "—";
  sets: SetBox[];
};
const formatDate = (d = new Date()) =>
  `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月${String(
    d.getDate()
  ).padStart(2, "0")}日`;

// ====== ここからコンポーネント ======
export default function RecordTab() {
  // 画面ヘッダ用
  const [today, setToday] = useState(formatDate());
  useEffect(() => setToday(formatDate()), []);

  // 表示データ（※既存実装がある場合はそちらに差し替えてOK）
  const exercises: Exercise[] = useMemo(
    () => [
      {
        id: "full-as-possible",
        title: "フル懸垂 できる限り",
        subtitle: "前回からのインターバル：—",
        sets: [{}, {}, {}, {}, {}],
      },
      {
        id: "full-5x3",
        title: "フル懸垂　5回×3セット",
        subtitle: "前回からのインターバル：0時間",
        sets: [{}, {}, {}],
      },
      {
        id: "neg-5x3",
        title: "ネガティブ懸垂　5回×3セット",
        subtitle: "前回からのインターバル：0時間",
        sets: [{}, {}, {}],
      },
      {
        id: "row-15x3",
        title: "ダンベルベントロウ　15回×3セット",
        subtitle: "前回からのインターバル：—",
        sets: [{}, {}, {}],
      },
      {
        id: "pullover-10x3",
        title: "ダンベルプルオーバー　10回×3セット",
        subtitle: "前回からのインターバル：—",
        sets: [{}, {}, {}],
      },
      {
        id: "fly-15x3",
        title: "ダンベルフライ　15回×3セット",
        subtitle: "前回からのインターバル：—",
        sets: [{}, {}, {}],
      },
    ],
    []
  );

  // 保存（既存実装がある場合は差し替え）
  const handleSave = () => {
    // 既存の保存ロジックがあるならそのまま呼び出してください
    alert("保存しました（ダミー）");
  };

  return (
    // ▼▼▼ 外枠：集計タブと同一の幅設定に合わせています ▼▼▼
    //  - mx-auto w-full max-w-[860px] … 横幅の上限を統一
    //  - px-4 md:px-6 … 左右パディングを統一
    <div className="mx-auto w-full max-w-[860px] px-4 md:px-6">
      {/* 画面ヘッダ */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex items-center justify-between py-3">
          <div className="text-[22px] font-semibold tracking-wide">{today}</div>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium shadow-sm active:scale-[0.98]"
          >
            保存
          </button>
        </div>
      </div>

      {/* 種目カード */}
      <div className="space-y-4 pb-24">
        {exercises.map((ex) => (
          <section
            key={ex.id}
            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <header className="mb-2">
              <h2 className="text-[18px] font-semibold">{ex.title}</h2>
              {ex.subtitle && (
                <p className="mt-1 text-[13px] text-neutral-500">{ex.subtitle}</p>
              )}
            </header>

            {/* ▼▼▼ 入力ボックス行：右寄せを強制（重要） ▼▼▼
                 - ml-auto … 要素自身を右側に寄せる助け（親がblockでもOK）
                 - flex justify-end … 子要素を右寄せ
                 - gap-2 … ボックス間の余白
            */}
            <div className="ml-auto flex justify-end gap-2">
              {ex.sets.map((_, i) => (
                <SetInput key={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// □ 入力ボックス（見た目のみ。既存のコンポーネントがある場合は置き換えてください）
function SetInput() {
  return (
    <div className="grid h-16 w-16 place-items-center rounded-2xl border border-neutral-300">
      {/* 既存と同じ「▼」アイコン風の見た目（画像の雰囲気に合わせています） */}
      <span className="text-xl leading-none select-none">▾</span>
    </div>
  );
}
