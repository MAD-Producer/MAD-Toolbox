"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { CheckIcon, ArrowRightIcon } from "@/components/ui/Icons";

/* ---------------- 通用布局 ---------------- */

function VisualShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        className="absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(closest-side,rgba(10,132,255,0.13),transparent)] blur-2xl"
        aria-hidden
      />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/85 shadow-2xl shadow-black/50 backdrop-blur">
        {children}
      </div>
    </div>
  );
}

function VisualChrome({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/6 bg-ink-850/70 px-4 py-2.5">
      <div className="flex gap-1.5">
        <span className="size-2 rounded-full bg-[#ff5f57]/80" />
        <span className="size-2 rounded-full bg-[#febc2e]/80" />
        <span className="size-2 rounded-full bg-[#28c840]/80" />
      </div>
      <p className="flex-1 text-center text-[11.5px] text-mist-500">{title}</p>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  highlight,
  desc,
  bullets,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  desc: string;
  bullets: string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={reverse ? "lg:order-2" : ""}>
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-primary-soft">{eyebrow}</p>
        <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-[32px] sm:leading-[1.2]">
          {title}
          <span className="text-gradient-brand">{highlight}</span>
        </h3>
        <p className="mt-4 text-[14.5px] leading-7 text-mist-400">{desc}</p>
        <ul className="mt-6 space-y-3">
          {bullets.map((bullet, i) => (
            <motion.li
              key={bullet}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
              className="flex items-start gap-2.5 text-[14px] text-mist-300"
            >
              <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary/12">
                <CheckIcon className="size-3 text-primary-soft" />
              </span>
              {bullet}
            </motion.li>
          ))}
        </ul>
      </Reveal>
      <Reveal className={reverse ? "lg:order-1" : ""} delay={0.12}>
        <VisualShell>{visual}</VisualShell>
      </Reveal>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] text-mist-500">{label}</p>
      <p className={`truncate rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-[12.5px] text-mist-300 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function MiniChip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={`rounded-lg border px-2.5 py-1 text-[11.5px] ${
        active ? "border-primary/40 bg-primary/12 text-primary-soft" : "border-white/8 bg-white/[0.03] text-mist-400"
      }`}
    >
      {children}
    </span>
  );
}

/* ---------------- 1. 哔哩哔哩 ---------------- */

function BilibiliVisual() {
  return (
    <>
      <VisualChrome title="哔哩哔哩下载" />
      <div className="space-y-3.5 p-4 sm:p-5">
        <Field label="视频地址" value="https://www.bilibili.com/video/BV1xx411c7mD" mono />
        <div className="grid grid-cols-2 gap-3">
          <Field label="选集" value="1,3-5" />
          <Field label="画质优先级" value="8K 超高清" />
        </div>
        <div>
          <p className="mb-1.5 text-[11px] text-mist-500">编码优先级</p>
          <div className="flex flex-wrap gap-1.5">
            <MiniChip active>hevc</MiniChip>
            <MiniChip>av1</MiniChip>
            <MiniChip>avc</MiniChip>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] text-mist-500">下载内容</p>
          <div className="flex flex-wrap gap-1.5">
            {["完整视频 ✓", "弹幕 ✓", "字幕 ✓", "封面 ✓", "AI 字幕 跳过"].map((item) => (
              <MiniChip key={item} active={item.includes("✓")}>
                {item}
              </MiniChip>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="rounded-lg bg-primary px-3.5 py-2 text-[12px] font-medium text-white shadow-lg shadow-primary/25">
            添加到任务队列
          </span>
          <span className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[12px] text-mist-300">
            已登录 · 哔哩哔哩
          </span>
          <span className="ml-auto rounded-lg border border-white/8 px-2.5 py-2 text-[11px] text-mist-500">模板</span>
        </div>
      </div>
    </>
  );
}

/* ---------------- 2. 音乐 ---------------- */

function MusicVisual() {
  const results = [
    { title: "夜に駆ける", artist: "YOASOBI", size: "48.2 MB", quality: "FLAC", best: true },
    { title: "夜に駆ける", artist: "YOASOBI", size: "9.8 MB", quality: "320K" },
    { title: "夜に駆ける (Live ver.)", artist: "YOASOBI", size: "52.6 MB", quality: "FLAC" },
  ];
  const platforms = ["咪咕音乐", "网易云音乐", "QQ 音乐", "酷我音乐", "千千音乐", "Apple Music", "Spotify", "TIDAL", "Deezer", "SoundCloud", "Suno", "波点音乐"];
  return (
    <>
      <VisualChrome title="音乐下载" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-ink-950/60 px-3.5 py-2.5">
          <span className="text-[12.5px] text-mist-500">搜索</span>
          <span className="text-[13px] text-mist-200">夜に駆ける</span>
          <span className="ml-auto flex gap-1">
            {["全部", "FLAC", "320K"].map((f, i) => (
              <span
                key={f}
                className={`rounded px-2 py-0.5 text-[10.5px] ${i === 1 ? "bg-primary/15 text-primary-soft" : "text-mist-500"}`}
              >
                {f}
              </span>
            ))}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {results.map((row, i) => (
            <motion.div
              key={`${row.title}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.14, duration: 0.5 }}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                row.best ? "border-primary/30 bg-primary/6" : "border-white/6 bg-white/[0.02]"
              }`}
            >
              <span className={`size-1.5 rounded-full ${row.best ? "bg-primary" : "bg-mist-500/50"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-mist-200">{row.title}</p>
                <p className="text-[11px] text-mist-500">{row.artist} · {row.size}</p>
              </div>
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[10.5px] ${
                  row.quality === "FLAC" ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-white/10 text-mist-400"
                }`}
              >
                {row.quality}
                {row.best ? " 无损首选" : ""}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="mask-fade-x mt-4 overflow-hidden">
          <div className="animate-marquee-slow flex w-max gap-2 py-1">
            {[...platforms, ...platforms].map((p, i) => (
              <span key={`${p}-${i}`} className="shrink-0 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] text-mist-400">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- 3. 媒体处理 ---------------- */

function MediaVisual() {
  const steps = [
    { name: "opening_pr.mp4", tag: "H.265 · 10bit", from: true },
    { name: "opening_h264.mp4", tag: "H.264 · yuv420p · faststart", from: false },
  ];
  return (
    <>
      <VisualChrome title="媒体处理" />
      <div className="p-4 sm:p-5">
        <div className="flex gap-1.5 overflow-x-auto">
          {["PR 智能兼容", "转码", "重新封装", "流提取", "GIF", "帧导出"].map((tab, i) => (
            <span
              key={tab}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] ${
                i === 0 ? "bg-primary/15 text-primary-soft" : "text-mist-500"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={step.name}>
                <motion.div
                  initial={{ opacity: 0, x: i === 0 ? -16 : 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.2, duration: 0.55 }}
                  className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 ${
                    step.from ? "border-white/8 bg-ink-950/50" : "border-primary/30 bg-primary/6"
                  }`}
                >
                  <span className={`font-mono text-[12px] ${step.from ? "text-mist-300" : "text-primary-soft"}`}>
                    {step.name}
                  </span>
                  <span className="ml-auto text-[10.5px] text-mist-500">{step.tag}</span>
                </motion.div>
                {i === 0 && (
                  <div className="flex justify-center py-1.5 text-mist-500">
                    <ArrowRightIcon className="size-4 rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11.5px] text-emerald-300">
            <span className="animate-pulse-dot size-1.5 rounded-full bg-emerald-400" />
            兼容性分析完成 · 转码中
          </div>
          <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11.5px] text-mist-300">
            检视首个文件
          </span>
        </div>
      </div>
    </>
  );
}

/* ---------------- 4. 任务中心 ---------------- */

function TasksVisual() {
  const tasks = [
    { name: "【MAD】素材批量下载 · P1-P3", status: "运行中", tone: "text-emerald-300", dot: "bg-emerald-400", width: "68%", speed: "12.4 MB/s" },
    { name: "BGM · 夜に駆ける (FLAC)", status: "运行中", tone: "text-emerald-300", dot: "bg-emerald-400", width: "34%", speed: "3.1 MB/s" },
    { name: "opening_pr.mp4 → h264", status: "处理中", tone: "text-accent-violet", dot: "bg-accent-violet", width: "52%", speed: "ffmpeg" },
    { name: "封面批量导出 ×12", status: "排队中", tone: "text-amber-300", dot: "bg-amber-400", width: "0%", speed: "等待" },
  ];
  return (
    <>
      <VisualChrome title="任务中心" />
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {["今日任务", "历史任务"].map((tab, i) => (
              <span
                key={tab}
                className={`rounded-lg px-3 py-1.5 text-[12px] ${i === 0 ? "bg-white/10 text-mist-100" : "text-mist-500"}`}
              >
                {tab}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-mist-500">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary" />下载池 2/2</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-accent-violet" />处理池 1/2</span>
          </div>
        </div>

        <div className="mt-3.5 space-y-2">
          {tasks.map((task, i) => (
            <motion.div
              key={task.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.13, duration: 0.5 }}
              className="rounded-xl border border-white/6 bg-ink-850/80 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className={`size-1.5 shrink-0 rounded-full ${task.dot}`} />
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-mist-300">{task.name}</p>
                <span className={`shrink-0 text-[11px] ${task.tone}`}>{task.status}</span>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/6">
                  <motion.div
                    initial={{ width: "2%" }}
                    whileInView={{ width: task.width }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.13, duration: 1.2, ease: "easeOut" }}
                    className={`h-full rounded-full ${task.status === "处理中" ? "bg-accent-violet/80" : "bg-gradient-to-r from-primary to-accent-cyan"}`}
                  />
                </div>
                <span className="w-[68px] shrink-0 text-right font-mono text-[10px] text-mist-500">{task.speed}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------- 汇总导出 ---------------- */

export function DeepDive() {
  return (
    <section id="deep-dive" className="relative scroll-mt-24 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-24 sm:space-y-32">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-primary-soft">特性详解</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              每个模块，都为
              <span className="text-gradient-brand"> MAD 工作流</span>
              而设计
            </h2>
          </div>
        </Reveal>

        <FeatureRow
          eyebrow="Bilibili Download"
          title="哔哩哔哩下载，"
          highlight="精确到选集与编码"
          desc="从 8K 超高清到仅弹幕，想下什么勾什么。选集语法一次拉完多 P，画质与编码优先级按你的时间线需求排序。"
          bullets={[
            "下载内容自由组合：完整视频 / 仅视频轨 / 仅音频 / 封面 / 字幕 / 弹幕 / 解析信息",
            "选集语法支持 1,3-5 或 ALL，多 P 一键批量",
            "画质 × 编码双优先级：8K 超高清、HEVC / AV1 / AVC",
            "扫码登录，Web / TV / APP / 国际版多线路可选",
            "常用配置保存为模板，下次一键复用",
          ]}
          visual={<BilibiliVisual />}
        />

        <FeatureRow
          eyebrow="Music Everywhere"
          title="全网音乐，"
          highlight="无损优先一处搜"
          desc="聚合 40+ 中外平台的曲库搜索与下载，按格式与音质过滤，无损音源自动置顶。整张歌单也能一次打包。"
          bullets={[
            "中国大陆及华语平台：咪咕、网易云、QQ 音乐、酷我、千千、5SING 等",
            "海外流媒体：Apple Music、Spotify、TIDAL、Deezer、YouTube Music、Suno 等",
            "FLAC / mp3 / m4a 格式过滤，无损音源自动优先挑选",
            "搜索单曲或直接下载整个歌单",
          ]}
          visual={<MusicVisual />}
          reverse
        />

        <FeatureRow
          eyebrow="Media Processing"
          title="媒体处理，"
          highlight="素材进 PR 前的最后一站"
          desc="H.265 10bit 素材直投 Premiere 报错？PR 智能兼容一键转成时间线友好的编码。转码、重封装、抽流、GIF、逐帧导出，全在一个面板。"
          bullets={[
            "PR 智能兼容：自动分析并转出 PR 稳定支持的编码组合",
            "重新封装秒级完成，不重编码不改画质",
            "提取音频 / 视频流 / 字幕，截取封面",
            "GIF 生成与逐帧导出，逐帧研究别人的神剪辑",
          ]}
          visual={<MediaVisual />}
        />

        <FeatureRow
          eyebrow="Unified Tasks"
          title="任务中心，"
          highlight="一切尽在掌握"
          desc="下载任务与处理任务汇入统一队列，双资源池分别控制并发。状态、进度、速度、日志实时可见——挂机下载，专注剪辑。"
          bullets={[
            "下载资源池 + 处理资源池独立并发控制，互不挤占带宽与 CPU",
            "排队 / 运行 / 取消中 / 失败 / 已取消，状态机完整可追踪",
            "今日任务与历史任务分栏，实时日志随时回看",
            "任务完成通知带倒计时，离开座位也不错过",
          ]}
          visual={<TasksVisual />}
          reverse
        />
      </div>
    </section>
  );
}
