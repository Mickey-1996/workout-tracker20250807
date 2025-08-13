// src/app/layout.tsx
import "../styles/globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "筋トレ記録アプリ",
  description: "トレーニング内容の記録・集計・設定管理ができるアプリ",
  icons: {
    // 通常のファビコン
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      "/favicon.ico",
    ],
    // iOS/Android ホーム追加用
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // ※ manifest を使うなら /public/site.webmanifest を用意し、以下のコメントを外してください
  // manifest: "/site.webmanifest",
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
