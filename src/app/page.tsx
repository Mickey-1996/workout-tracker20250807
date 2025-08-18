// src/app/page.tsx
"use client";

import RecordTab from "@/tabs/RecordTab";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">筋トレ記録アプリ</h1>
      </header>

      <RecordTab />
    </main>
  );
}
