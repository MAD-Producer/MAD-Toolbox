/** 全站氛围背景：极光渐变 + 网格 + 噪点，固定于视口底层 */
export function Background() {
  return (
    <div className="noise pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* 极光色块（取自应用图标的三色：紫 / 蓝 / 粉） */}
      <div className="animate-aurora-a absolute -top-[22%] left-1/2 h-[62vh] w-[80vw] -translate-x-[58%] rounded-full bg-[radial-gradient(closest-side,rgba(97,85,245,0.24),transparent)] blur-3xl" />
      <div className="animate-aurora-b absolute -top-[8%] left-1/2 h-[52vh] w-[62vw] -translate-x-[38%] rounded-full bg-[radial-gradient(closest-side,rgba(10,132,255,0.2),transparent)] blur-3xl" />
      <div className="animate-aurora-c absolute top-[16%] left-1/2 h-[38vh] w-[42vw] -translate-x-[4%] rounded-full bg-[radial-gradient(closest-side,rgba(255,92,145,0.13),transparent)] blur-3xl" />

      {/* 网格（径向遮罩，向下淡出） */}
      <div className="mask-radial-fade grid-bg absolute inset-0" />

      {/* 底部压暗，保证上方内容对比度 */}
      <div className="absolute inset-x-0 bottom-0 h-[46vh] bg-gradient-to-b from-transparent to-ink-950" />
    </div>
  );
}
