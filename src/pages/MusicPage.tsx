import {
  Check,
  Copy,
  Disc3,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Square,
  SquareCheckBig,
  TriangleAlert
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { buildMusicdlArgs, commandPreview, type MusicdlCliOptions } from "../lib/commands";
import type {
  DependencyStatus,
  MusicdlSearchRequest,
  MusicdlSearchResponse,
  MusicdlSearchResult,
  RunResult,
  JobState,
  MusicdlPlaylistRequest
} from "../lib/types";
import { CommandBar } from "../components/CommandBar";
import { DirectoryInput } from "../components/DirectoryInput";
import { Field, TextArea, TextInput } from "../components/Field";
import { TemplateManager } from "../components/TemplateManager";
import { isWindows, musicdlInstallCommand, pipCommand } from "../lib/platform";

interface MusicPageProps {
  dependency: DependencyStatus | null;
  pythonDependency: DependencyStatus | null;
  defaultOutputDirectory: string | null;
  onRefresh: () => Promise<unknown>;
  onSearch: (request: MusicdlSearchRequest) => Promise<RunResult>;
  onPlaylist: (request: MusicdlPlaylistRequest) => Promise<RunResult>;
  onDownload: (sessionId: string, indices: number[]) => Promise<unknown>;
}

const DEFAULT_SOURCES = [
  "MiguMusicClient",
  "NeteaseMusicClient",
  "QQMusicClient",
  "KuwoMusicClient",
  "QianqianMusicClient"
];

const SOURCE_GROUPS: Array<[string, Array<[string, string]>]> = [
  [
    "中国大陆及华语平台",
    [
      ["MiguMusicClient", "咪咕音乐"],
      ["NeteaseMusicClient", "网易云音乐"],
      ["QQMusicClient", "QQ 音乐"],
      ["KuwoMusicClient", "酷我音乐"],
      ["QianqianMusicClient", "千千音乐"],
      ["KugouMusicClient", "酷狗音乐"],
      ["BilibiliMusicClient", "哔哩哔哩音乐"],
      ["BodianMusicClient", "波点音乐"],
      ["FiveSingMusicClient", "5SING"],
      ["SodaMusicClient", "汽水音乐"],
      ["StreetVoiceMusicClient", "街声"],
      ["MOOVMusicClient", "MOOV"]
    ]
  ],
  [
    "海外流媒体与独立音乐",
    [
      ["AppleMusicClient", "Apple Music"],
      ["DeezerMusicClient", "Deezer"],
      ["FMAMusicClient", "Free Music Archive"],
      ["JamendoMusicClient", "Jamendo"],
      ["JooxMusicClient", "JOOX"],
      ["JioSaavnMusicClient", "JioSaavn"],
      ["OpenGameArtMusicClient", "OpenGameArt"],
      ["QobuzMusicClient", "Qobuz"],
      ["SoundCloudMusicClient", "SoundCloud"],
      ["SpotifyMusicClient", "Spotify"],
      ["SunoMusicClient", "Suno"],
      ["TIDALMusicClient", "TIDAL"],
      ["YouTubeMusicClient", "YouTube Music"]
    ]
  ],
  [
    "播客、有声与电台",
    [
      ["ITunesMusicClient", "Apple Podcasts"],
      ["LizhiMusicClient", "荔枝 FM"],
      ["LRTSMusicClient", "懒人听书"],
      ["QingtingMusicClient", "蜻蜓 FM"],
      ["XimalayaMusicClient", "喜马拉雅"]
    ]
  ],
  [
    "聚合音乐源",
    [
      ["GDStudioMusicClient", "GD 音乐台"],
      ["JBSouMusicClient", "煎饼搜"],
      ["MP3JuiceMusicClient", "MP3 Juice"],
      ["MyFreeMP3MusicClient", "MyFreeMP3"],
      ["TuneHubMusicClient", "TuneHub"],
      ["XiaoBaiMusicClient", "小白音乐"]
    ]
  ],
  [
    "其他第三方音乐站",
    [
      ["BuguyyMusicClient", "布谷音乐"],
      ["FangpiMusicClient", "放屁音乐"],
      ["FiveSongMusicClient", "5Song"],
      ["FLMP3MusicClient", "凤梨音乐"],
      ["GequbaoMusicClient", "歌曲宝"],
      ["GequhaiMusicClient", "歌曲海"],
      ["HTQYYMusicClient", "好听轻音乐网"],
      ["ITingWaMusicClient", "听蛙"],
      ["KKWSMusicClient", "开开无损"],
      ["LivePOOMusicClient", "力音"],
      ["LiziYYMusicClient", "梨子音乐"],
      ["MituMusicClient", "米兔音乐"],
      ["MGMP3MusicClient", "木瓜音乐"],
      ["SgogoMusicClient", "搜歌网"],
      ["TwoT58MusicClient", "爱听音乐网"],
      ["XiagebaMusicClient", "下歌吧"],
      ["YinyuedaoMusicClient", "音乐岛"],
      ["ZhuolinMusicClient", "卓林音乐"]
    ]
  ]
];

const INSTALL_COMMAND = musicdlInstallCommand;
const UPGRADE_COMMAND = "pipx upgrade musicdl";
const PIP_MIRRORS = [
  {
    id: "ustc",
    name: "USTC 中国科学技术大学",
    url: "https://mirrors.ustc.edu.cn/pypi/simple",
    help: "https://mirrors.ustc.edu.cn/help/pypi.html"
  },
  {
    id: "tuna",
    name: "TUNA 清华大学",
    url: "https://pypi.tuna.tsinghua.edu.cn/simple",
    help: "https://mirrors.tuna.tsinghua.edu.cn/help/pypi/"
  }
] as const;
const RESET_PIP_MIRROR = `${pipCommand} config unset global.index-url`;

function parseObject(text: string, label: string): Record<string, unknown> {
  const value = JSON.parse(text.trim() || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label}必须是 JSON 对象`);
  }
  return value as Record<string, unknown>;
}

function mergedObject(value: Record<string, unknown>) {
  return structuredClone(value);
}

function buildConfigs(
  sources: string[],
  rawInit: Record<string, unknown>,
  rawRequests: Record<string, unknown>,
  rawThreadings: Record<string, unknown>,
  outputDirectory: string,
  searchSize: number,
  threadCount: number,
  proxy: string,
  cookies: string
) {
  const init = mergedObject(rawInit);
  const requests = mergedObject(rawRequests);
  const threadings = mergedObject(rawThreadings);
  for (const source of sources) {
    const sourceInit =
      init[source] && typeof init[source] === "object" && !Array.isArray(init[source])
        ? ({ ...(init[source] as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    sourceInit.search_size_per_source = searchSize;
    if (outputDirectory.trim()) sourceInit.work_dir = outputDirectory.trim();
    if (cookies.trim()) {
      sourceInit.default_search_cookies = cookies.trim();
      sourceInit.default_download_cookies = cookies.trim();
      sourceInit.default_parse_cookies = cookies.trim();
    }
    init[source] = sourceInit;
    if (proxy.trim()) {
      const sourceRequests =
        requests[source] && typeof requests[source] === "object" && !Array.isArray(requests[source])
          ? ({ ...(requests[source] as Record<string, unknown>) } as Record<string, unknown>)
          : {};
      sourceRequests.proxies = { http: proxy.trim(), https: proxy.trim() };
      requests[source] = sourceRequests;
    }
    threadings[source] = threadCount;
  }
  return { init, requests, threadings };
}

function sourceLabel(source: string) {
  for (const [, entries] of SOURCE_GROUPS) {
    const match = entries.find(([value]) => value === source);
    if (match) return match[1];
  }
  return source.replace(/MusicClient$/, "");
}

export function MusicPage({
  dependency,
  pythonDependency,
  defaultOutputDirectory,
  onRefresh,
  onSearch,
  onPlaylist,
  onDownload
}: MusicPageProps) {
  const [mode, setMode] = useState<"search" | "playlist">("search");
  const [keyword, setKeyword] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);
  const [outputDirectory, setOutputDirectory] = useState("");
  const [searchSize, setSearchSize] = useState(5);
  const [threadCount, setThreadCount] = useState(5);
  const [proxy, setProxy] = useState("");
  const [cookies, setCookies] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [allSources, setAllSources] = useState(false);
  const [rawInit, setRawInit] = useState("{}");
  const [rawRequests, setRawRequests] = useState("{}");
  const [rawThreadings, setRawThreadings] = useState("{}");
  const [rawSearchRules, setRawSearchRules] = useState("{}");
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "downloading">("idle");
  const [searchResponse, setSearchResponse] = useState<MusicdlSearchResponse | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [mirrorCopyState, setMirrorCopyState] = useState<string | null>(null);
  const activeSearchJobId = useRef<string | null>(null);
  const settledSearchJobId = useRef<string | null>(null);
  const templateOptions = useMemo(
    () => ({
      mode,
      sources,
      outputDirectory,
      searchSize,
      threadCount,
      proxy,
      cookies,
      rawInit,
      rawRequests,
      rawThreadings,
      rawSearchRules
    }),
    [
      mode,
      cookies,
      outputDirectory,
      proxy,
      rawInit,
      rawRequests,
      rawSearchRules,
      rawThreadings,
      searchSize,
      sources,
      threadCount
    ]
  );

  useEffect(() => {
    if (defaultOutputDirectory) {
      setOutputDirectory((current) => current.trim() || defaultOutputDirectory);
    }
  }, [defaultOutputDirectory]);

  useEffect(() => {
    const unlistenResult = listen<MusicdlSearchResponse>("musicdl-search-result", ({ payload }) => {
      if (activeSearchJobId.current && payload.sessionId !== activeSearchJobId.current) {
        return;
      }
      activeSearchJobId.current = payload.sessionId;
      setSearchResponse(payload);
      setSelected([]);
      setConfigurationError(null);
    });
    const unlistenState = listen<JobState>("job-state", ({ payload }) => {
      if (payload.jobId !== activeSearchJobId.current) return;
      if (payload.state === "running") return;
      setSearchState("idle");
      if (payload.state === "failed" || payload.state === "cancelled") {
        setConfigurationError(payload.message);
      }
      settledSearchJobId.current = payload.jobId;
      activeSearchJobId.current = null;
    });
    return () => {
      void unlistenResult.then((dispose) => dispose());
      void unlistenState.then((dispose) => dispose());
    };
  }, []);

  const prepared = useMemo(() => {
    try {
      const parsedInit = parseObject(rawInit, "客户端设置");
      const parsedRequests = parseObject(rawRequests, "请求设置");
      const parsedThreadings = parseObject(rawThreadings, "线程设置");
      const searchRules = parseObject(rawSearchRules, "搜索规则");
      const configs = buildConfigs(
        sources,
        parsedInit,
        parsedRequests,
        parsedThreadings,
        outputDirectory,
        Math.max(1, searchSize || 1),
        Math.max(1, threadCount || 1),
        proxy,
        cookies
      );
      return {
        error: null,
        cli: {
          keyword: mode === "search" ? keyword : "",
          playlistUrl: mode === "playlist" ? playlistUrl : "",
          musicSources: sources,
          initMusicClientsCfg: configs.init,
          requestsOverrides: configs.requests,
          clientsThreadings: configs.threadings,
          searchRules
        } satisfies MusicdlCliOptions
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        cli: null
      };
    }
  }, [
    cookies,
    keyword,
    mode,
    outputDirectory,
    playlistUrl,
    proxy,
    rawInit,
    rawRequests,
    rawSearchRules,
    rawThreadings,
    searchSize,
    sources,
    threadCount
  ]);

  const args = prepared.cli ? buildMusicdlArgs(prepared.cli) : [];
  const preview = prepared.cli ? commandPreview("musicdl", args) : "";
  const musicdlInstalled = dependency?.available ?? false;
  const pythonInstalled = pythonDependency?.available ?? false;
  const installed = musicdlInstalled && pythonInstalled;

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  const copyMirrorCommand = async (id: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setMirrorCopyState(id);
    } catch {
      setMirrorCopyState(`${id}-failed`);
    }
    window.setTimeout(() => setMirrorCopyState(null), 1800);
  };

  const toggleSource = (source: string) => {
    setSources((current) =>
      current.includes(source) ? current.filter((value) => value !== source) : [...current, source]
    );
    setSearchResponse(null);
    setSelected([]);
  };

  const run = async () => {
    setConfigurationError(prepared.error);
    if (!prepared.cli || prepared.error) return;
    if (mode === "playlist") {
      setSearchState("downloading");
      setConfigurationError(null);
      settledSearchJobId.current = null;
      try {
        const started = await onPlaylist({
          playlistUrl,
          musicSources: sources,
          initMusicClientsCfg: prepared.cli.initMusicClientsCfg,
          requestsOverrides: prepared.cli.requestsOverrides,
          clientsThreadings: prepared.cli.clientsThreadings,
          searchRules: prepared.cli.searchRules,
          outputDirectory: outputDirectory || null
        });
        if (settledSearchJobId.current !== started.jobId) {
          activeSearchJobId.current = started.jobId;
        }
      } catch (error) {
        setConfigurationError(error instanceof Error ? error.message : String(error));
        setSearchState("idle");
      }
      return;
    }
    setSearchState("searching");
    setSearchResponse(null);
    setSelected([]);
    setConfigurationError(null);
    settledSearchJobId.current = null;
    try {
      const started = await onSearch({
        keyword,
        musicSources: sources,
        initMusicClientsCfg: prepared.cli.initMusicClientsCfg,
        requestsOverrides: prepared.cli.requestsOverrides,
        clientsThreadings: prepared.cli.clientsThreadings,
        searchRules: prepared.cli.searchRules,
        outputDirectory: outputDirectory || null,
        searchSizePerSource: Math.max(1, searchSize || 1)
      });
      if (settledSearchJobId.current !== started.jobId) {
        activeSearchJobId.current = started.jobId;
      }
    } catch (error) {
      setConfigurationError(error instanceof Error ? error.message : String(error));
      setSearchState("idle");
    }
  };

  const downloadSelected = async () => {
    if (!searchResponse || !selected.length) return;
    setSearchState("downloading");
    try {
      await onDownload(searchResponse.sessionId, selected);
    } finally {
      setSearchState("idle");
    }
  };

  const selectLossless = (results: MusicdlSearchResult[]) => {
    setSelected(results.filter((result) => result.lossless).map((result) => result.index));
  };

  if (!installed) {
    return (
      <div className="page">
        <div className="page-title">
          <div>
            <span className="eyebrow">OPTIONAL EXTERNAL DEPENDENCY</span>
            <h1>音乐下载</h1>
            <p>安装 Python 3 与 musicdl 后启用；两者不会包含在 MAD Toolbox 安装包中。</p>
          </div>
        </div>
        <section className="music-install-card">
          <TriangleAlert size={24} />
          <div>
            <h2>{!pythonInstalled ? "尚未检测到 Python 3" : "尚未检测到 musicdl"}</h2>
            <p>
              musicdl 需要 Python 3。推荐通过{isWindows ? " winget" : " Homebrew"}安装
              Python，并使用 pipx 创建隔离环境，避免修改系统 Python。
            </p>
            <div className="music-requirement-list">
              <span className={pythonInstalled ? "ok" : "missing"}>
                {pythonInstalled ? <Check size={13} /> : <TriangleAlert size={13} />}
                Python 3<small>{pythonDependency?.version || "需要安装"}</small>
              </span>
              <span className={musicdlInstalled ? "ok" : "missing"}>
                {musicdlInstalled ? <Check size={13} /> : <TriangleAlert size={13} />}
                musicdl
                <small>{dependency?.version || "需要安装"}</small>
              </span>
            </div>
            <code>{INSTALL_COMMAND}</code>
            <span>安装后如果当前页面仍未启用，请退出并重新打开 MAD Toolbox。</span>
          </div>
          <div className="music-install-actions">
            {copyState !== "idle" && (
              <span className={`copy-feedback ${copyState}`} role="status">
                {copyState === "copied" ? "已复制" : "复制失败"}
              </span>
            )}
            <button className="secondary-button" type="button" onClick={() => void copyInstall()}>
              {copyState === "copied" ? <Check size={15} /> : <Copy size={15} />}
              复制安装命令
            </button>
            <button className="primary-button" type="button" onClick={() => void onRefresh()}>
              <RefreshCw size={15} />
              重新检测
            </button>
          </div>
        </section>
        <section className="music-mirror-guide">
          <header>
            <div>
              <h2>中国大陆网络：配置 pip 镜像</h2>
              <p>
                如果 PyPI 下载缓慢，可先选择一个镜像并执行配置命令，再运行上面的 pipx
                安装命令。只需选择一个镜像。
              </p>
            </div>
          </header>
          <div className="pip-mirror-grid">
            {PIP_MIRRORS.map((mirror) => {
              const command = `${pipCommand} config set global.index-url ${mirror.url}`;
              const copied = mirrorCopyState === mirror.id;
              const failed = mirrorCopyState === `${mirror.id}-failed`;
              return (
                <article key={mirror.id}>
                  <strong>{mirror.name}</strong>
                  <code>{command}</code>
                  <div>
                    {(copied || failed) && (
                      <span className={`copy-feedback ${failed ? "failed" : "copied"}`}>
                        {failed ? "复制失败" : "已复制"}
                      </span>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void copyMirrorCommand(mirror.id, command)}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      复制命令
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      title="查看镜像站官方帮助"
                      onClick={() => void openUrl(mirror.help)}
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="pip-reset-row">
            <span>
              恢复 PyPI 官方源：
              <code>{RESET_PIP_MIRROR}</code>
            </span>
            {mirrorCopyState === "reset-failed" && (
              <span className="copy-feedback failed" role="status">
                复制失败
              </span>
            )}
            <button
              className="secondary-button"
              type="button"
              onClick={() => void copyMirrorCommand("reset", RESET_PIP_MIRROR)}
            >
              {mirrorCopyState === "reset" ? <Check size={14} /> : <Copy size={14} />}
              {mirrorCopyState === "reset" ? "已复制" : "复制恢复命令"}
            </button>
          </div>
          <p className="pip-mirror-note">
            该设置写入当前用户的 pip 配置，并会影响之后的 pip/pipx 下载；不会修改 musicdl 或 MAD
            Toolbox 本身。
          </p>
        </section>
        <section className="notice info">
          <ExternalLink size={18} />
          <div>
            <strong>许可证与分发说明</strong>
            <p>
              musicdl 使用 PolyForm Noncommercial
              1.0.0，并禁止未经许可的捆绑分发，因此这里只调用用户自行安装的副本。
            </p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void openUrl("https://github.com/CharlesPikachu/musicdl")}
          >
            查看项目
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">MUSICDL · EXTERNAL</span>
          <h1>音乐下载</h1>
          <p>搜索音乐后在 GUI 中选择下载项，或直接解析受支持平台的歌单链接。</p>
        </div>
        <div className="dependency-inline-status">
          <Check size={14} />
          {dependency?.version || "musicdl 已安装"} · {pythonDependency?.version || "Python 3"}
        </div>
      </div>

      <TemplateManager
        featureKey="music"
        value={templateOptions}
        onApply={(template) => {
          setMode(template.mode);
          setSources(template.sources);
          setOutputDirectory(template.outputDirectory);
          setSearchSize(template.searchSize);
          setThreadCount(template.threadCount);
          setProxy(template.proxy);
          setCookies(template.cookies ?? "");
          setRawInit(template.rawInit);
          setRawRequests(template.rawRequests);
          setRawThreadings(template.rawThreadings);
          setRawSearchRules(template.rawSearchRules);
          setConfigurationError(null);
        }}
      />

      <section className="tool-panel">
        <div className="quick-mode-grid two-columns">
          <button
            type="button"
            className={`mode-card ${mode === "search" ? "active" : ""}`}
            onClick={() => setMode("search")}
          >
            <Search size={17} />
            <strong>搜索音乐</strong>
            <small>按歌曲、歌手或专辑搜索并选择结果</small>
          </button>
          <button
            type="button"
            className={`mode-card ${mode === "playlist" ? "active" : ""}`}
            onClick={() => setMode("playlist")}
          >
            <Disc3 size={17} />
            <strong>下载歌单</strong>
            <small>解析链接并下载识别到的全部项目</small>
          </button>
        </div>

        {mode === "search" ? (
          <Field label="搜索关键词">
            <TextInput
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="歌曲、歌手或专辑"
            />
          </Field>
        ) : (
          <Field label="歌单链接" hint="链接必须由所选 musicdl 客户端支持。">
            <TextInput
              value={playlistUrl}
              onChange={(event) => setPlaylistUrl(event.target.value)}
              placeholder="https://music.163.com/#/playlist?id=..."
            />
          </Field>
        )}

        <div className="form-grid">
          <Field label="下载目录" hint="留空默认保存到“下载/MAD Toolbox/Music”。">
            <DirectoryInput value={outputDirectory} onChange={setOutputDirectory} />
          </Field>
          <Field label="每个音乐源的搜索结果数">
            <TextInput
              type="number"
              min={1}
              max={100}
              value={searchSize}
              onChange={(event) => setSearchSize(Number(event.target.value))}
            />
          </Field>
          <Field label="每个音乐源的线程数">
            <TextInput
              type="number"
              min={1}
              max={50}
              value={threadCount}
              onChange={(event) => setThreadCount(Number(event.target.value))}
            />
          </Field>
          <Field label="代理服务器" hint="留空使用直连或代理软件的全局代理。">
            <TextInput
              value={proxy}
              onChange={(event) => setProxy(event.target.value)}
              placeholder="http://127.0.0.1:7890"
            />
          </Field>
        </div>
        <Field
          label="登录 Cookie（可选）"
          hint="应用到当前选择的全部音乐源；会员音质和受限内容取决于对应平台账户权限。"
        >
          <TextArea
            value={cookies}
            onChange={(event) => setCookies(event.target.value)}
            placeholder="从对应平台已登录的网页会话中获取；请妥善保管。"
          />
        </Field>

        <div className="music-source-heading">
          <div>
            <strong>音乐源</strong>
            <span>已选择 {sources.length} 个；同时搜索过多音乐源会明显变慢并产生重复结果。</span>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setSources(DEFAULT_SOURCES)}
          >
            恢复默认
          </button>
        </div>
        <div className="music-source-grid">
          {SOURCE_GROUPS[0][1].map(([source, label]) => (
            <button
              type="button"
              className={sources.includes(source) ? "active" : ""}
              onClick={() => toggleSource(source)}
              key={source}
            >
              {sources.includes(source) ? <SquareCheckBig size={14} /> : <Square size={14} />}
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          className="advanced-toggle"
          type="button"
          onClick={() => setAllSources(!allSources)}
        >
          {allSources ? "收起全部音乐源" : "显示全部音乐源"}
        </button>
        {allSources && (
          <div className="all-music-sources">
            {SOURCE_GROUPS.slice(1).map(([group, entries]) => (
              <section key={group}>
                <h3>{group}</h3>
                <div className="music-source-grid">
                  {entries.map(([source, label]) => (
                    <button
                      type="button"
                      className={sources.includes(source) ? "active" : ""}
                      onClick={() => toggleSource(source)}
                      key={source}
                    >
                      {sources.includes(source) ? (
                        <SquareCheckBig size={14} />
                      ) : (
                        <Square size={14} />
                      )}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <button className="advanced-toggle" type="button" onClick={() => setAdvanced(!advanced)}>
          {advanced ? "收起完整参数" : "展开完整参数"}
        </button>
        {advanced && (
          <div className="advanced-panel">
            <p className="advanced-description">
              以下四项对应 musicdl 的全部高级 CLI
              参数；页面上方的目录、Cookie、代理、结果数和线程数会与 JSON 合并。
            </p>
            <div className="form-grid">
              <Field label="-i 客户端初始化设置（JSON）">
                <TextArea value={rawInit} onChange={(event) => setRawInit(event.target.value)} />
              </Field>
              <Field label="-r 请求覆盖设置（JSON）">
                <TextArea
                  value={rawRequests}
                  onChange={(event) => setRawRequests(event.target.value)}
                />
              </Field>
              <Field label="-c 客户端线程设置（JSON）">
                <TextArea
                  value={rawThreadings}
                  onChange={(event) => setRawThreadings(event.target.value)}
                />
              </Field>
              <Field label="-s 搜索规则（JSON）">
                <TextArea
                  value={rawSearchRules}
                  onChange={(event) => setRawSearchRules(event.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
      </section>

      {(configurationError || prepared.error) && (
        <div className="notice warning">
          <TriangleAlert size={18} />
          <div>
            <strong>参数或执行错误</strong>
            <p>{configurationError || prepared.error}</p>
          </div>
        </div>
      )}

      <CommandBar
        command={preview}
        onRun={() => void run()}
        disabled={
          searchState !== "idle" ||
          sources.length === 0 ||
          !!prepared.error ||
          (mode === "search" ? !keyword.trim() : !playlistUrl.trim())
        }
        disabledReason={
          searchState === "searching"
            ? "正在搜索"
            : sources.length === 0
              ? "请至少选择一个音乐源"
              : mode === "search"
                ? "请填写搜索关键词"
                : "请填写歌单链接"
        }
      />

      {searchState === "searching" && (
        <div className="music-searching">
          <RefreshCw className="spin" size={18} />
          正在通过 {sources.length} 个音乐源搜索……
        </div>
      )}

      {searchResponse && (
        <section className="music-results-panel">
          <div className="music-results-toolbar">
            <div>
              <h2>搜索结果</h2>
              <span>
                {searchResponse.results.length} 项 · 已选择 {selected.length} 项
              </span>
            </div>
            <div>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setSelected(
                    selected.length === searchResponse.results.length
                      ? []
                      : searchResponse.results.map((result) => result.index)
                  )
                }
              >
                {selected.length === searchResponse.results.length ? "取消全选" : "全选"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => selectLossless(searchResponse.results)}
              >
                只选无损
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={!selected.length || searchState === "downloading"}
                onClick={() => void downloadSelected()}
              >
                <Download size={15} />
                {searchState === "downloading" ? "启动中" : "下载所选"}
              </button>
            </div>
          </div>
          <div className="music-result-list">
            {searchResponse.results.map((result) => {
              const checked = selected.includes(result.index);
              return (
                <button
                  type="button"
                  className={`music-result-row ${checked ? "active" : ""}`}
                  onClick={() =>
                    setSelected((current) =>
                      checked
                        ? current.filter((index) => index !== result.index)
                        : [...current, result.index]
                    )
                  }
                  key={`${result.source}-${result.index}`}
                >
                  {checked ? <SquareCheckBig size={17} /> : <Square size={17} />}
                  <span className="music-result-main">
                    <strong>{result.songName}</strong>
                    <small>
                      {result.singers}
                      {result.album ? ` · ${result.album}` : ""}
                    </small>
                  </span>
                  <span className={`quality-pill ${result.lossless ? "lossless" : ""}`}>
                    {result.extension || result.codec || "未知格式"}
                    {result.bitrate ? ` · ${Math.round(result.bitrate / 1000)} kbps` : ""}
                  </span>
                  <span className="music-result-meta">
                    <strong>{sourceLabel(result.source)}</strong>
                    <small>{[result.fileSize, result.duration].filter(Boolean).join(" · ")}</small>
                  </span>
                </button>
              );
            })}
            {searchResponse.results.length === 0 && (
              <div className="empty-state">没有找到音乐，请更换关键词、音乐源或登录 Cookie。</div>
            )}
          </div>
        </section>
      )}

      <section className="music-runtime-note">
        <span>
          外部依赖：musicdl {dependency?.path} · Python {pythonDependency?.path}
        </span>
        <code>{UPGRADE_COMMAND}</code>
        <button
          className="icon-button"
          type="button"
          title="查看 musicdl 项目"
          onClick={() => void openUrl("https://github.com/CharlesPikachu/musicdl")}
        >
          <ExternalLink size={14} />
        </button>
      </section>
    </div>
  );
}
