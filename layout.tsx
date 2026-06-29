import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "업무 자동화 4단계 워크시트",
  description: "AI를 활용한 업무 자동화 시스템 프롬프트를 4단계로 완성하세요",
  metadataBase: new URL("https://your-domain.vercel.app"),
  openGraph: {
    title: "업무 자동화 4단계 워크시트",
    description: "4단계로 완성하는 나만의 AI 업무 자동화 프롬프트",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-50">{children}</body>
    </html>
  );
}
