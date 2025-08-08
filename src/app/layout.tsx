import "../app/globals.css"; // 相対パスに変更
import { Inter } from "next/font/google";
import Link from "next/link";
import { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "筋トレ記録アプリ",
  description: "トレーニング内容の記録・集計・設定管理ができるアプリ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <header className="p-4 border-b shadow-sm bg-white flex gap-4">
          <Link href="/" className="font-bold hover:underline">
            記録
          </Link>
          <Link href="/tabs/summary" className="font-bold hover:underline">
            集計
          </Link>
          <Link href="/tabs/settings" className="font-bold hover:underline">
            設定
          </Link>
        </header>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
