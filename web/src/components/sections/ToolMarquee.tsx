import { Reveal } from "@/components/ui/Reveal";

const TOOLS = [
  { name: "FFmpeg", desc: "媒体转码与处理核心" },
  { name: "yt-dlp", desc: "YouTube 与万站视频下载" },
  { name: "BBDown", desc: "哔哩哔哩视频下载" },
  { name: "musicdl", desc: "多平台音乐搜索下载" },
  { name: "MediaInfo", desc: "媒体元数据分析" },
  { name: "Deno", desc: "脚本运行时" },
];

function MarqueeRow() {
  return (
    <div className="flex shrink-0 items-center">
      {TOOLS.map((tool) => (
        <div
          key={tool.name}
          className="mx-2.5 flex items-center gap-3 rounded-xl border border-white/8 bg-ink-850/70 px-5 py-3"
        >
          <span className="size-2 rounded-full bg-gradient-to-br from-primary to-accent-cyan" />
          <span className="text-[14px] font-medium text-mist-100">{tool.name}</span>
          <span className="text-[12px] text-mist-500">{tool.desc}</span>
        </div>
      ))}
    </div>
  );
}

/** 底层内核展示：无限滚动 Marquee */
export function ToolMarquee() {
  return (
    <section className="relative px-4 py-14">
      <Reveal className="mx-auto max-w-6xl">
        <p className="text-center text-[12px] font-medium uppercase tracking-[0.22em] text-mist-500">
          站在巨人肩膀上 · Powered by
        </p>
        <div className="mask-fade-x mt-6 overflow-hidden">
          <div className="animate-marquee flex w-max">
            <MarqueeRow />
            <MarqueeRow />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
