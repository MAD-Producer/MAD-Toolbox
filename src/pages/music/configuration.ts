import { t, type TranslationKey } from "../../locale";
import type { MusicdlPlaylistRequest, MusicdlSearchRequest } from "./api";

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

export interface MusicFormState {
  mode: MusicMode;
  keyword: string;
  playlistUrl: string;
  sources: string[];
  outputDirectory: string;
  searchSize: number;
  threadCount: number;
  proxy: string;
  cookiesFile: string;
  rawInit: string;
  rawRequests: string;
  rawThreadings: string;
  rawSearchRules: string;
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
  readonly [TranslationKey, ReadonlyArray<readonly [string, TranslationKey]>]
> = [
  [
    "music.sourceGroup.mainland",
    [
      ["MiguMusicClient", "music.source.migu"],
      ["NeteaseMusicClient", "music.source.netease"],
      ["QQMusicClient", "music.source.qq"],
      ["KuwoMusicClient", "music.source.kuwo"],
      ["QianqianMusicClient", "music.source.qianqian"],
      ["KugouMusicClient", "music.source.kugou"],
      ["BilibiliMusicClient", "music.source.bilibili"],
      ["BodianMusicClient", "music.source.bodian"],
      ["FiveSingMusicClient", "music.source.fivesing"],
      ["SodaMusicClient", "music.source.soda"],
      ["StreetVoiceMusicClient", "music.source.streetvoice"],
      ["MOOVMusicClient", "music.source.moov"]
    ]
  ],
  [
    "music.sourceGroup.overseas",
    [
      ["AppleMusicClient", "music.source.apple"],
      ["DeezerMusicClient", "music.source.deezer"],
      ["FMAMusicClient", "music.source.fma"],
      ["JamendoMusicClient", "music.source.jamendo"],
      ["JooxMusicClient", "music.source.joox"],
      ["JioSaavnMusicClient", "music.source.jiosaavn"],
      ["OpenGameArtMusicClient", "music.source.opengameart"],
      ["QobuzMusicClient", "music.source.qobuz"],
      ["SoundCloudMusicClient", "music.source.soundcloud"],
      ["SpotifyMusicClient", "music.source.spotify"],
      ["SunoMusicClient", "music.source.suno"],
      ["TIDALMusicClient", "music.source.tidal"],
      ["YouTubeMusicClient", "music.source.ytmusic"]
    ]
  ],
  [
    "music.sourceGroup.podcast",
    [
      ["ITunesMusicClient", "music.source.applePodcasts"],
      ["LizhiMusicClient", "music.source.lizhi"],
      ["LRTSMusicClient", "music.source.lrts"],
      ["QingtingMusicClient", "music.source.qingting"],
      ["XimalayaMusicClient", "music.source.ximalaya"]
    ]
  ],
  [
    "music.sourceGroup.aggregator",
    [
      ["GDStudioMusicClient", "music.source.gdstudio"],
      ["JBSouMusicClient", "music.source.jbsou"],
      ["MP3JuiceMusicClient", "music.source.mp3juice"],
      ["MyFreeMP3MusicClient", "music.source.myfreemp3"],
      ["TuneHubMusicClient", "music.source.tunehub"],
      ["XiaoBaiMusicClient", "music.source.xiaobai"]
    ]
  ],
  [
    "music.sourceGroup.thirdParty",
    [
      ["BuguyyMusicClient", "music.source.buguyy"],
      ["FangpiMusicClient", "music.source.fangpi"],
      ["FiveSongMusicClient", "music.source.fivesong"],
      ["FLMP3MusicClient", "music.source.flmp3"],
      ["GequbaoMusicClient", "music.source.gequbao"],
      ["GequhaiMusicClient", "music.source.gequhai"],
      ["HTQYYMusicClient", "music.source.htqyy"],
      ["ITingWaMusicClient", "music.source.itingwa"],
      ["KKWSMusicClient", "music.source.kkws"],
      ["LivePOOMusicClient", "music.source.livepoo"],
      ["LiziYYMusicClient", "music.source.liziyy"],
      ["MituMusicClient", "music.source.mitu"],
      ["MGMP3MusicClient", "music.source.mgmp3"],
      ["SgogoMusicClient", "music.source.sgogo"],
      ["TwoT58MusicClient", "music.source.twot58"],
      ["XiagebaMusicClient", "music.source.xiageba"],
      ["YinyuedaoMusicClient", "music.source.yinyuedao"],
      ["ZhuolinMusicClient", "music.source.zhuolin"]
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
    cookiesFile: "",
    rawInit: "{}",
    rawRequests: "{}",
    rawThreadings: "{}",
    rawSearchRules: "{}"
  };
}

function parseObject(text: string, label: string): Record<string, unknown> {
  const value = JSON.parse(text.trim() || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(t("music.json.objectError", { label }));
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
      parseObject(form.rawInit, t("music.json.init")),
      parseObject(form.rawRequests, t("music.json.requests")),
      parseObject(form.rawThreadings, t("music.json.threadings"))
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
        searchRules: parseObject(form.rawSearchRules, t("music.json.searchRules"))
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
    cookiesFile: form.cookiesFile.trim() || null,
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
    cookiesFile: form.cookiesFile.trim() || null,
    downsample
  };
}

export function musicSourceLabel(source: string): string {
  for (const [, entries] of MUSIC_SOURCE_GROUPS) {
    const match = entries.find(([value]) => value === source);
    if (match) return t(match[1]);
  }
  return source.replace(/MusicClient$/, "");
}
