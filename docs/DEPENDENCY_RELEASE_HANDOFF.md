# 独立依赖发布与 Toolbox 接入状态

更新日期：2026-10-03。

发布仓库：[MAD-Producer/mt_dependencies](https://github.com/MAD-Producer/mt_dependencies)。
正式发布契约、来源选择、workflow 与 OpenList 设置以该仓库的
[README](https://github.com/MAD-Producer/mt_dependencies/blob/main/README.md) 为准。

## 已落地的分工

- 依赖仓库获取正式上游发行文件，轻量校验后整理为 ZIP，通过 GitHub Release 发布。
- 每次公开 Release 包含 Windows x64、macOS arm64 的 Deno、MediaInfo CLI、FFmpeg、BBDown、yt-dlp，共十个 ZIP 和一个 `version.json`。
- FFmpeg 与 ffprobe 同包；Python 和 musicdl 继续由系统命令安装。
- Windows FFmpeg 使用 Gyan Release Full 静态构建；macOS 使用 Martin Riedl Release arm64。
- 无变化时跳过发布；有变化时复用其余工具的原 ZIP，保持最新 Release 资产完整。
- 草稿上传校验和公开发布通过 Release ID 处理，避免未创建 tag 时返回 404。
- Toolbox 的应用发行与依赖发行独立，不再提供 FULL/LITE 安装包。

## 固定下载入口

应用更新仍使用 `/sd/mt/latest.json`。
依赖存储单独挂载 `/mt_dependencies`，使用 GitHub Releases 驱动，关闭显示所有版本。
将整个挂载目录分享为固定 ID `mt_dependencies`，不设密码、有效期或访问次数限制。

```text
https://openlist.frameneo.com/@s/mt_dependencies
https://openlist.frameneo.com/sd/mt_dependencies/version.json
https://openlist.frameneo.com/sd/mt_dependencies/<fileName>
```

2026-10-03 已从该清单入口取得 HTTP 200 和有效 schema 1 JSON。
分享浏览入口不是应用下载接口；实际下载通过 `/sd/` 路径访问。

## Schema 1 与客户端约定

清单包含 `schemaVersion: 1`、`generatedAt` 和 `platforms`。
平台键为 `windows-x64` 与 `macos-arm64`，各自包含五个小写工具标识。
每个包提供上游版本 `version`、ZIP 基础文件名 `fileName`、最终 ZIP 的 `sha256`、
字节大小 `size`、工具到 ZIP 内相对路径的 `executables`。
`upstream` 和 `upstreamFingerprint` 供发布方记录来源，客户端忽略。

Toolbox 不假定程序位于 ZIP 根目录；例如 macOS MediaInfo 使用 `usr/local/bin/mediainfo`。
应用管理副本位于应用数据目录的 `dependencies/<tool>/`。
本地 `installation.json` 由 Toolbox 写入，不能包含在发行 ZIP 中。
更新按已安装的文件名和 SHA-256 比较，支持上游版本相同的包装修复。
`generatedAt` 不作为过期检查条件，不提供历史版本选择、回退或 TUF。

## 客户端行为与验证边界

Toolbox 已接入清单获取、平台选择、镜像安装按钮、下载进度、启动更新提醒和手动重新检测。
后端安装命令重新取得最新清单，使用已有代理设置下载，校验哈希、归档边界及必需文件，
随后替换应用管理目录。系统副本保持独立，系统工具不由 Toolbox 检测或执行升级。
镜像检查失败不影响已安装工具；用户仍可使用系统安装命令。

首次依赖发布的两平台打包已实测，完整草稿经校验后公开发布。
修复后的无变化分支和定时检查已成功；自动发布新批次还需下一次实际更新验证。
2026-10-03 Windows 后端已实测从分享下载约 4 MB 的 MediaInfo ZIP，验证哈希并在临时目录安装，
安装记录与当前清单匹配。Windows Rust 完整测试通过 23 项，另有一项默认忽略的实时 CDN 测试已单独通过；
TypeScript/i18n 检查通过；浏览器通过 Tauri mock
验证双来源入口、更新提示、进度切页保留、失败重试及清单失败恢复，覆盖 600/900/1280 宽度。
macOS 的实际运行、应用安装包构建以及用户环境中的完整交互验证仍须单独确认。
不要把公开 Release、清单可访问或局部测试通过表述为这些验证已经完成。
