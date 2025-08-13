/// src/app/layout.tsx
import "../styles/globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "筋トレ記録アプリ",
  description: "トレーニング内容の記録・集計・設定管理ができるアプリ",
  applicationName: "筋トレ記録アプリ",
  themeColor: "#0ea5e9",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      "/favicon.ico",
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "筋トレ記録アプリ",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${inter.className} antialiased`}>
        <header className="p-4 border-b shadow-sm bg-white flex items-center gap-4">
          {/* アイコンを2倍強(60px)に拡大 */}
          <Link href="/" className="shrink-0" aria-label="トップへ">
            <Image
              src="/android-chrome-192x192.png"
              alt="アプリアイコン"
              width={60}
              height={60}
              className="rounded-md"
              priority
            />
          </Link>

          <nav className="flex gap-4">
            <Link href="/" className="font-bold hover:underline">
              記録
            </Link>
            <Link href="/tabs/summary" className="font-bold hover:underline">
              集計
            </Link>
            <Link href="/tabs/settings" className="font-bold hover:underline">
              設定
            </Link>
          </nav>
        </header>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}

