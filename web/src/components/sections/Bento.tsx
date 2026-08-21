"use client";

import { motion } from "framer-motion";
import { Reveal } from "@/components/ui/Reveal";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import {
  TasksIcon,
  BilibiliIcon,
  GlobeDownloadIcon,
  MusicIcon,
  MovieIcon,
  CheckIcon,
} from "@/components/ui/Icons";
import type { ReactNode, ComponentType } from "react";

function CardShell({
  icon: Icon,
  iconClass,
  title,
  desc,
  children,
  className = "",
}: {
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  desc: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <SpotlightCard
      className={`group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-ink-900/70 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-white/15 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-xl border ${iconClass}`}>
          <Icon className="size-5" />
        </span>
        <h3 className="text-[16px] font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="mt-3 text-[13.5px] leading-6 text-mist-400">{desc}</p>
      {children && <div className="mt-auto pt-5">{children}</div>}
    </SpotlightCard>
  );
}

function MiniQueue() {
  const rows = [
    { name: "【MAD】素材批量下载", status: "运行中", width: "72%", tone: "text-emerald-300", dot: "bg-emerald-400" },
    { name: "BGM · FLAC 无损导出", status: "已完成", width: "100%", tone: "text-mist-500", dot: "bg-mist-500" },
    { name: "PR 兼容转码 ×3", status: "排队中", width: "0%", tone: "text-amber-300", dot: "bg-amber-400" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <motion.div
          key={row.name}
          initial={{ opacity: 0, x: -18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 + i * 0.18, duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-ink-850/80 px-3.5 py-2.5"
        >
          <span className={`size-1.5 shrink-0 rounded-full ${row.dot}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[12.5px] text-mist-300">{row.name}</p>
              <span className={`shrink-0 text-[11px] ${row.tone}`}>{row.status}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/6">
              <motion.div
                initial={{ width: "2%" }}
                whileInView={{ width: row.width }}
                viewport={{ once: true }}
                transition={{ delay: 0.45 + i * 0.18, duration: 1.4, ease: "easeOut" }}
                className={`h-full rounded-full ${row.width === "100%" ? "bg-emerald-400/70" : "bg-gradient-to-r from-primary to-accent-cyan"}`}
              />
            </div>
          </div>
        </motion.div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10.5px] text-primary-soft">下载资源池 ×2</span>
        <span className="rounded-md border border-accent-violet/25 bg-accent-violet/10 px-2 py-0.5 text-[10.5px] text-accent-violet">处理资源池 ×1</span>
      </div>
    </div>
  );
}

function ChipCloud({ chips, tone }: { chips: string[]; tone: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span key={chip} className={`rounded-md border px-2 py-1 text-[11px] ${tone}`}>
          {chip}
        </span>
      ))}
    </div>
  );
}

export function Bento() {
  return (
    <section id="features" className="relative scroll-mt-24 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-primary-soft">五大模块 · 一个工作台</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            从素材获取到成片产出，
            <span className="text-gradient-brand">全流程都在一个窗口里</span>
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-mist-400">
            把 BBDown、yt-dlp、FFmpeg 和全网音乐搜索装进一套清爽的图形界面——工具已经会的事，壳不做多余的事。
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4" delay={0.05}>
            <CardShell
              icon={TasksIcon}
              iconClass="border-primary/25 bg-primary/10 text-primary-soft"
              title="统一任务调度"
              desc="下载与处理任务进入同一条队列：双资源池并发控制、状态机管理、实时进度与日志。提交之后，剩下的交给调度。"
              className="h-full"
            >
              <MiniQueue />
            </CardShell>
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.12}>
            <CardShell
              icon={BilibiliIcon}
              iconClass="border-accent-cyan/25 bg-accent-cyan/10 text-accent-cyan"
              title="哔哩哔哩下载"
              desc="完整视频 / 仅音频 / 弹幕 / 字幕 / 封面自由组合，选集语法批量下载。"
              className="h-full"
            >
              <ChipCloud
                chips={["8K 超高清", "HEVC / AV1", "选集 1,3-5", "扫码登录", "TV / APP 线路"]}
                tone="border-white/8 bg-white/[0.04] text-mist-300"
              />
            </CardShell>
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.05}>
            <CardShell
              icon={GlobeDownloadIcon}
              iconClass="border-red-400/25 bg-red-400/10 text-red-300"
              title="网络视频下载"
              desc="基于 yt-dlp，YouTube 与数千个站点通吃。Cookie 自动兜底、代理支持。"
              className="h-full"
            >
              <ChipCloud
                chips={["查看格式", "元数据分析", "播放列表选集", "内嵌元数据", "内嵌封面"]}
                tone="border-white/8 bg-white/[0.04] text-mist-300"
              />
            </CardShell>
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.12}>
            <CardShell
              icon={MusicIcon}
              iconClass="border-accent-violet/25 bg-accent-violet/10 text-accent-violet"
              title="音乐全网下载"
              desc="咪咕、网易云、QQ 音乐、Apple Music、Spotify……全网曲库一处搜索，无损优先。"
              className="h-full"
            >
              <ChipCloud
                chips={["FLAC 无损", "歌单下载", "格式过滤", "m4a / mp3 / flac", "40+ 平台"]}
                tone="border-white/8 bg-white/[0.04] text-mist-300"
              />
            </CardShell>
          </Reveal>

          <Reveal className="md:col-span-2" delay={0.19}>
            <CardShell
              icon={MovieIcon}
              iconClass="border-accent-pink/25 bg-accent-pink/10 text-accent-pink"
              title="媒体处理"
              desc="PR 智能兼容、转码、重封装、流提取、GIF、逐帧导出——素材进时间线前的最后一站。"
              className="h-full"
            >
              <ChipCloud
                chips={["PR 智能兼容", "重新封装", "提取音轨", "生成 GIF", "逐帧导出"]}
                tone="border-white/8 bg-white/[0.04] text-mist-300"
              />
            </CardShell>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-white/8 bg-ink-900/50 px-6 py-4 text-[12.5px] text-mist-500">
            {["多线程统一队列", "今日任务 / 历史任务", "实时日志", "通知倒计时", "深浅双主题"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckIcon className="size-3.5 text-emerald-400/80" />
                {item}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
