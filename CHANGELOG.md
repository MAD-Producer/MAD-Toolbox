# Changelog

All notable changes to MAD Toolbox are documented here.

## 1.2.1

- feat: BBDown登录状态支持主动注销
- fix: 显示指定 cookie 文件路径来绕过现代浏览器防护功能

## 1.2.0

- feat: 全新的UI前端设计，让更多用户快速聚焦于目标
- feat: app全局的样式更统一
- feat: 首页新增下载图标，当存在新版本时会显示在首页设置图标右边
- fix: 修复了手动检测到更新时切换页面可更新状态消失的问题
- fix: 将BilibiliPage的可选画质选项变为下拉菜单，避免用户输入无法被解析
- feat: Bilibili 已登录按钮支持清除本机 BBDown 登录状态
- delete: BilibiliPage高级设置中去掉了长尾参数的选项

## 1.1.0

- feat: 新增应用内下载功能，支持GitHub和MAD Producer双源下载
- fix: 修复了提交任务后页面参数全部恢复默认值的问题

## 1.0.1

- fix: 修复了Music Page音乐源右侧 `{count}` 等变量未解析的问题
- fix: 修复了英文版启动提示的文本被截断的问题
- fix: 修复了About页面Website链接指向GitHub仓库的问题
- fix: 修复了调用底层工具时路径出现”nul byte"的问题
- fix: 修复FFmpeg依赖不固定问题

## 1.0.0

- feat: 增加了音乐下载的“自动去杂”功能，能够对部分假无损音乐进行降频处理，减小文件体积
- feat: 任务卡片增加“复用此配置”选项，可以快捷复用任务配置。同时移除了模板功能
- feat：完成i18n，支持简中和英文两种语言
- feat: 下载任务卡片显示更加简洁，对于B站和YouTube，会直接显示视频唯一标识 id
- feat: 关于页面焕然一新！
- fix: 修复了输入参数时命令预览的高度抖动问题

## 0.10.1

- refactor: 颜色方案集中到语义 token 层（src/styles/tokens.css），亮暗取值成对管理
- feat: 黑夜模式全面适配，配色方案更饱满！
- fix: 进一步优化了前端界面的展示

## 0.10.0

- feat: 重新设计了界面布局，UI/UX更加现代化！
- feat: 通知条加入了倒计时条功能
- feat: 首次进入提示卡片新增Bilibili下载视频功能提醒
- feat: 更好的黑夜模式，优化了配色方案，并支持改变原生标题颜色
- fix: 某些依赖（FFmpeg）一键下载后重新检测无法更新
- fix: Bilibili Page 扫码登录后状态未更新
- fix: 输入目录的可点击ICON单独出来作为尾部动作按钮，提示用户可点击选择
- fix: 默认主题设置为"light"，视觉体验初印象更好

## 0.9.1

- feat: 任务通知卡片显示位置在左下角
- feat: 增加首屏加载动画
- feat: 增加首次进入app时Modal提示
- fix: 更正 MediaInfo 的安装指令
- fix: 禁止app界面过度滚动

## 0.9.0

- 🔥feat: 增加了 Music 搜索结果页文件格式过滤功能
- 🐛fix: 全局代理无法起效且feature page的代理提示文字无法及时更新

## 0.8.0

- 🔥feat: 增加了一键下载依赖缺失功能

## 0.7.2

- 🐛fix: BBDown Login Modal关闭后界面无响应
- 🫟chore: Replace the taskPage Icon

## 0.7.1

- 🐛fix: 修复任务卡片删除按钮无响应
- 🐛fix: 修复打开输出文件目录在父级文件夹的位置
- 🐛fix: 修复路径名或任务名过长时标签被压缩的视觉问题
- 🔥feat: 美化settings页面，将开发团队信息加入
- 🔥feat: 上方导航栏加入了点击动画

## 0.7.0

＞＞＞ Refactor Plan [#14](https://github.com/MAD-Producer/MAD-Toolbox/issues/14) [#23](https://github.com/MAD-Producer/MAD-Toolbox/issues/23)

- 🔥feat: 全面重新设计了app界面，整体采用 水平导航栏样式，为 workspace 空出更多空间。
- 🔥feat: 采用 Mantine UI 库取代了原来的 TailwindCSS 样式，整体风格更统一。
- 🔥feat: 重新设计每个feature界面的容器层次与布局，更利于视觉聚焦和交互引导
- 🔥feat: 重新设计了Task卡片样式，支持折叠查看指令，打开日志，打开输出位置
- 🔥feat: 支持资源池显示，更好适配本地电脑配置
- 🔥feat: 重构 任务队列 系统，实现多线程任务，多类型任务的统一管理与调度
- 🔥feat: 支持消息弹窗实时体现任务运行状态

## 0.6.0 - 正式版 (2026-08-12)

- 修复 Windows 子进程中文输出乱码：自动识别 UTF-8，必要时按 GBK/CP936 解码；任务中心、依赖信息、媒体错误信息和导出日志统一修复，Windows 导出日志同时写入 UTF-8 BOM。
- 修复哔哩哔哩、网络视频、音乐下载和媒体处理的输出目录逻辑：显式填写的目录优先，未填写时使用设置中的默认目录，再回退到系统下载目录。
- 修复 yt-dlp 浏览器 Cookie 兜底重试与首次请求使用不同输出目录的问题。
- 修复哔哩哔哩下载没有使用设置页默认目录的问题，并保留 BBDown 的原生工作目录和登录状态行为。
- 移除设置中的自定义 Logo 功能，界面统一使用正式应用图标。
- 修复 Windows Lite 的 WebView2 setup 弹窗；Lite 使用系统已有 Runtime，Full 保留离线 WebView2 安装能力。
- 完善 Windows Full/Lite 与 macOS Apple Silicon Full/Lite 的构建和离线依赖打包验证。

## 0.5.12 - Pre-release (2026-08-12)

- 移除设置中的自定义 Logo 功能，应用界面统一使用正式图标，避免只修改局部界面而造成误解。
- 增加 yt-dlp 的浏览器 Cookie 失败兜底：先执行无 Cookie 请求，只有检测到需要登录或人机验证时，才在同一任务中使用所选浏览器 Cookie 自动重试。
- 修复 Windows Lite 安装包的 WebView2 setup 流程：Lite 不再内置或启动 WebView2 安装器，使用系统已有 Runtime；Full 继续保留离线安装能力。

## 0.5.11 - Pre-release (2026-08-11)

- Added an explicit browser Cookie selector for YouTube downloads, including
  Windows Edge/Chrome presets and custom browser profiles. This makes the
  `Sign in to confirm you're not a bot` recovery path visible in the normal
  download workflow without storing Cookie values in MAD Toolbox.
- Made YouTube connectivity checks resolve `curl` through the application PATH
  on every supported platform instead of relying on a fixed Unix path.
- Tightened tag-build validation: Windows and macOS release builds now run the
  frontend formatting check, and Windows packaging verifies that exactly one
  installer was produced for each edition.
- Pinned the Windows FFmpeg LGPL asset to a dated BtbN build so the Full
  installer remains reproducible when the upstream rolling `latest` release
  rotates its assets.
- Changed Windows NSIS bundles to embed the WebView2 offline installer, so the
  Full installer can be installed and launched without network access.

## 0.5.10 - 2026-08-03

- Fixed audio extraction defaults: Opus/MP3 and other codecs are no longer
  blindly copied into incompatible M4A/WAV/FLAC/OGG containers.
- Fixed all-stream MP4/MOV conversion and remuxing so text subtitles use the
  compatible `mov_text` encoder instead of failing automatic encoder selection.
- Rechecked PR-compatible conversion, stream extraction, subtitle extraction,
  thumbnails, GIFs and image-sequence output against the bundled FFmpeg 8.1.2.

## 0.5.9 - 2026-08-02

- Run the bundled BBDown directly from its own application directory so its
  native `BBDown.data` and login overwrite behavior remain untouched. The GUI
  no longer copies BBDown or migrates data from any other installation.
- Restored the official, unmodified BBDown 1.6.3 binary. GUI QR login follows
  BBDown's official web endpoints, keeps the complete Cookie fields returned by
  Bilibili, validates the account, and writes the native `BBDown.data` format;
  normal downloads still invoke BBDown unchanged.

## 0.5.8 - 2026-08-01

- Fixed bundled BBDown login state on macOS and Windows when an older GUI left
  a temporary QR ticket in `BBDown.data`. The bundled runtime now keeps one
  native BBDown state directory and lets BBDown recreate that file normally.
- Added a small login-state indicator without parsing or storing credentials in
  the GUI.

## 0.5.7 - 2026-08-01

- Fixed bundled BBDown login state on macOS and Windows by running it from a
  writable app-data directory, keeping `BBDown.data` beside the executable as
  expected by the original CLI, and allowing a new QR login to replace the
  previous session.
- Added live login-state feedback so a failed BBDown account check is not
  mistaken for a successful local-cookie load.

## 0.5.6 - 2026-08-01

- Updated the pinned Windows Full FFmpeg asset and executable checksums after
  the previous BtbN release asset was retired.

## 0.5.5 - 2026-08-01

- Simplified BBDown defaults so a normal download runs as `BBDown <link>` and
  information lookup runs as `BBDown <link> --only-show-info`.
- Stopped adding output, FFmpeg, encoding and subtitle flags unless the user
  explicitly selects them.

## 0.5.4 - 2026-08-01

- Removed the custom BBDown authentication gate, credential parsing, storage
  and injection; BBDown now manages its native `BBDown.data` beside the
  executable according to its original CLI behavior.
- Changed setting templates to ordinary WebView local storage and task exports
  to preserve CLI output as-is instead of encrypting or redacting it.
- Hid the Windows application console and all directly launched background
  tool windows.
- Removed the terminal-style log page and added direct per-task log export.
- Expanded Premiere Pro compatibility handling for common video containers,
  lossless/lossy audio and text subtitle files.
- Fixed PowerShell 5-compatible WinGet and pipx installation guidance and
  added WinGet/Python user-install discovery paths.

## 0.5.0 - 2026-07-29

- Added Windows 10 22H2 and Windows 11 x64 support.
- Added reproducible Windows Full and Lite NSIS packaging.
- Added pinned Windows x64 BBDown, FFmpeg/ffprobe, MediaInfo, yt-dlp and Deno
  acquisition with archive and binary SHA-256 verification.
- Added Windows system/custom tool discovery, hardware encoder detection,
  Credential Manager integration and encrypted template storage.
- Added Windows diagnostic ZIP generation, platform-specific paths, Explorer
  directory selection and WinGet installation guidance.
- Added Windows Full/Lite CI builds while retaining Apple Silicon macOS
  support and feature parity.
