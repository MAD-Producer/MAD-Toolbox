"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GitHubIcon, DownloadIcon } from "@/components/ui/Icons";
import { BASE_PATH } from "@/lib/site";

const NAV_LINKS = [
  { href: "#features", label: "功能" },
  { href: "#deep-dive", label: "特性详解" },
  { href: "#editions", label: "版本" },
  { href: "#open-source", label: "开源" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={`flex w-full max-w-5xl items-center justify-between gap-4 rounded-2xl px-4 py-2.5 transition-all duration-500 ${
          scrolled ? "glass shadow-2xl shadow-black/40" : "border border-transparent"
        }`}
      >
        <a href="#" className="flex items-center gap-2.5" aria-label="MAD Toolbox 首页">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE_PATH}/icon.svg`} alt="MAD Toolbox 图标" className="size-8 rounded-[9px]" />
          <span className="text-[15px] font-semibold tracking-tight">MAD Toolbox</span>
          <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-soft sm:inline-block">
            v0.10.1
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-mist-300 transition-colors hover:bg-white/5 hover:text-mist-100"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/MAD-Producer/MAD-Toolbox"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 仓库"
            className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-mist-300 transition-all hover:border-white/20 hover:text-mist-100"
          >
            <GitHubIcon className="size-[18px]" />
          </a>
          <a
            href="#download"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all hover:-translate-y-px hover:bg-primary-bright"
          >
            <DownloadIcon className="size-4" />
            立即下载
          </a>
        </div>
      </nav>
    </motion.header>
  );
}
