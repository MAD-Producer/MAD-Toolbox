"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  TasksIcon,
  BilibiliIcon,
  GlobeDownloadIcon,
  MovieIcon,
  MusicIcon,
  PlayIcon,
  CheckIcon,
} from "@/components/ui/Icons";

type SceneKey = "bilibili" | "youtube" | "music" | "media";
type Phase = "typing" | "shown";

type Scene = {
  key: SceneKey;
  navIndex: number;
  input: string;
};

const NAV_ITEMS = [
  { label: "任务中心", icon: TasksIcon },
  { label: "哔哩哔哩下载", icon: BilibiliIcon },
  { label: "网络视频下载", icon: GlobeDownloadIcon },
  { label: "媒体处理", icon: MovieIcon },
  { label: "音乐下载", icon: MusicIcon },
];

const SCENES: Scene[] = [
  { key: "bilibili", navIndex: 1, input: "https://www.bilibili.com/video/BV1xx411c7mD" },
  { key: "youtube", navIndex: 2, input: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
  { key: "music", navIndex: 4, input: "搜索：夜に駆ける — YOASOBI" },
  { key: "media", navIndex: 3, input: "source_pr.mp4 — PR 智能兼容转码" },
];

function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "primary" | "green" }) {
  const tones = {
    default: "border-white/10 bg-white/5 text-mist-300",
    primary: "border-primary/30 bg-primary/10 text-primary-soft",
    green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  };
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Progress({ duration = 4.2, delay = 0.4 }: { duration?: number; delay?: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
      <motion.div
        className="progress-shimmer h-full rounded-full bg-gradient-to-r from-primary to-accent-cyan"
        initial={{ width: "3%" }}
        animate={{ width: "100%" }}
        transition={{ duration, delay, ease: "easeInOut" }}
      />
    </div>
  );
}

function RunningStatus({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
      <span className="animate-pulse-dot size-1.5 rounded-full bg-emerald-400" />
      {text}
    </div>
  );
}

function BilibiliScene() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="relative flex h-[60px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-accent-violet/45 via-primary/45 to-accent-pink/30">
          <PlayIcon className="size-4 text-white/90" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">【4K MAD】用一首歌讲完整个故事</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Chip tone="primary">选集 P1-P3</Chip>
            <Chip>8K 超高清</Chip>
            <Chip>HEVC</Chip>
          </div>
          <p className="mt-1.5 text-[11px] text-mist-500">完整视频 · 弹幕 · 字幕 · 封面</p>
        </div>
      </div>
      <Progress />
      <div className="flex items-center justify-between">
        <RunningStatus text="运行中" />
        <span className="text-[11px] tabular-nums text-mist-500">12.4 MB/s · 下载资源池</span>
      </div>
    </div>
  );
}

function YoutubeScene() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="relative flex h-[60px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-red-500/35 via-ink-700 to-ink-700">
          <PlayIcon className="size-4 text-white/90" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">Big Buck Bunny — 4K 60FPS</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Chip tone="primary">2160p · VP9</Chip>
            <Chip>合并最佳音轨</Chip>
            <Chip>内嵌字幕</Chip>
          </div>
          <p className="mt-1.5 text-[11px] text-mist-500">浏览器 Cookie 已自动注入</p>
        </div>
      </div>
      <Progress />
      <div className="flex items-center justify-between">
        <RunningStatus text="运行中" />
        <span className="text-[11px] tabular-nums text-mist-500">8.1 MB/s · 下载资源池</span>
      </div>
    </div>
  );
}

function MusicScene() {
  const rows = [
    { title: "夜に駆ける", artist: "YOASOBI", quality: "FLAC 无损", source: "咪咕音乐", active: true },
    { title: "怪物", artist: "YOASOBI", quality: "320K", source: "QQ音乐" },
    { title: "群青", artist: "YOASOBI", quality: "FLAC 无损", source: "网易云音乐" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.title}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
            row.active ? "border-primary/35 bg-primary/8" : "border-white/8 bg-white/[0.03]"
          }`}
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet/50 to-primary/50 text-white/90">
            <MusicIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{row.title}</p>
            <p className="text-[11px] text-mist-500">{row.artist} · {row.source}</p>
          </div>
          {row.active ? (
            <div className="w-24 space-y-1">
              <Progress duration={3.6} delay={0.3} />
              <p className="text-right text-[10px] text-emerald-300">下载中</p>
            </div>
          ) : (
            <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] ${row.quality.includes("FLAC") ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-white/10 bg-white/5 text-mist-400"}`}>
              {row.quality}
            </span>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-1 pt-0.5">
        {["咪咕", "网易云", "QQ 音乐", "酷我", "Apple Music", "Spotify", "+40"].map((p) => (
          <Chip key={p}>{p}</Chip>
        ))}
      </div>
    </div>
  );
}

function MediaScene() {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 text-[11px]">
        {["PR 智能兼容", "转码", "重新封装", "GIF", "帧导出"].map((t, i) => (
          <span
            key={t}
            className={`rounded-lg border px-2 py-1 ${
              i === 0 ? "border-primary/40 bg-primary/12 text-primary-soft" : "border-white/8 bg-white/[0.03] text-mist-500"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
        <MovieIcon className="size-8 shrink-0 text-mist-400" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[11px] text-mist-300">source_pr.mp4</span>
            <span className="text-mist-500">→</span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] text-primary-soft">h264 · yuv420p · faststart</span>
          </div>
          <Progress duration={4} delay={0.3} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <RunningStatus text="分析完成 · 转码中" />
        <span className="flex items-center gap-1 text-[11px] text-mist-500">
          <CheckIcon className="size-3 text-emerald-400" /> 直投 Premiere 不再报错
        </span>
      </div>
    </div>
  );
}

function SceneCard({ sceneKey }: { sceneKey: SceneKey }) {
  switch (sceneKey) {
    case "bilibili":
      return <BilibiliScene />;
    case "youtube":
      return <YoutubeScene />;
    case "music":
      return <MusicScene />;
    case "media":
      return <MediaScene />;
  }
}

/** Hero 的应用窗口模拟：输入框循环打字，四个场景轮播 */
export function AppWindow() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");

  const scene = SCENES[sceneIdx];

  useEffect(() => {
    if (phase === "typing") {
      if (typed.length < scene.input.length) {
        const t = setTimeout(() => setTyped(scene.input.slice(0, typed.length + 1)), 42 + Math.random() * 42);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("shown"), 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setPhase("typing");
      setTyped("");
      setSceneIdx((i) => (i + 1) % SCENES.length);
    }, 4600);
    return () => clearTimeout(t);
  }, [typed, phase, sceneIdx, scene.input]);

  // 鼠标视差：轻微 3D 倾斜
  const rotateX = useMotionValue(9);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 55, damping: 16 });
  const springRotateY = useSpring(rotateY, { stiffness: 55, damping: 16 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(nx * 7);
    rotateX.set(9 - ny * 5);
  }

  return (
    <div
      className="relative mx-auto w-full max-w-3xl [perspective:1400px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        rotateX.set(9);
        rotateY.set(0);
      }}
    >
      {/* 窗口背后的品牌光晕 */}
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,rgba(10,132,255,0.22),rgba(129,119,255,0.12),transparent)] blur-2xl" aria-hidden />

      <motion.div
        style={{ rotateX: springRotateX, rotateY: springRotateY, transformPerspective: 1400 }}
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/90 shadow-2xl shadow-black/60 backdrop-blur-xl"
      >
        {/* 窗口标题栏 */}
        <div className="flex items-center gap-3 border-b border-white/6 bg-ink-850/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <p className="flex-1 text-center text-[12px] font-medium text-mist-400">MAD Toolbox</p>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-mist-500">v0.10.1</span>
        </div>

        {/* 一级导航 */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/6 px-3 py-2">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const active = i === scene.navIndex;
            return (
              <span
                key={item.label}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] transition-colors duration-500 ${
                  active ? "bg-white/10 text-mist-100" : "text-mist-500"
                }`}
              >
                <Icon className={`size-3.5 ${active ? "text-primary-soft" : ""}`} />
                {item.label}
              </span>
            );
          })}
        </div>

        {/* 内容区：输入框 + 场景卡片 */}
        <div className="space-y-3.5 p-4 sm:p-5">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-ink-950/70 px-3.5 py-2.5">
            <GlobeDownloadIcon className="size-4 shrink-0 text-mist-500" />
            <span className="truncate font-mono text-[12px] text-mist-300">
              {typed}
              <span className="animate-caret ml-0.5 inline-block h-3.5 w-[2px] translate-y-[3px] bg-primary-soft" />
            </span>
            <span className={`ml-auto shrink-0 rounded-md border px-2 py-1 text-[10.5px] transition-opacity duration-500 ${phase === "shown" ? "border-primary/40 bg-primary/15 text-primary-soft opacity-100" : "border-white/10 bg-white/5 text-mist-500 opacity-60"}`}>
              {phase === "shown" ? "已识别" : "解析中…"}
            </span>
          </div>

          <div className="min-h-[168px] sm:min-h-[150px]">
            <AnimatePresence mode="wait">
              {phase === "shown" && (
                <motion.div
                  key={scene.key}
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5"
                >
                  <SceneCard sceneKey={scene.key} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* 漂浮徽标 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.7 }}
        className="animate-float absolute -right-4 -top-5 z-10 hidden items-center gap-2 rounded-xl border border-white/10 bg-ink-850/90 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur md:flex"
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400/15">
          <CheckIcon className="size-3 text-emerald-300" />
        </span>
        <span className="text-[11.5px] text-mist-300">已添加到任务队列</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.35, duration: 0.7 }}
        className="animate-float-delay absolute -bottom-5 -left-4 z-10 hidden rounded-xl border border-white/10 bg-ink-850/90 px-3.5 py-2 shadow-xl shadow-black/40 backdrop-blur lg:block"
      >
        <div className="flex items-center gap-3 text-[11.5px] text-mist-300">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            下载池 ×2
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent-violet" />
            处理池 ×1
          </span>
        </div>
      </motion.div>
    </div>
  );
}
