// src/app/page.tsx

'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import RecordTab from '../components/RecordTab';
import SettingsTab from '../components/SettingsTab';

export default function HomePage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">筋トレ記録アプリ</h1>
      <Tabs defaultValue="record">
        <TabsList>
          <TabsTrigger value="record">記録</TabsTrigger>
          <TabsTrigger value="settings">設定</TabsTrigger>
        </TabsList>

        <TabsContent value="record">
          <RecordTab />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}
