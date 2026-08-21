import { Reveal } from "@/components/ui/Reveal";
import { WindowsIcon, AppleIcon, GitHubIcon } from "@/components/ui/Icons";

export function DownloadCTA() {
  return (
    <section id="download" className="relative scroll-mt-24 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="conic-ring relative overflow-hidden rounded-3xl bg-ink-900/85 px-6 py-16 text-center backdrop-blur sm:px-12 sm:py-20">
            <div
              className="absolute -bottom-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(10,132,255,0.2),transparent)] blur-2xl"
              aria-hidden
            />
            <p className="relative text-[13px] font-semibold uppercase tracking-[0.2em] text-primary-soft">
              免费开始
            </p>
            <h2 className="relative mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
              开始你的
              <span className="text-gradient-vivid"> MAD 工作流</span>
            </h2>
            <p className="relative mx-auto mt-5 max-w-lg text-[15px] leading-7 text-mist-400">
              下载、转码、任务调度，一个工具箱搞定。两个平台、两种版本，即刻起飞。
            </p>

            <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/MAD-Producer/MAD-Toolbox/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-2xl bg-primary px-6 py-3.5 text-[15px] font-medium text-white shadow-xl shadow-primary/30 transition-all hover:-translate-y-0.5 hover:bg-primary-bright"
              >
                <WindowsIcon className="size-5" />
                Windows 10 / 11
              </a>
              <a
                href="https://github.com/MAD-Producer/MAD-Toolbox/releases/latest"
                target="_blank"
                rel="noreferrer"
                className="glass flex items-center gap-2.5 rounded-2xl px-6 py-3.5 text-[15px] font-medium text-mist-100 transition-all hover:-translate-y-0.5 hover:bg-white/8"
              >
                <AppleIcon className="size-5" />
                macOS Apple Silicon
              </a>
            </div>

            <p className="relative mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-mist-500">
              <span>v0.10.1 · 全新现代化界面</span>
              <a
                href="https://github.com/MAD-Producer/MAD-Toolbox/releases"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-mist-400 underline-offset-4 transition-colors hover:text-mist-100 hover:underline"
              >
                <GitHubIcon className="size-3.5" />
                查看全部版本与更新日志
              </a>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
