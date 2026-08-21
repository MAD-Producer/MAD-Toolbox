import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://madproducer.cn"),
  title: "MAD Toolbox — 为 MADer 而生的多媒体工具箱",
  description:
    "哔哩哔哩、YouTube、全网音乐一站下载；转码、重封装、GIF、抽帧一站处理。多线程统一任务调度，为 MAD 视频创作者打造的跨平台桌面工具。",
  keywords: [
    "MAD Toolbox",
    "MAD",
    "AMV",
    "bilibili 下载",
    "BBDown",
    "yt-dlp",
    "FFmpeg",
    "音乐下载",
    "视频转码",
  ],
  openGraph: {
    title: "MAD Toolbox — 为 MADer 而生的多媒体工具箱",
    description:
      "There are many toolboxes, but this one is for you, MADer. 下载、转码、任务调度，一站搞定。",
    type: "website",
    locale: "zh_CN",
    siteName: "MAD Toolbox",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="bg-ink-950 font-sans text-mist-100">{children}</body>
    </html>
  );
}
