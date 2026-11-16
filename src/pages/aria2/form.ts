/** 下载类型切换是独立表单字段：不能从 torrentFile 是否为空派生（空值时切不动）。
 * 提交时只携带活动来源的源字段——后端 torrentFile 优先于 uri，混发残留值会改写语义。 */
export type Aria2SourceKind = "uri" | "torrent";

export interface Aria2FormState {
  source: Aria2SourceKind;
  uri: string;
  torrentFile: string;
  outputDirectory: string;
  allProxy: string;
  maxOverallDownloadLimit: string;
  maxDownloadLimit: string;
  maxOverallUploadLimit: string;
  userAgent: string;
  referer: string;
  header: string;
  cookiesFile: string;
  split: number;
  maxConnectionPerServer: number;
  ptMode: boolean;
  injectTrackers: boolean;
  dht: boolean;
  peerExchange: boolean;
  lpd: boolean;
  btMaxPeers: number;
  seedAfterDownload: boolean;
  seedRatio: number;
  seedTimeMinutes: number;
}

export const defaultAria2Form: Aria2FormState = {
  source: "uri",
  uri: "",
  torrentFile: "",
  outputDirectory: "",
  allProxy: "",
  maxOverallDownloadLimit: "",
  maxDownloadLimit: "",
  maxOverallUploadLimit: "",
  userAgent: "",
  referer: "",
  header: "",
  cookiesFile: "",
  split: 16,
  maxConnectionPerServer: 16,
  ptMode: false,
  injectTrackers: true,
  dht: true,
  peerExchange: true,
  lpd: false,
  btMaxPeers: 200,
  seedAfterDownload: false,
  seedRatio: 1,
  seedTimeMinutes: 0
};
