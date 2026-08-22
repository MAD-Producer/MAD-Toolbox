import type { MusicdlPlaylistRequest, MusicdlSearchRequest } from "./api";
import type { MusicTemplateSource, SavedTemplate } from "./templates";

export type MusicMode = "search" | "playlist";

export interface MusicdlCliOptions {
  keyword: string;
  playlistUrl: string;
  musicSources: string[];
  initMusicClientsCfg: Record<string, unknown>;
  requestsOverrides: Record<string, unknown>;
  clientsThreadings: Record<string, unknown>;
  searchRules: Record<string, unknown>;
}

export interface MusicFormState extends MusicTemplateSource {
  keyword: string;
  playlistUrl: string;
}

export type MusicFormPatch = Partial<MusicFormState>;

export const DEFAULT_MUSIC_SOURCES = [
  "MiguMusicClient",
  "NeteaseMusicClient",
  "QQMusicClient",
  "KuwoMusicClient",
  "QianqianMusicClient"
] as const;

export const MUSIC_SOURCE_GROUPS: ReadonlyArray<
  readonly [string, ReadonlyArray<readonly [string, string]>]
> = [
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

export function createInitialMusicForm(): MusicFormState {
  return {
    mode: "search",
    keyword: "",
    playlistUrl: "",
    sources: [...DEFAULT_MUSIC_SOURCES],
    outputDirectory: "",
    searchSize: 5,
    threadCount: 5,
    proxy: "",
    cookies: "",
    rawInit: "{}",
    rawRequests: "{}",
    rawThreadings: "{}",
    rawSearchRules: "{}"
  };
}

function parseObject(text: string, label: string): Record<string, unknown> {
  const value = JSON.parse(text.trim() || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label}必须是 JSON 对象`);
  }
  return value as Record<string, unknown>;
}

function buildConfigs(
  form: MusicFormState,
  rawInit: Record<string, unknown>,
  rawRequests: Record<string, unknown>,
  rawThreadings: Record<string, unknown>
) {
  const init = structuredClone(rawInit);
  const requests = structuredClone(rawRequests);
  const threadings = structuredClone(rawThreadings);
  for (const source of form.sources) {
    const sourceInit =
      init[source] && typeof init[source] === "object" && !Array.isArray(init[source])
        ? { ...(init[source] as Record<string, unknown>) }
        : {};
    sourceInit.search_size_per_source = Math.max(1, form.searchSize || 1);
    if (form.outputDirectory.trim()) sourceInit.work_dir = form.outputDirectory.trim();
    if (form.cookies.trim()) {
      sourceInit.default_search_cookies = form.cookies.trim();
      sourceInit.default_download_cookies = form.cookies.trim();
      sourceInit.default_parse_cookies = form.cookies.trim();
    }
    init[source] = sourceInit;
    if (form.proxy.trim()) {
      const sourceRequests =
        requests[source] && typeof requests[source] === "object" && !Array.isArray(requests[source])
          ? { ...(requests[source] as Record<string, unknown>) }
          : {};
      sourceRequests.proxies = { http: form.proxy.trim(), https: form.proxy.trim() };
      requests[source] = sourceRequests;
    }
    threadings[source] = Math.max(1, form.threadCount || 1);
  }
  return { init, requests, threadings };
}

export type PreparedMusicConfiguration =
  { error: null; cli: MusicdlCliOptions } | { error: string; cli: null };

export function prepareMusicConfiguration(form: MusicFormState): PreparedMusicConfiguration {
  try {
    const configs = buildConfigs(
      form,
      parseObject(form.rawInit, "客户端设置"),
      parseObject(form.rawRequests, "请求设置"),
      parseObject(form.rawThreadings, "线程设置")
    );
    return {
      error: null,
      cli: {
        keyword: form.mode === "search" ? form.keyword : "",
        playlistUrl: form.mode === "playlist" ? form.playlistUrl : "",
        musicSources: form.sources,
        initMusicClientsCfg: configs.init,
        requestsOverrides: configs.requests,
        clientsThreadings: configs.threadings,
        searchRules: parseObject(form.rawSearchRules, "搜索规则")
      }
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), cli: null };
  }
}

export function createMusicSearchRequest(
  form: MusicFormState,
  cli: MusicdlCliOptions
): MusicdlSearchRequest {
  return {
    keyword: form.keyword,
    musicSources: form.sources,
    initMusicClientsCfg: cli.initMusicClientsCfg,
    requestsOverrides: cli.requestsOverrides,
    clientsThreadings: cli.clientsThreadings,
    searchRules: cli.searchRules,
    outputDirectory: form.outputDirectory || null,
    searchSizePerSource: Math.max(1, form.searchSize || 1)
  };
}

export function createMusicPlaylistRequest(
  form: MusicFormState,
  cli: MusicdlCliOptions,
  downsample: boolean
): MusicdlPlaylistRequest {
  return {
    playlistUrl: form.playlistUrl,
    musicSources: form.sources,
    initMusicClientsCfg: cli.initMusicClientsCfg,
    requestsOverrides: cli.requestsOverrides,
    clientsThreadings: cli.clientsThreadings,
    searchRules: cli.searchRules,
    outputDirectory: form.outputDirectory || null,
    downsample
  };
}

export function createMusicTemplateSource(form: MusicFormState): MusicTemplateSource {
  const { keyword: _keyword, playlistUrl: _playlistUrl, ...source } = form;
  return source;
}

export function applyMusicTemplate(form: MusicFormState, template: SavedTemplate): MusicFormState {
  return { ...form, ...template.value, sources: [...template.value.sources] };
}

export function musicSourceLabel(source: string): string {
  for (const [, entries] of MUSIC_SOURCE_GROUPS) {
    const match = entries.find(([value]) => value === source);
    if (match) return match[1];
  }
  return source.replace(/MusicClient$/, "");
}
