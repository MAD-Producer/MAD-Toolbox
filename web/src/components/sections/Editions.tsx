import { Reveal } from "@/components/ui/Reveal";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { CheckIcon, WindowsIcon, AppleIcon } from "@/components/ui/Icons";

type Edition = {
  name: string;
  tagline: string;
  features: string[];
  recommended?: boolean;
};

const EDITIONS: Edition[] = [
  {
    name: "Full 完整版",
    tagline: "开箱即用，工具链全内置",
    recommended: true,
    features: [
      "内置 BBDown、FFmpeg、yt-dlp、MediaInfo、Deno",
      "所有二进制逐个 SHA-256 校验",
      "离线 WebView2 安装器，无网也能装",
      "解压即用，适合新机器与离线环境",
    ],
  },
  {
    name: "Lite 轻量版",
    tagline: "本体更小，依赖按需安装",
    features: [
      "使用系统已有依赖，安装包显著更小",
      "应用内一键安装缺失依赖（winget / Homebrew）",
      "中科大 / 清华镜像加速，国内下载不犯愁",
      "依赖状态可视化，随时补装与更新",
    ],
  },
];

export function Editions() {
  return (
    <section id="editions" className="relative scroll-mt-24 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-primary-soft">两种版本</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            按需选择，<span className="text-gradient-brand">各取所长</span>
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-mist-400">
            同一套功能，两种分发形态。不确定选哪个？日常使用推荐 Full 完整版。
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {EDITIONS.map((edition, i) => (
            <Reveal key={edition.name} delay={0.08 + i * 0.1}>
              <SpotlightCard
                className={`relative h-full rounded-2xl border p-7 transition-colors duration-300 ${
                  edition.recommended
                    ? "border-primary/35 bg-gradient-to-b from-primary/10 to-ink-900/80"
                    : "border-white/8 bg-ink-900/70"
                }`}
              >
                {edition.recommended && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-white shadow-lg shadow-primary/30">
                    推荐
                  </span>
                )}
                <h3 className="text-[18px] font-semibold">{edition.name}</h3>
                <p className="mt-1.5 text-[13.5px] text-mist-400">{edition.tagline}</p>
                <ul className="mt-6 space-y-3">
                  {edition.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13.5px] leading-6 text-mist-300">
                      <span className={`mt-1 flex size-[17px] shrink-0 items-center justify-center rounded-full ${edition.recommended ? "bg-primary/15" : "bg-white/8"}`}>
                        <CheckIcon className={`size-2.5 ${edition.recommended ? "text-primary-soft" : "text-mist-400"}`} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex items-center gap-2 border-t border-white/6 pt-5 text-[12px] text-mist-500">
                  <WindowsIcon className="size-4" /> Windows .exe
                  <span className="text-mist-600">·</span>
                  <AppleIcon className="size-4" /> macOS .dmg
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
