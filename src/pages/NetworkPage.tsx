import { Globe2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildYtDlpArgs, commandPreview, type YtDlpOptions } from "../lib/commands";
import type { RunRequest } from "../lib/types";
import { CommandBar } from "../components/CommandBar";
import { Field, SelectInput, TextInput, Toggle } from "../components/Field";
import { DirectoryInput } from "../components/DirectoryInput";
import { TemplateManager } from "../components/TemplateManager";
import { browserCookieOptions } from "../lib/platform";

interface NetworkPageProps {
  ytDlpAvailable: boolean;
  denoPath: string | null;
  defaultOutputDirectory: string | null;
  onRun: (request: RunRequest) => Promise<unknown>;
  onCheckNetwork: (proxy: string) => Promise<boolean>;
}

const initialOptions: YtDlpOptions = {
  url: "",
  mode: "video",
  outputTemplate: "%(title)s [%(id)s].%(ext)s",
  outputDirectory: "",
  proxy: "",
  format: "",
  audioFormat: "best",
  subtitleLanguages: "zh.*,en.*",
  cookiesBrowser: "",
  playlistItems: "",
  retries: 10,
  concurrentFragments: 4,
  embedMetadata: true,
  embedThumbnail: false,
  embedSubtitles: false,
  writeInfoJson: false,
  noPlaylist: false,
  verbose: false
};

function browserCookieSelection(value: string) {
  return browserCookieOptions.some((option) => option.value === value) ? value : "__custom__";
}

export function NetworkPage({
  ytDlpAvailable,
  denoPath,
  defaultOutputDirectory,
  onRun,
  onCheckNetwork
}: NetworkPageProps) {
  const [options, setOptions] = useState(initialOptions);
  const [selectedBrowserCookie, setSelectedBrowserCookie] = useState(() =>
    browserCookieSelection(initialOptions.cookiesBrowser)
  );
  const [advanced, setAdvanced] = useState(false);
  const [network, setNetwork] = useState<"unknown" | "checking" | "online" | "offline">("unknown");
  const checkedOnce = useRef(false);
  const args = useMemo(() => buildYtDlpArgs(options, denoPath, false), [options, denoPath]);
  const fallbackArgs = useMemo(() => buildYtDlpArgs(options, denoPath), [options, denoPath]);
  const preview = commandPreview("yt-dlp", args);
  const templateOptions = useMemo(() => {
    const { url: _url, ...settings } = options;
    return settings;
  }, [options]);
  const update = <K extends keyof YtDlpOptions>(key: K, value: YtDlpOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const checkNetwork = async () => {
    setNetwork("checking");
    try {
      setNetwork((await onCheckNetwork(options.proxy)) ? "online" : "offline");
    } catch {
      setNetwork("offline");
    }
  };

  useEffect(() => {
    if (!checkedOnce.current) {
      checkedOnce.current = true;
      void checkNetwork();
    }
  }, []);

  useEffect(() => {
    if (defaultOutputDirectory) {
      setOptions((current) =>
        current.outputDirectory.trim()
          ? current
          : { ...current, outputDirectory: defaultOutputDirectory }
      );
    }
  }, [defaultOutputDirectory]);

  const isYouTube = /(^|\.)youtube\.com|youtu\.be/i.test(options.url);
  const youtubeBlocked = isYouTube && network === "offline";
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">YT-DLP + DENO</span>
          <h1>网络视频下载</h1>
          <p>默认选择最高规格并由 FFmpeg 合并，支持 yt-dlp 可解析的网站。</p>
        </div>
        <div className={`network-badge ${network}`}>
          {network === "online" ? (
            <Wifi size={15} />
          ) : network === "offline" ? (
            <WifiOff size={15} />
          ) : (
            <Globe2 size={15} />
          )}
          {network === "checking"
            ? "检测中"
            : network === "online"
              ? "YouTube 可访问"
              : network === "offline"
                ? "无法直连"
                : "尚未检测"}
        </div>
      </div>

      <TemplateManager
        featureKey="network"
        value={templateOptions}
        onApply={(template) => {
          setSelectedBrowserCookie(browserCookieSelection(template.cookiesBrowser));
          setOptions((current) => ({ ...current, ...template, url: current.url }));
        }}
      />

      <section className="tool-panel">
        <div className="network-check">
          <Field
            label="代理服务器"
            hint="直连失败时，可以开启代理软件的全局代理；也可以在这里填写 HTTP、HTTPS 或 SOCKS5 代理地址。留空表示直连。"
          >
            <TextInput
              value={options.proxy}
              onChange={(event) => update("proxy", event.target.value)}
              placeholder="socks5://127.0.0.1:7890"
            />
          </Field>
          <button className="secondary-button" type="button" onClick={() => void checkNetwork()}>
            <RefreshCw size={15} className={network === "checking" ? "spin" : ""} />
            测试 YouTube
          </button>
        </div>

        <Field label="视频或播放列表链接">
          <TextInput
            value={options.url}
            onChange={(event) => update("url", event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </Field>

        <div className="form-grid network-auth-grid">
          <Field
            label="浏览器 Cookie"
            hint="先进行无 Cookie 请求；只有 yt-dlp 返回需要登录或确认不是机器人时，才会使用这里选择的浏览器 Cookie 重试。应用只传递浏览器名称，不保存 Cookie 内容；Windows 上建议先完全退出浏览器再运行。"
          >
            <SelectInput
              value={selectedBrowserCookie}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedBrowserCookie(value);
                if (value !== "__custom__") update("cookiesBrowser", value);
              }}
            >
              {browserCookieOptions.map(({ value, label }) => (
                <option value={value} key={value || "none"}>
                  {label}
                </option>
              ))}
              <option value="__custom__">自定义浏览器 / profile</option>
            </SelectInput>
          </Field>
          {selectedBrowserCookie === "__custom__" && (
            <Field
              label="自定义浏览器参数"
              hint="格式示例：chrome:Default；Firefox profile 可写为 firefox:ProfileName。"
            >
              <TextInput
                value={options.cookiesBrowser}
                onChange={(event) => update("cookiesBrowser", event.target.value)}
                placeholder="chrome:Default"
              />
            </Field>
          )}
        </div>
        {isYouTube && !options.cookiesBrowser.trim() && (
          <div className="notice info">
            <div>
              <strong>YouTube 可能要求登录</strong>
              <p>
                如果任务日志出现 “Sign in to confirm you’re not a bot”，请在上方选择已登录的
                浏览器。选择后会先尝试无 Cookie 请求，只有检测到这类登录验证错误时才会自动
                读取浏览器 Cookie 重试。
              </p>
            </div>
          </div>
        )}
        {options.cookiesBrowser.trim() && (
          <div className="notice info">
            <div>
              <strong>已启用浏览器 Cookie 失败兜底</strong>
              <p>
                当前命令预览保持无 Cookie 请求；如果 yt-dlp 报告需要登录或人机验证，任务会在同一
                个任务中自动使用所选浏览器 Cookie 重试。
              </p>
            </div>
          </div>
        )}

        <div className="quick-mode-grid">
          {[
            ["video", "最高规格", "最佳视频与音频"],
            ["audio", "提取音频", "转换为所选音频格式"],
            ["thumbnail", "仅封面", "不下载视频"],
            ["subtitles", "仅字幕", "下载指定语言"],
            ["formats", "查看格式", "列出可选流"],
            ["metadata", "查看信息", "输出 JSON 元数据"]
          ].map(([value, label, hint]) => (
            <button
              type="button"
              key={value}
              className={`mode-card ${options.mode === value ? "active" : ""}`}
              onClick={() => update("mode", value as YtDlpOptions["mode"])}
            >
              <strong>{label}</strong>
              <small>{hint}</small>
            </button>
          ))}
        </div>

        <button className="advanced-toggle" type="button" onClick={() => setAdvanced(!advanced)}>
          {advanced ? "收起参数设置" : "展开参数设置"}
        </button>
        {advanced && (
          <div className="advanced-panel">
            <div className="form-grid">
              <Field label="下载目录">
                <DirectoryInput
                  value={options.outputDirectory}
                  onChange={(value) => update("outputDirectory", value)}
                />
              </Field>
              <Field label="文件名模板">
                <TextInput
                  value={options.outputTemplate}
                  onChange={(e) => update("outputTemplate", e.target.value)}
                />
              </Field>
              <Field label="格式选择" hint="留空使用 yt-dlp 默认最高规格">
                <TextInput
                  value={options.format}
                  onChange={(e) => update("format", e.target.value)}
                  placeholder="bv*+ba/b"
                />
              </Field>
              <Field label="音频格式">
                <SelectInput
                  value={options.audioFormat}
                  onChange={(e) => update("audioFormat", e.target.value)}
                >
                  <option value="best">best</option>
                  <option value="m4a">m4a</option>
                  <option value="mp3">mp3</option>
                  <option value="flac">flac</option>
                  <option value="wav">wav</option>
                  <option value="opus">opus</option>
                </SelectInput>
              </Field>
              <Field label="字幕语言">
                <TextInput
                  value={options.subtitleLanguages}
                  onChange={(e) => update("subtitleLanguages", e.target.value)}
                />
              </Field>
              <Field label="播放列表项目" hint="例如 1:10 或 1,3,7">
                <TextInput
                  value={options.playlistItems}
                  onChange={(e) => update("playlistItems", e.target.value)}
                />
              </Field>
              <Field label="重试次数">
                <TextInput
                  type="number"
                  min={0}
                  value={options.retries}
                  onChange={(e) => update("retries", Number(e.target.value))}
                />
              </Field>
              <Field label="并发分片">
                <TextInput
                  type="number"
                  min={1}
                  value={options.concurrentFragments}
                  onChange={(e) => update("concurrentFragments", Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="toggle-grid">
              <Toggle
                checked={options.embedMetadata}
                onChange={(v) => update("embedMetadata", v)}
                label="嵌入元数据"
              />
              <Toggle
                checked={options.embedThumbnail}
                onChange={(v) => update("embedThumbnail", v)}
                label="嵌入封面"
              />
              <Toggle
                checked={options.embedSubtitles}
                onChange={(v) => update("embedSubtitles", v)}
                label="嵌入字幕"
              />
              <Toggle
                checked={options.writeInfoJson}
                onChange={(v) => update("writeInfoJson", v)}
                label="保存 info.json"
              />
              <Toggle
                checked={options.noPlaylist}
                onChange={(v) => update("noPlaylist", v)}
                label="只下载单个视频"
              />
              <Toggle
                checked={options.verbose}
                onChange={(v) => update("verbose", v)}
                label="详细调试日志"
              />
            </div>
          </div>
        )}
      </section>
      <CommandBar
        command={preview}
        onRun={() =>
          void onRun({
            tool: "yt-dlp",
            args,
            fallbackArgs: options.cookiesBrowser.trim() ? fallbackArgs : undefined
          })
        }
        disabled={!options.url.trim() || !ytDlpAvailable || youtubeBlocked}
        disabledReason={
          !ytDlpAvailable
            ? "未找到 yt-dlp"
            : youtubeBlocked
              ? "YouTube 无法直连，请启用系统代理或填写代理参数"
              : "请填写链接"
        }
      />
    </div>
  );
}
