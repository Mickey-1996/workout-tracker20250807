// src/app/page.tsx
"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RecordTab from "@/tabs/RecordTab";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">筋トレ記録アプリ</h1>
        <p className="text-sm text-muted-foreground">
          日々のトレーニングをサクッと記録。ローカル保存（localStorage）で手軽に管理できます。
        </p>
      </header>

      <Tabs defaultValue="record" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="record">記録</TabsTrigger>
          <TabsTrigger value="history">履歴</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="mt-4">
          <RecordTab />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="text-sm text-muted-foreground">
            履歴ビューは今後追加予定です。まずは「記録」タブでデータを貯めてください。
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>設定ビューは今後追加予定です。</p>
            <ul className="list-disc pl-5">
              <li>種目の追加・編集</li>
              <li>バックアップ／リストア（JSONエクスポート）</li>
              <li>テーマ設定（ダーク／ライト）</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

