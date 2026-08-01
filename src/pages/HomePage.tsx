import { Check, Copy, Download, Music2, RefreshCw, TriangleAlert, X } from "lucide-react";
import type { DependencyStatus } from "../lib/types";
import {
  isWindows,
  liteInstallCommand,
  platformLabel
} from "../lib/platform";

interface HomePageProps {
  dependencies: DependencyStatus[];
  distributionMode: "Lite" | "Full";
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (page: "bilibili" | "network" | "music" | "media") => void;
}

export function HomePage({
  dependencies,
  distributionMode,
  loading,
  onRefresh,
  onNavigate
}: HomePageProps) {
  const missingOptional = dependencies.filter((item) => item.required && !item.available);
  const usingSystemTools = dependencies.some(
    (item) => item.required && item.available && item.source === "system"
  );
  const installCommand = liteInstallCommand;

  return (
    <div className="page">
      <section className="hero-card">
        <div>
          <span className="eyebrow">{platformLabel.toUpperCase()} · {distributionMode === "Full" ? "全内置版" : "轻量版"}</span>
          <h1>让常用媒体命令变得简单。</h1>
          <p>选择功能和参数，MAD Toolbox 会生成命令、执行任务并保留完整日志。</p>
        </div>
        <div className="hero-mark">MAD</div>
      </section>

      <div className="section-heading">
        <div>
          <h2>快速开始</h2>
          <p>常用功能均有简易模式，也可展开完整参数。</p>
        </div>
      </div>
      <div className="feature-grid">
        <button className="feature-card bilibili" onClick={() => onNavigate("bilibili")}>
          <span className="feature-icon">B</span>
          <span>
            <strong>哔哩哔哩下载</strong>
            <small>BBDown · 原始 CLI 参数</small>
          </span>
        </button>
        <button className="feature-card network" onClick={() => onNavigate("network")}>
          <Download size={22} />
          <span>
            <strong>网络视频下载</strong>
            <small>yt-dlp · 代理检测 · 最高画质</small>
          </span>
        </button>
        <button className="feature-card media" onClick={() => onNavigate("media")}>
          <span className="feature-icon">▶</span>
          <span>
            <strong>媒体处理</strong>
            <small>FFmpeg · 转换 · 封装 · 抽流</small>
          </span>
        </button>
        <button className="feature-card music" onClick={() => onNavigate("music")}>
          <Music2 size={22} />
          <span>
            <strong>音乐下载</strong>
            <small>Python 3 + musicdl · 外部安装后启用</small>
          </span>
        </button>
      </div>

      <div className="section-heading">
        <div>
          <h2>运行环境</h2>
          <p>
            {distributionMode === "Full"
              ? usingSystemTools
                ? `当前优先使用系统${isWindows ? "安装" : " / Homebrew"}版本，缺少时自动回退到应用内置版本。`
                : "当前优先使用经过审计的应用内置版本；可在设置中切换到系统最新版。"
              : `优先使用可用的内置依赖，缺少时从系统${isWindows ? "安装位置" : "或 Homebrew"}查找。`}
          </p>
        </div>
        <button className="secondary-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          重新检测
        </button>
      </div>

      <div className="dependency-list">
        {dependencies.map((item) => (
          <div className="dependency-row" key={item.tool}>
            <span className={`status-dot ${item.available ? "ok" : "missing"}`}>
              {item.available ? <Check size={13} /> : <X size={13} />}
            </span>
            <span className="dependency-name">
              <strong>{item.label}</strong>
              <small>{item.version || item.path || "未找到"}</small>
            </span>
            <span className={`source-pill ${item.bundled ? "bundled" : ""}`}>
              {item.bundled ? "应用内置" : item.available ? "系统安装" : "需要安装"}
            </span>
          </div>
        ))}
      </div>

      {distributionMode === "Lite" && missingOptional.length > 0 && (
        <div className="notice warning">
          <TriangleAlert size={18} />
          <div>
            <strong>缺少轻量版依赖</strong>
            <p>安装完成后返回这里重新检测。BBDown 已随 Lite 版内置，无需另外安装。</p>
            <code>{installCommand}</code>
          </div>
          <button
            className="icon-button"
            onClick={() => void navigator.clipboard.writeText(installCommand)}
            title="复制安装命令"
          >
            <Copy size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
