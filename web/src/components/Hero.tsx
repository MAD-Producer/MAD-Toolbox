"use client";

import { motion } from "framer-motion";
import { AppWindow } from "@/components/AppWindow";
import { WindowsIcon, AppleIcon, GitHubIcon } from "@/components/ui/Icons";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

export function Hero() {
  return (
    <section className="relative px-4 pb-16 pt-36 sm:pt-44">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <motion.a
            href="https://github.com/MAD-Producer/MAD-Toolbox/releases"
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="glass group flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-[12.5px] text-mist-300 transition-colors hover:text-mist-100"
          >
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary-soft">v0.10.1</span>
            全新现代化界面已开源发布
            <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </motion.a>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.1, ease: EASE }}
            className="mt-6 text-balance text-4xl font-semibold leading-[1.12] tracking-tight sm:text-6xl md:text-[64px]"
          >
            为 <span className="text-gradient-vivid">MADer</span> 而生的
            <br />
            <span className="text-gradient-brand">多媒体工具箱</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.2, ease: EASE }}
            className="mt-5 text-[15px] italic text-mist-400"
          >
            “There are many toolboxes, but this one is for you, MADer.”
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.28, ease: EASE }}
            className="mt-3 max-w-xl text-pretty text-[15px] leading-7 text-mist-300"
          >
            哔哩哔哩、YouTube、全网音乐一站下载；转码、重封装、GIF、抽帧一站处理。
            下载与处理任务统一调度，为 MAD 视频创作流程提速。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.38, ease: EASE }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href="https://github.com/MAD-Producer/MAD-Toolbox/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[15px] font-medium text-white shadow-xl shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-primary-bright hover:shadow-primary/40"
            >
              <WindowsIcon className="size-[18px]" />
              下载 Windows 版
            </a>
            <a
              href="https://github.com/MAD-Producer/MAD-Toolbox/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="glass flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-medium text-mist-100 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8"
            >
              <AppleIcon className="size-[18px]" />
              下载 macOS 版
            </a>
            <a
              href="https://github.com/MAD-Producer/MAD-Toolbox"
              target="_blank"
              rel="noreferrer"
              aria-label="在 GitHub 查看 MAD Toolbox"
              className="glass flex size-[46px] items-center justify-center rounded-xl text-mist-300 transition-all hover:-translate-y-0.5 hover:text-mist-100"
            >
              <GitHubIcon className="size-5" />
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-4 text-[12px] text-mist-500"
          >
            Windows 10 / 11 · macOS 14+ on Apple Silicon · Full / Lite 双版本 · MIT 开源
          </motion.p>
        </div>

        <div className="mt-16 sm:mt-20">
          <AppWindow />
        </div>
      </div>
    </section>
  );
}
