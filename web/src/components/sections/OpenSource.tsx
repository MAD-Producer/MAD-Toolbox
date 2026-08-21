"use client";

import { motion } from "framer-motion";
import { Reveal } from "@/components/ui/Reveal";
import { GitHubIcon, SparkleIcon, ArrowRightIcon } from "@/components/ui/Icons";

const STATS = [
  { value: "MIT", label: "开源许可证" },
  { value: "5 大", label: "功能模块" },
  { value: "2 平台", label: "Windows / macOS" },
  { value: "100%", label: "源码可审计" },
];

export function OpenSource() {
  return (
    <section id="open-source" className="relative scroll-mt-24 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="noise relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900/70 px-6 py-14 text-center sm:px-12">
            <div
              className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(129,119,255,0.18),transparent)] blur-2xl"
              aria-hidden
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-white/12 bg-ink-850 shadow-2xl shadow-black/40"
            >
              <GitHubIcon className="size-8 text-mist-100" />
            </motion.div>

            <h2 className="mt-7 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              开源、免费，<span className="text-gradient-brand">由 MADer 社区驱动</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-mist-400">
              MAD Toolbox 基于 FFmpeg、yt-dlp、BBDown 与 musicdl 等开源内核构建，以 MIT 协议开放全部源代码。
              欢迎提交 Issue 与 Pull Request，一起把它打磨成 MADer 的趁手兵器。
            </p>

            <div className="mx-auto mt-9 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-[20px] font-semibold tracking-tight text-mist-100">{stat.value}</p>
                  <p className="mt-0.5 text-[11.5px] text-mist-500">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/MAD-Producer/MAD-Toolbox"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-mist-100 px-5 py-3 text-[14px] font-medium text-ink-950 transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                <GitHubIcon className="size-[18px]" />
                访问 GitHub 仓库
              </a>
              <a
                href="https://github.com/MAD-Producer/MAD-Toolbox/issues"
                target="_blank"
                rel="noreferrer"
                className="glass flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-medium text-mist-100 transition-all hover:-translate-y-0.5 hover:bg-white/8"
              >
                <SparkleIcon className="size-[18px] text-primary-soft" />
                提交功能建议
                <ArrowRightIcon className="size-4" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
