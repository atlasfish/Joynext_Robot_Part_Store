import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JOYNEXT 机器人元器件选型中心",
  description: "面向全球机器人客户的 JOYNEXT 元器件选型、询价与订单服务原型。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: `${basePath}/assets/brand/joynext-mark.svg`,
    shortcut: `${basePath}/assets/brand/joynext-mark.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
