import { CircleHelp, LogIn, QrCode, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { buildBilibiliArgs, commandPreview, type BilibiliOptions } from "../lib/commands";
import type { BbdownAuthStatus, LoginQr, RunRequest, RunResult } from "../lib/types";
import { CommandBar } from "../components/CommandBar";
import { Field, SelectInput, TextArea, TextInput, Toggle } from "../components/Field";
import { DirectoryInput } from "../components/DirectoryInput";
import { TemplateManager } from "../components/TemplateManager";
import { defaultOutputPlaceholder } from "../lib/platform";

interface BilibiliPageProps {
  bbdownAvailable: boolean;
  bbdownAuthStatus: BbdownAuthStatus;
  loginQr: LoginQr | null;
  onRun: (request: RunRequest) => Promise<RunResult>;
}

const initialOptions: BilibiliOptions = {
  url: "",
  mode: "video",
  api: "web",
  pages: "",
  encodingPriority: "",
  qualityPriority: "",
  filePattern: "",
  multiFilePattern: "",
  outputDirectory: "",
  useMp4box: false,
  useAria2c: false,
  showAll: false,
  hideStreams: false,
  skipMux: false,
  skipSubtitle: false,
  skipCover: false,
  skipAi: false,
  multiThread: false,
  forceHttp: false,
  downloadDanmaku: false,
  videoAscending: false,
  audioAscending: false,
  allowPcdn: false,
  forceReplaceHost: false,
  saveArchive: false,
  debug: false,
  language: "",
  userAgent: "",
  cookie: "",
  accessToken: "",
  aria2cArgs: "",
  mp4boxPath: "",
  aria2cPath: "",
  uposHost: "",
  delayPerPage: "",
  host: "",
  epHost: "",
  area: "",
  configFile: "",
  extraArgs: ""
};

export function BilibiliPage({
  bbdownAvailable,
  bbdownAuthStatus,
  loginQr,
  onRun
}: BilibiliPageProps) {
  const [options, setOptions] = useState(initialOptions);
  const [advanced, setAdvanced] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const args = useMemo(() => buildBilibiliArgs(options), [options]);
  const preview = commandPreview("bbdown", args);
  const templateOptions = useMemo(() => {
    const { url: _url, ...settings } = options;
    return settings;
  }, [options]);
  const update = <K extends keyof BilibiliOptions>(key: K, value: BilibiliOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const beginLogin = () =>
    onRun({
      tool: "bbdown",
      args: ["login"]
    });

  const authCopy = {
    unknown: {
      title: "登录状态待检测",
      hint: "优先沿用终端 bbdown 已保存的原生状态；没有时再扫码登录。",
      button: "扫码登录"
    },
    authenticated: {
      title: "已检测到 BBDown 登录状态",
      hint: "BBDown 已取得账号权限，最终画质仍取决于账号和视频本身。",
      button: "重新登录"
    },
    unauthenticated: {
      title: "未检测到有效登录",
      hint: "BBDown 报告账号未登录，请重新扫码并在手机上确认。",
      button: "重新扫码登录"
    }
  }[bbdownAuthStatus];

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">内置 BBDOWN</span>
          <h1>哔哩哔哩下载</h1>
          <p>粘贴哔哩哔哩链接或 ID，BBDown 将自动选择可用的最高规格。</p>
        </div>
        <button className="help-button" type="button" onClick={() => setShowLinks(!showLinks)}>
          <CircleHelp size={16} />
          支持的链接
        </button>
      </div>

      {showLinks && (
        <section className="supported-links">
          <strong>支持输入完整链接或 ID</strong>
          <div>
            <code>https://www.bilibili.com/video/BV...</code>
            <code>https://www.bilibili.com/video/av...</code>
            <code>https://www.bilibili.com/bangumi/play/ep...</code>
            <code>https://www.bilibili.com/bangumi/play/ss...</code>
            <code>https://b23.tv/...</code>
            <code>BV... / av... / ep... / ss...</code>
          </div>
          <p>多分 P、课程、合集、收藏夹和空间解析能力以当前内置 BBDown 1.6.3 的实际结果为准。</p>
        </section>
      )}

      <section className={`auth-card ${bbdownAuthStatus}`}>
        <div className="auth-icon">
          <QrCode size={24} />
        </div>
        <div className="auth-copy">
          <strong>{authCopy.title}</strong>
          <span>{authCopy.hint}</span>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => void beginLogin()}
          disabled={!bbdownAvailable}
        >
          <LogIn size={15} />
          {authCopy.button}
        </button>
      </section>

      <section className="membership-note">
        <ShieldCheck size={17} />
        <div>
          <strong>下载规格取决于当前 B站账号权限</strong>
          <p>
            “最高规格”指该账号当前可访问的最高规格。大会员画质、HDR、杜比视界、高码率及会员视频需要账号具备对应会员、内容与地区权限。
          </p>
        </div>
      </section>

      {loginQr && (
        <section className="login-qr-card">
          <img src={loginQr.dataUrl} alt="BBDown 哔哩哔哩登录二维码" />
          <div>
            <span className="eyebrow">BILIBILI LOGIN</span>
            <strong>请使用哔哩哔哩手机客户端扫码</strong>
            <p>请在手机上确认登录，完成后即可返回继续下载。</p>
          </div>
        </section>
      )}

      <TemplateManager
        featureKey="bilibili"
        value={templateOptions}
        onApply={(template) =>
          setOptions((current) => ({
            ...current,
            ...template,
            url: current.url
          }))
        }
      />

      <section className="tool-panel">
        <Field
          label="视频链接或 ID"
          hint="支持 BV、av、ep、ss、分 P、课程、合集以及 b23.tv 短链接。"
        >
          <TextInput
            value={options.url}
            onChange={(event) => update("url", event.target.value)}
            placeholder="https://www.bilibili.com/video/BV..."
          />
        </Field>

        <div className="quick-mode-grid">
          {[
            ["video", "最高规格", "视频与音频自动合并"],
            ["video-only", "仅视频流", "不下载音频"],
            ["audio", "仅音频", "下载最高规格音频"],
            ["cover", "仅封面", "保存视频封面"],
            ["subtitle", "仅字幕", "保存可用字幕"],
            ["danmaku", "仅弹幕", "保存弹幕文件"],
            ["info", "查看信息", "仅解析而不下载"]
          ].map(([value, label, hint]) => (
            <button
              type="button"
              key={value}
              className={`mode-card ${options.mode === value ? "active" : ""}`}
              onClick={() => update("mode", value as BilibiliOptions["mode"])}
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
              <Field label="解析接口">
                <SelectInput
                  value={options.api}
                  onChange={(event) => update("api", event.target.value as BilibiliOptions["api"])}
                >
                  <option value="web">WEB</option>
                  <option value="tv">TV</option>
                  <option value="app">APP</option>
                  <option value="intl">国际版</option>
                </SelectInput>
              </Field>
              <Field label="选择分 P" hint="例如：1,2,5-10 或 ALL">
                <TextInput
                  value={options.pages}
                  onChange={(event) => update("pages", event.target.value)}
                  placeholder="ALL"
                />
              </Field>
              <Field label="编码优先级">
                <TextInput
                  value={options.encodingPriority}
                  onChange={(event) => update("encodingPriority", event.target.value)}
                />
              </Field>
              <Field label="画质优先级">
                <TextInput
                  value={options.qualityPriority}
                  onChange={(event) => update("qualityPriority", event.target.value)}
                  placeholder="8K 超高清,HDR 真彩,1080P 高码率"
                />
              </Field>
              <Field label="单 P 文件名模板">
                <TextInput
                  value={options.filePattern}
                  onChange={(event) => update("filePattern", event.target.value)}
                  placeholder="留空使用 BBDown 默认值"
                />
              </Field>
              <Field label="多 P 文件名模板">
                <TextInput
                  value={options.multiFilePattern}
                  onChange={(event) => update("multiFilePattern", event.target.value)}
                  placeholder="留空使用 BBDown 默认值"
                />
              </Field>
              <Field label="输出目录" hint="留空使用“设置与分发”中的默认下载目录。">
                <DirectoryInput
                  value={options.outputDirectory}
                  onChange={(value) => update("outputDirectory", value)}
                  placeholder={defaultOutputPlaceholder}
                />
              </Field>
              <Field label="混流音频语言" hint="ISO 639-2 代码，例如 chi、jpn。">
                <TextInput
                  value={options.language}
                  onChange={(e) => update("language", e.target.value)}
                />
              </Field>
              <Field label="User-Agent">
                <TextInput
                  value={options.userAgent}
                  onChange={(e) => update("userAgent", e.target.value)}
                />
              </Field>
              <Field label="Cookie" hint="可选，用于手动指定 BBDown 登录 Cookie。">
                <TextInput
                  type="password"
                  value={options.cookie}
                  onChange={(e) => update("cookie", e.target.value)}
                />
              </Field>
              <Field label="Access Token" hint="TV、APP 或 BiliPlus 接口所需。">
                <TextInput
                  type="password"
                  value={options.accessToken}
                  onChange={(e) => update("accessToken", e.target.value)}
                />
              </Field>
              <Field label="合集分 P 间隔（秒）">
                <TextInput
                  type="number"
                  min={0}
                  value={options.delayPerPage}
                  onChange={(e) => update("delayPerPage", e.target.value)}
                />
              </Field>
              <Field label="UPOS 服务器">
                <TextInput
                  value={options.uposHost}
                  onChange={(e) => update("uposHost", e.target.value)}
                />
              </Field>
              <Field label="aria2c 路径">
                <TextInput
                  value={options.aria2cPath}
                  onChange={(e) => update("aria2cPath", e.target.value)}
                />
              </Field>
              <Field label="aria2c 附加参数">
                <TextInput
                  value={options.aria2cArgs}
                  onChange={(e) => update("aria2cArgs", e.target.value)}
                />
              </Field>
              <Field label="MP4Box 路径">
                <TextInput
                  value={options.mp4boxPath}
                  onChange={(e) => update("mp4boxPath", e.target.value)}
                />
              </Field>
              <Field label="BBDown 配置文件">
                <TextInput
                  value={options.configFile}
                  onChange={(e) => update("configFile", e.target.value)}
                />
              </Field>
              <Field label="BiliPlus Host">
                <TextInput value={options.host} onChange={(e) => update("host", e.target.value)} />
              </Field>
              <Field label="BiliPlus EP Host">
                <TextInput
                  value={options.epHost}
                  onChange={(e) => update("epHost", e.target.value)}
                />
              </Field>
              <Field label="BiliPlus 地区">
                <SelectInput
                  value={options.area}
                  onChange={(e) => update("area", e.target.value as BilibiliOptions["area"])}
                >
                  <option value="">不指定</option>
                  <option value="hk">香港（hk）</option>
                  <option value="tw">台湾（tw）</option>
                  <option value="th">泰国（th）</option>
                </SelectInput>
              </Field>
            </div>
            <div className="toggle-grid">
              <Toggle
                checked={options.useMp4box}
                onChange={(v) => update("useMp4box", v)}
                label="使用 MP4Box 混流"
              />
              <Toggle
                checked={options.useAria2c}
                onChange={(v) => update("useAria2c", v)}
                label="使用 aria2c 下载"
              />
              <Toggle
                checked={options.showAll}
                onChange={(v) => update("showAll", v)}
                label="展示全部分 P"
              />
              <Toggle
                checked={options.hideStreams}
                onChange={(v) => update("hideStreams", v)}
                label="隐藏可用音视频流"
              />
              <Toggle
                checked={options.skipMux}
                onChange={(v) => update("skipMux", v)}
                label="跳过混流"
              />
              <Toggle
                checked={options.skipSubtitle}
                onChange={(v) => update("skipSubtitle", v)}
                label="跳过字幕"
              />
              <Toggle
                checked={options.skipCover}
                onChange={(v) => update("skipCover", v)}
                label="跳过封面"
              />
              <Toggle
                checked={options.skipAi}
                onChange={(v) => update("skipAi", v)}
                label="跳过 AI 字幕"
              />
              <Toggle
                checked={options.multiThread}
                onChange={(v) => update("multiThread", v)}
                label="显式启用多线程"
                hint="BBDown 默认已开启。"
              />
              <Toggle
                checked={options.forceHttp}
                onChange={(v) => update("forceHttp", v)}
                label="强制使用 HTTP"
                hint="BBDown 默认已开启。"
              />
              <Toggle
                checked={options.downloadDanmaku}
                onChange={(v) => update("downloadDanmaku", v)}
                label="随视频下载弹幕"
              />
              <Toggle
                checked={options.videoAscending}
                onChange={(v) => update("videoAscending", v)}
                label="视频最小体积优先"
              />
              <Toggle
                checked={options.audioAscending}
                onChange={(v) => update("audioAscending", v)}
                label="音频最小体积优先"
              />
              <Toggle
                checked={options.allowPcdn}
                onChange={(v) => update("allowPcdn", v)}
                label="允许 PCDN"
              />
              <Toggle
                checked={options.forceReplaceHost}
                onChange={(v) => update("forceReplaceHost", v)}
                label="强制替换下载 Host"
                hint="BBDown 默认已开启。"
              />
              <Toggle
                checked={options.saveArchive}
                onChange={(v) => update("saveArchive", v)}
                label="记录下载历史"
              />
              <Toggle
                checked={options.debug}
                onChange={(v) => update("debug", v)}
                label="调试日志"
              />
            </div>
            <Field
              label="其他参数（每行一个）"
              hint="临时兼容尚未列出的 BBDown 参数；不会经过 Shell 执行。"
            >
              <TextArea
                rows={4}
                value={options.extraArgs}
                onChange={(e) => update("extraArgs", e.target.value)}
                placeholder={"--example\nvalue"}
              />
            </Field>
          </div>
        )}
      </section>

      <CommandBar
        command={preview}
        onRun={() => void onRun({ tool: "bbdown", args })}
        disabled={!options.url.trim() || !bbdownAvailable}
        disabledReason="请填写链接"
      />
    </div>
  );
}
