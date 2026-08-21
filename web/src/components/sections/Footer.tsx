import { BASE_PATH } from "@/lib/site";

const LINK_GROUPS = [
  {
    title: "资源",
    links: [
      { label: "GitHub 仓库", href: "https://github.com/MAD-Producer/MAD-Toolbox" },
      { label: "版本发布", href: "https://github.com/MAD-Producer/MAD-Toolbox/releases" },
      { label: "更新日志", href: "https://github.com/MAD-Producer/MAD-Toolbox/blob/main/CHANGELOG.md" },
      { label: "问题反馈", href: "https://github.com/MAD-Producer/MAD-Toolbox/issues" },
    ],
  },
  {
    title: "关于",
    links: [
      { label: "MAD Producer Studio", href: "https://madproducer.cn" },
      { label: "贡献指南", href: "https://github.com/MAD-Producer/MAD-Toolbox/blob/main/CONTRIBUTING.md" },
      { label: "开源许可证 (MIT)", href: "https://github.com/MAD-Producer/MAD-Toolbox/blob/main/LICENSE" },
      { label: "第三方声明", href: "https://github.com/MAD-Producer/MAD-Toolbox/blob/main/THIRD_PARTY_NOTICES.md" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/6 px-4 pb-10 pt-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BASE_PATH}/icon.svg`} alt="MAD Toolbox 图标" className="size-9 rounded-[10px]" />
              <span className="text-[16px] font-semibold tracking-tight">MAD Toolbox</span>
            </div>
            <p className="mt-4 max-w-sm text-[13px] leading-6 text-mist-500">
              There are many toolboxes, but this one is for you, MADer.
              把常用媒体命令行工具变成清晰的图形工作流。
            </p>
            <p className="mt-4 text-[12px] text-mist-500">
              Copyright © 2026 <a href="https://madproducer.cn" target="_blank" rel="noreferrer" className="text-mist-400 transition-colors hover:text-mist-100">MAD Producer Studio</a>
            </p>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[13px] font-semibold text-mist-300">{group.title}</p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] text-mist-500 transition-colors hover:text-mist-100"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/6 pt-6 text-[11.5px] leading-5 text-mist-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            基于 FFmpeg · yt-dlp · BBDown · musicdl · MediaInfo · Deno 构建，感谢开源社区。
          </p>
          <p className="shrink-0">MAD Toolbox 不托管任何媒体内容，使用时请遵循各平台条款与当地法律。</p>
        </div>
      </div>
    </footer>
  );
}
