# UI 迁移决策记录（MangoDisk 风格 + Design System 重构）

> 本文档记录 UI 迁移过程中遇到的**不确定点**与**我（执行 agent）的选择**，供迁移完成后统一审阅。
> 每条包含：背景疑惑 → 最终选择 → 依据 → 被放弃的备选方案。
> 用户已定的决策（不再记录在此）：sidebar 按业务分组；强调色保留品牌蓝 #0A84FF；页面操作按钮改页内工具栏。

## 记录索引

| #   | 阶段 | 主题                                                                                | 状态                                                  |
| --- | ---- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| D1  | -1   | tsconfig 删除 composite/references                                                  | 已执行                                                |
| D2  | -1   | TypeScript 7.0 vs 7.1 的版本选择                                                    | 已执行                                                |
| D3  | 0    | 跳过 shadcn CLI，手写 components.json 与组件源码                                    | 已执行                                                |
| D4  | 0    | 通知的自绘生命周期进度条换 sonner 原生外观                                          | 已执行                                                |
| D5  | 0    | 主题切换收口提前到阶段 0（而非阶段 1）                                              | 已执行                                                |
| D6  | -1   | Tauri npm 包降回与 Rust crate 同 minor                                              | 已执行                                                |
| D7  | 0    | Toaster 配置：token 注入而非 richColors                                             | 已执行                                                |
| D8  | 0    | 通知语义色恢复方案（icon 四色 + 左边条）                                            | 已执行                                                |
| D9  | 0    | Tailwind utilities 与 Mantine 样式的级联策略                                        | 已执行                                                |
| D10 | 0    | Styleguide 主题按钮截图异常的结案                                                   | 已执行                                                |
| D11 | 0    | 启动时 invoke TypeError 四连发（范围外）                                            | 记录待办（D22④ stop/end toast 同源，合并处理）        |
| D12 | 1    | @tailwindcss/vite 对启动后新建文件不重扫（dev 缓存）                                | 已执行                                                |
| D13 | 1    | 浏览器环境 Mantine Modal Portal 内点击失效（范围外）                                | 已消解（弹窗迁 Radix 后自然消失，见 D25/D27）         |
| D14 | 1    | 折叠动画学习 MangoDisk：文字盒独立过渡替代条件渲染                                  | 已执行                                                |
| D15 | 1    | D5 的修正：Mantine legacy key 实为 mantine-color-scheme-value                       | 已执行（双写已随阶段 7 移除，见 D26⑤）                |
| D16 | 1    | 验收决策：侧栏分层贴 MangoDisk 轨道结构 + Tooltip 统一 top + media sticky 延后      | 已执行（遗留三项闭环：→D20批4 / D19④ / D27 真机清单） |
| D17 | 2    | dev 环境两类陈旧缓存：Tailwind 扫描缓存与浏览器 HTTP 模块缓存                       | 已执行（对策纳入验收流程）                            |
| D18 | 2    | 阶段 2 验收记录（21 项修复 + 记档 5 + 移交 2）                                      | 已执行（移交闭环：rerun→D21⑤；deleteTasks→D27 清单）  |
| D19 | 3    | 阶段 3 迁移决策（bilibili + network + common 表单件层）                             | 已执行                                                |
| D20 | 3    | 阶段 3 验收裁决与修复记录                                                           | 已执行（记档 5 见汇总索引）                           |
| D21 | 4    | 阶段 4 迁移决策（music + L2TabNav + Mantine 样式层化）                              | 已执行                                                |
| D22 | 4    | 阶段 4 验收裁决与修复记录                                                           | 已执行（记档 6：两项由 D26 终审结案）                 |
| D23 | 5    | 阶段 5 决策与验收（media 域 12 tsx + 吸顶工具栏）                                   | 已执行（NumberField clamp 移交项→D26 落地）           |
| D24 | 6    | 阶段 6 迁移决策（settings 域 9 文件 + 语义映射表）                                  | 已执行                                                |
| D25 | 6    | 阶段 6 验收裁决与修复记录                                                           | 已执行（记档 9 见汇总索引）                           |
| D26 | 7    | 阶段 7：Mantine 移除与终态收敛                                                      | 已执行（真机复验移交用户，权威清单见 D27）            |
| D27 | 7    | 终审验收裁决与修复记录（UI/UX 终审后 + 文档大修）                                   | 已执行                                                |
| D28 | 收尾 | 页头吸顶工具栏统一为四页标准（用户两轮裁决：先线后吸顶）                            | 已执行（滚动观感归 D27 真机清单）                     |
| D29 | 收尾 | 前后端通信完整性审计（3 agent 并行 + 主 agent 复核）                                | 已执行（结论：链路完整；P2 处置见正文）               |
| D30 | 收尾 | Effect 白名单制度全面落地（Default Deny 清理 + 隐藏状态机精简 + seed 交付架构改造） | 已执行（⑤ 类保留项已获用户批准保留；3 处有意行为修正见正文） |
| D31 | 收尾 | 图标库迁移 Tabler → Phosphor Regular（67 项语义映射 + 描线动效改淡入 + 卸载 @tabler） | 已执行（真机复验项并入 D27 清单）                     |

> 状态说明：**已执行**＝决策已落地并验收；**已消解**＝记录的问题随后续迁移自然消失；**记录待办**＝范围外缺陷，建议迁移合并后独立 ticket；括号/箭头标注为闭环去向。全部「记档不修 / 待办 / 移交」事项的汇总索引见文末[记档项汇总索引](#记档项汇总索引)。

---

## D1 · 删除 tsconfig 的 composite 与 references

**疑惑**：TS 7（tsgo）对 `composite` 的支持在社区迁移清单中曾列为"待验证"项，本项目的 `tsconfig.node.json` 带 `composite: true`、主 `tsconfig.json` 带 `references`，是 Vite 模板的历史残留。

**选择**：直接删除 `composite: true` 与 `references`，保留 `pnpm check` 的两次独立 `tsc` 调用不变。

**依据**：`check` 脚本本就是对两个 tsconfig 分别独立调用 `tsc --noEmit`，从未使用 `--build` 模式；references 在此模板中不承担跨项目构建职责，删除无功能损失，且彻底绕开 tsgo 的兼容风险。

**备选**：保留 composite 等 tsgo 报错再处理（被否：多一轮等待，且修复方式大概率相同）。

## D2 · TypeScript 7.0（而非等 7.1）

**疑惑**：TS 7.1 stable 预计 2026-11-24 发布（距执行日约 10 天），7.1 恢复了 7.0 移除的编译器 API。

**选择**：直接采用 7.0 stable，7.1 发布后作为小版本跟进（`^7.0` 语义允许）。

**依据**：本项目只用 `tsc` CLI 做类型检查（`--noEmit` / `-p`），不消费编译器 API，7.0 的 API 缺失对本项目无影响；等 7.1 会阻塞整个迁移启动。

**备选**：等 7.1（被否：阻塞；且 7.1 无本项目需要的新能力）。

## D3 · 跳过 shadcn CLI，手写 components.json 与组件源码

**疑惑**：计划原定用 shadcn CLI 初始化并按需 add 基础件。CLI 的 `init` 是交互式的，且 add 进来的组件样式是 shadcn 默认风，仍需按 MangoDisk 风格整体重写。

**选择**：手写 `components.json`（保留与 shadcn 生态工具的兼容性，未来仍可用 CLI），组件源码由 visual-dev agent 参照 shadcn (new-york) 源码结构 + 我们的 token 直接编写。

**依据**：shadcn 的本质就是"复制源码进仓库"，手写与 CLI add 结果等价，但省去交互式初始化的不确定性，且第一天就落到自定义样式。

**备选**：CLI add 后重写样式（被否：多一轮模板替换工作）。

## D4 · 通知的自绘生命周期进度条换成 sonner 原生外观

**疑惑**：旧通知实现（lib/notifications.tsx + styles/notifications.css）用 `--app-notification-lifetime` CSS 变量在 Mantine 通知上自绘了剩余时长进度条，sonner 无直接等价物。

**选择**：接受 sonner 原生外观（类型图标 + 色彩 + 悬停展开），不再自绘进度条。四类语义（success/warning/error/info）、默认时长（3s/5s/10s/4s）、图标、bottom-left 位置全部保持。

**依据**：进度条是弱信息（时长本身保留在自动关闭行为里）；保留它需要 hack sonner 内部结构，成本不成比例。

**备选**：toastOptions 自定义 render 重绘进度条（被否：耦合 sonner 内部实现，升级易碎）。

## D5 · 主题切换收口提前到阶段 0

**疑惑**：计划原定阶段 1 才把 `App.tsx` / `GeneralSettingsPage` 的 `useMantineColorScheme` 换成 ThemeManager。但 MantineProvider 挂载时会读旧 key（`mantine-color-scheme`）并**覆写** `data-mantine-color-scheme` 属性，与 ThemeManager 形成双状态源，暗色用户会在每次启动时被 Mantine 重置回浅色。

**选择**：阶段 0 一并完成：`App.tsx`、`GeneralSettingsPage` 改用 `lib/theme.ts` 的 `useColorScheme()`；ThemeManager 切换时同步写旧 key（resolved 值），使 Mantine 挂载读到与 ThemeManager 一致的值。另在 `index.html` 加内联防闪脚本（处理 light/dark/auto 三态）。

**依据**：双状态源不解决必然产生启动闪烁/重置 bug；改动仅两处 import 与一行调用，成本低。

**备选**：MantineProvider 换 noop colorSchemeManager + 动态 defaultColorScheme（被否：仍依赖 Mantine 内部行为，不如写旧 key 直白）。

## D6 · Tauri npm 包降回与 Rust crate 同 minor

**疑惑**：阶段 -1 的 `pnpm add` 刷新 lockfile 时把 `@tauri-apps/*` npm 包顺带升到了 2.12.x，与 Rust crate（tauri 2.11.5 / opener 2.5.4 / dialog 2.7.2）出现 minor 错位，`tauri dev` 发出版本不匹配警告。

**选择**：npm 侧降级对齐 crate 侧 minor（api ~2.11.1、dialog ~2.7.3、opener ~2.5.5、cli ~2.11.5），不升级 Rust crate。

**依据**：工具链升级阶段的原则是最小干预——Tauri 双侧版本本不在本次升级范围；升级 Rust crate 需重新验证后端行为，风险与收益不成比例。

**备选**：`cargo update` 升 crate 到 2.12 对齐 npm（被否：动了不该动的层）。

## D7 · Toaster 配置：token 注入而非 richColors

**疑惑**：双 review 后 UX 侧建议开 sonner `richColors`（内建按类型着色）恢复错误通知的可扫读性；UI 侧建议 icon 上语义色。richColors 的配色是 sonner 自带色板，不来自我们的 token。

**选择**：`AppToaster`（src/components/layout/AppToaster.tsx）统一收敛 Toaster 配置：`theme` 跟随应用主题、背景/文字/边框注入 popover token（`--normal-bg/--normal-text/--normal-border`）、`closeButton`（恢复旧版可见关闭钮 + 键盘可达）、`visibleToasts=4`（对齐旧 Mantine 堆叠数）；不用 richColors，通知类型着色交给适配层（见 D8）。

**依据**：token 注入让通知深浅主题自动正确且色板归一；richColors 会在暗色下引入非 token 色。

**备选**：richColors + token 只管背景（被否：两套着色来源并存，暗色下难保一致）。

已知限制：sonner 2.0.8 的 Toaster 不透传 `closeButtonAriaLabel`/`containerAriaLabel`，读屏播报固定英文；升级 sonner 后补中文（AppToaster 注释已标注）。

## D8 · 通知语义色恢复方案（icon 四色 + 左边条）

**疑惑**：sonner 默认形态下四类通知都是白底黑字 + 无色图标，旧版"红底错误一眼可辨"的可扫读性丢失。恢复到什么深度？

**选择**：适配层（src/lib/notifications.tsx）给 icon 按类型着语义色（--success/--warning/--destructive/--info），并给 toast 加 2px 同色左边条；不复刻旧版的整条 tinted 底与倒计时进度条。

**依据**：icon 色 + 边条已恢复级别可扫读性（对照旧基线截图验证的信息层级），改动局限在适配层一处；tinted 底需要 hack sonner 每类型样式，成本不成比例。

**备选**：整条 tinted 底复刻（被否：同 D4 的理由）。

## D9 · Tailwind utilities 与 Mantine 样式的级联策略

**疑惑**：Tailwind v4 的 utilities 在 `@layer utilities` 内，而 Mantine styles.css 无 layer——级联规则是无 layer 样式在同等特异性下始终压过 layer 内样式。迁移期间给 Mantine 组件加 `className="bg-card"` 这类 utility 覆盖会被 `.mantine-Button-root` 压掉。

**选择**：迁移期间**不用** Tailwind utility 覆盖 Mantine 组件样式；需要覆盖时用该组件的 Mantine Styles API / CSS 变量，或等该组件在阶段 2-6 迁到自有组件时一并处理。UI-reviewer 在阶段 0 审查中识别了此风险。

**依据**：避免写一堆注定失效或脆弱的覆盖样式；每页迁移完成后其 Mantine 样式依赖归零，覆盖问题自然消失。

## D10 · Styleguide 主题按钮截图异常的结案

**疑惑**：UI/UX 双 review 均发现深色截图中 Styleguide 的主题切换按钮仍显示浅色态文案（应为"切换到浅色"），怀疑 `useColorScheme` 订阅同步缺陷（若为真会波及设置页三态控件）。

**选择**：已用真实点击路径复验：点击后按钮文案、`html.dark`、localStorage、`data-mantine-color-scheme` 四者全部即时一致，**订阅同步无缺陷**。截图异常系验收时直接向 DOM 注入 `.dark` class（绕过 React state）所致。

**依据**：见上方复验数据；代码走查所有 `setColorScheme` 入口均正确通知 listeners。

## D11 · 启动时 invoke TypeError 四连发（范围外记录）

**现象**：浏览器环境（无 Tauri IPC）启动时左下角连发 4 条 `TypeError: Cannot read properties of undefined (reading 'invoke')` 原始技术报错。为预先存在缺陷（`String(error)` 直出 + 无去重），非本次迁移引入。

**待办建议**（迁移完成后处理，或单独立 ticket）：a) 排查 invoke 失败的降级路径；b) 同错误去重/计数合并（"×N"）；c) 错误文案本地化为一句人话 + 可展开的原始错误。

**闭环关联**：D22 记档④（music stop/end 失败 toast 同为 `String(error)` 直出 + 无去重）并为本类，ticket 时一并处理。

## D12 · @tailwindcss/vite 对启动后新建文件不重扫（dev 缓存）

**现象**：Sidebar.tsx 由 visual-dev agent 在 dev server 运行中新建后，其 Tailwind 类（`w-60`/`w-16`/`duration-[240ms]`/`ease-[cubic-bezier(...)]`）在浏览器中全部未生效（nav 宽度落在内容宽 187px、动画用默认 150ms/曲线），而同一文件里更早存在的 `transition-[width]`（progress.tsx 中也出现过）却正常——首次表现极具迷惑性，像"部分任意值类不被支持"。

**排查**：直接查浏览器样式表确认 `.w-60` 规则不存在；`pnpm build` 产物 CSS 中 `.w-60` 存在 → 源码与 scanner 无问题，纯 dev server 扫描缓存未包含启动后新建的文件。

**选择**：重启 dev server 解决；流程上约定"新建组件文件后若样式未生效，先重启 dev server 再排查"。**验收阶段（每阶段完成后）统一重启 dev server 再走查**。

**备选**：升级 @tailwindcss/vite 或报 issue（被否：不阻塞，后续版本自然修复）。

## D13 · 浏览器环境 Mantine Modal Portal 内点击失效（范围外记录）

**现象**：走查中 StartupTipsModal（Mantine Modal）的关闭按钮（X）点击无效——包括 CUA 坐标点击与 `element.click()`。定位过程：事件确实到达按钮 DOM（capture 监听确认），但 React onClick 不触发；同页主树按钮（侧栏导航）响应正常。react 单实例（pnpm why 全部 deduped）。

**判断**：React 19 + Vite 8 dev 环境下 Mantine Modal Portal 容器的事件委托失效，浏览器走查环境特有或 React 19 组合特有；上一会话同环境曾成功关闭过该弹窗，暂无法稳定归因。不影响主树交互。

**对策**：走查用 `localStorage['mad-toolbox:startup-tips-dismissed']='1'` 预置跳过弹窗。**该弹窗在阶段 6 迁移到自有 ui/dialog（Radix）后此问题自然消解；迁移后需在浏览器与 tauri 窗口双环境复验弹窗关闭**。若届时 tauri 窗口仍复现则为真实 P0。

**已消解（阶段 6）**：StartupTipsModal 已迁 ui/dialog（Radix，Portal 事件模型不同），浏览器关闭链路实证正常（D25：data-state=closed 与手动 animationend 卸载均通过）；tauri 窗口复核列入 D27 真机清单。

## D14 · 折叠动画学 MangoDisk：文字盒独立过渡替代条件渲染

**疑惑**：用户实测发现展开侧栏时 "MAD Toolbox" 品牌字会被挤成一列一帧（旧实现折叠态 unmount AppBrand / 导航 label，展开瞬间挂载，文字在窄容器里默认换行竖排）。

**选择**：clone MangoDisk 源码（.research-ui/mangodisk-src，用户指示作为长期学习参考）研读 md-sidebar.vue 的实现并移植思路（不复制代码）：文字盒宽度独立于 nav 容器动画——label 常驻 DOM，`max-width 0↔150px` + `truncate`（永不换行，只会水平裁剪），opacity/transform 延迟 60-70ms 淡入，`visibility` 延迟 240ms 切换（保证淡出可见）；分组标题同法 `max-height` 过渡；状态徽标胶囊 max-width/padding 过渡；Tooltip 常驻包裹 + `disabled={展开态}`（避免条件包裹导致按钮 remount 丢焦点，tooltip.tsx 新增 disabled prop）。慢放 10 倍截图复验：折叠/展开全程无换行挤压帧。

**踩坑记录**：分组标题初版 `max-h-5`(20px) 小于其 padding 总和 22px（pt-4+pb-1.5），content 区被压成负数文字裁成横线——padding 需计入 max-height，修正为 `max-h-[38px]`。

**备选**：仅给 `.app-title` 加 `whitespace-nowrap`（被否：窄宽度仍会截断突现，观感差；且导航 label 同样问题要一起解决）。

## D15 · D5 的修正：Mantine legacy key 实为 mantine-color-scheme-value

**现象**：走查暗色主题（localStorage 预置 `mad-toolbox:color-scheme=dark` + reload，走真实初始化路径）时发现分裂：我们 token（`.dark` class）暗色生效，但 Mantine 组件（TasksPage 卡片、body 背景）保持浅色——`data-mantine-color-scheme` 属性被 MantineProvider mount 时覆写回 light。

**根因**：D5 假设的 legacy key `mantine-color-scheme` 写错了。旧代码用 `useMantineColorScheme()`（git HEAD 确认无自定义 colorSchemeManager），Mantine 9 默认 manager key 是 **`mantine-color-scheme-value`**。theme.ts applyScheme 写错 key，Provider mount 读不到值就用 defaultColorScheme="light" 覆写属性。

**选择**：`LEGACY_MANTINE_KEY` 改为 `mantine-color-scheme-value`（迁移读值 + applyScheme 同步写值两个用途都修正）。复验：reload 后属性 dark、body #1d1d20、Mantine 卡片全暗，双通道一致。

**备注**：旧用户升级后首启迁移路径（读 `mantine-color-scheme-value` → 写新 key）与暗色双写（写回该 key 供过渡期 Provider 读）现在共用同一 key，行为自洽。

**双写收敛（阶段 7）**：applyScheme 的旧 key 写入与 data 属性双写已随 MantineProvider 移除一并删除（D26⑤）；读侧迁移保留，本条的过渡期使命完成。

## D16 · 阶段 1 验收决策三则（UI/UX 双 review 后）

**1. 浅色主题侧栏分层**（ui-reviewer P2-9）：`--sidebar` 原为白色与 `--card` 同色，浅色下侧栏与工作区卡连成整片。读 MangoDisk 源码确认其 sidebar 是 `bg-transparent` 融入应用底色轨道——采用同构：light `--sidebar: #f5f5f7`、dark `--sidebar: #1d1d20`（均等于各自 --background），侧栏融入轨道、工作区卡浮层，两主题结构一致。放弃的备选：白侧栏 + 交界细线（与暗色"更深一档"逻辑不一致）。

**2. 工具栏 Tooltip 方向统一**（ui-reviewer P1-3）：四页统一用自有 Radix Tooltip、默认 `side=top`（三页已是 top，只改 Music 一页）；Music 的去噪胶囊从 Mantine Tooltip（bottom + 箭头）迁出，顺带修 h40→h32 与 compact-md 按钮齐平、Switch 补 `aria-label`（UX-reviewer P1-1 WCAG 4.1.2）。

**3. media 长页工具栏 sticky 延后**（UX-reviewer P1-2）：配置→提交需滚回顶部是真实摩擦，但阶段 5 media 迁移时工具栏将从 Mantine Group 重写为自有结构，现在做负 margin sticky hack 属一次性投入。记入阶段 5 验收清单：工具栏容器 `sticky top-0` + 不透明背景。

**同批小修**：状态徽标 aria-label 拼接改 `·`（en 下全角逗号不妥）；分组 wrapper 加 `role=group` + `aria-label`（两 reviewer 一致发现）；导航间距补齐（组间 10px/项间 2px，对齐基准）；折叠态分组标题 `max-w-0`（修水平滚动条）；折叠态导航图标居中（items-center）；已激活项跳过描线动效；更新提示按钮合并为常驻结构（消灭两分支 remount，label 走 D14 动画，展开态 title 补偿截断）；IconButton spinner 16→20 与 children 图标一致；删死词条 shell.backToMain/currentFeature；WorkspaceFrame 去 Mantine Box 改 Tailwind 类；`--title-foreground` token 替代挂在 Mantine 调色板的 `--app-title-color`。

**遗留待办闭环去向**：禁用原因 Tooltip 文案→**已闭环**（D20 批 4，bilibili/network/music 各页落地）；登出按钮 accessible name→**已闭环**（D19④，name 稳定化方案）；折叠钮 collapse/expand 双词动态 label→**维持不做**（aria-expanded 已足，省 2 词条）；UX 运行时验证三项（1366×768 滚动频率/NVDA 播报/折叠态黄点对比度）→**移交终验**（D27 真机清单）。

## D17 · dev 环境两类陈旧缓存：Tailwind 扫描缓存（D12）与浏览器 HTTP 模块缓存

**现象**：阶段 2 走查发现浏览器页面新旧代码混搭——TasksPage（新 Tailwind 结构）与 SettingsSection（旧 Mantine Card，`mantine-Card-root`）同屏。`location.reload()` 后依旧。

**根因**：dev server 重启后，浏览器 HTTP 缓存仍持有部分源模块的旧 transform 产物（Vite 对源模块的响应带 etag，普通 reload 走缓存协商，旧缓存模块未被重新拉取）。与 D12 的 Tailwind 扫描缓存是两类独立问题：D12 是构建侧（新文件类名不进产物），本条是客户端侧（旧模块不进页面）。

**对策**：确认某模块陈旧时，向该源文件追加任意改动（如临时注释）触发 dev server 重新 transform，再 reload 即得新代码；验证后删除临时改动。走查前快速判别：探测页面应出现的关键标记（如 `.rounded-xl.bg-card` 计数）为 0 而源码存在即怀疑陈旧。

**附带澄清**：React 19 将 `aria-hidden={false}` 渲染为字符串 `"false"`，合法且等效于不设置；ui/collapse 的 `inert`/`aria-hidden` 挂在 grid 外层容器上（内层 overflow-hidden wrapper 无属性），收起态 inert 生效（17 个控件不可聚焦）、展开态解除，双态实测通过。

## D18 · 阶段 2 验收记录（UI/UX 双 review 后，21 项修复）

**双 review 交汇 P1**：TaskCard 渲染门 `bar.value > 0` 把 `indeterminate: true, value: 0` 的运行态挡在门外——progress.tsx 专门实现的流动条在本页是死路径。修复：`bar.indeterminate || bar.value > 0`。

**验收修复清单**（同批落地，`pnpm check` / i18n 523 键 / build 全绿）：

1. **indeterminate 死路径**（上述）。
2. **触控目标统一 32px**：TaskCard 六个操作钮撤 `size-7`（回落 IconButton sm 的 size-8）、清空历史 `h-7`→`h-8`、重跑 `h-6`→`h-8`（对齐 D16 紧凑档标准）。
3. **折叠钮交互态**：TaskCard/SettingsSection/CollapsibleSection 三处 toggle 统一 `cursor-pointer` + `focus-visible:ring-2 ring-offset-card`；chevron 加 `pointer-events-none`（整行可点）+ `group-hover:text-foreground`。**系统性根修**：ui/button.tsx 与 ui/icon-button.tsx 基类补 `cursor-pointer`（Tailwind 4 preflight 不再给 button 默认 pointer，阶段 0 遗漏）。
4. **浅色 --warning 调深** #f08c00 → #e8590c（2.48:1 → 约 3.6:1，过大文本 AA；dark 亮档 #fab005 不动）。影响全应用 warning 文字/Badge/进度条，色相仍读作"橙=需处理"。
5. **退场动画期防误操作**：exiting wrapper 加 `inert` + `aria-hidden`（与 ui/collapse 同法）；deleteTasks 对已在退场集合的 id 去重——消灭"双击删除反被告知无可删除"的反向误导 toast。
6. **删除后焦点管理**：remove 成功后 `focusNeighbourTask` 把焦点挪到原位置邻近存活卡标题（先向后找，再向前），批量删除键盘路径不再坠回 body。
7. **清空历史三重加固**：文案"全部删除"→"清空历史"（词条 tasks.deleteAll 改名 tasks.clearHistory）；改两步确认（首击变 destructive"确认清空（N 项）"，3 秒超时还原）；按钮仅在历史区展开时显示（折叠态看不见内容就不可删）。
8. **统计块语义修正**：新词条"进行中/Active"替代误用的"运行中"（口径含 queued+canceling）；"结束"数字改中性 muted（原绿色承诺"都成功"但含 failed/canceled），failed>0 时卡内红字脚注"失败 N"披露；STAT_VALUE_CLASS 键名 blue/yellow/green → primary/warning/muted（消灭 Mantine 词汇残留）。
9. **Progress 无障碍名**：加 `aria-label` 透传；PoolIndicator 传池名、TaskCard 传 `标题 · 状态`。
10. **prefers-reduced-motion**（animations.css 全局段）：无限动画（运行图标旋转、indeterminate 流动条）静止，退场过渡压至 1ms（remove 逻辑固定 280ms 不受影响）。全仓此前无任何处理。
11. **细节**：StatTile 改 `Card padding="md"`（圆角统一 12px，此前自拼 rounded-lg 绕开 cva）；SettingsSection 无标题分支简化 `Card padding="lg"`；任务卡全部 16px 图标 `stroke={1.8}`（对齐全应用惯例，默认 2 过重）；失败日志 code `text-[11px]`→`text-xs font-medium`（对比度缓解）；长标题 `title` attr；三处 toggle 补 `aria-controls`（useId）；interrupted 的 rerun 外露到头部操作区（IconRefresh，黄色告警的主 CTA 不再藏在折叠区，展开区冗余行删除）；poolOccupancy 计数纳入 queued（队列积压时池条满载转红而非虚假空闲）。

**记档不做**（含理由）：

- **destructive 文字深档 token**（浅色 #c92a2a/暗色 #fa5252）：11px 日志与 Badge error 的对比度根治属 token 级，涉及全部 destructive 文字用法，阶段 7 统一评估；本阶段以 text-xs+font-medium 缓解。
- **cancel pending 态**：cancel 点击后按钮随 canceling 事件很快消失，IPC 窗口极小，不加本地 pending。
- **池信息拉取失败静默消失**：浏览器无后端时属合理降级，不做占位文案。
- **SettingsSection/CollapsibleSection 合并**：页面级/行内级两种密度共存合理，出现第三种折叠变体时再合并加 density prop。
- **折叠动画 200ms ease-out vs 侧栏 240ms 自定义曲线**：两者保留（内容折叠与导航展开是不同运动场景），记为 motion 规格：导航=240ms cubic-bezier(0.22,1,0.36,1)，内容折叠=200ms ease-out。

**移交后续阶段的验证点闭环**：music 任务 onRerun 为 undefined 系有意设计→**已闭环**（D21⑤：rerun 入口在任务卡，App.seedTaskIntoWorkspace 回填表单与三域同构，假设成立）；后端 deleteTasks 部分失败返回成功子集的行为假设→**移交终验**（D27 真机清单：批量删除部分失败核对）。

## D19 · 阶段 3 迁移决策（bilibili + network + common 表单件层）

**范围修正**：阶段 3 实际含 common/ 表单配套层 8 件（FieldRow/FieldWithActions/OutputDirectoryField/CookieFileField/ExpertCommandPanel/DependencyMissingBadge/CopyIconButton/CommandPreview）——它们是四页域共用的前置，页面层不迁它们就无法零 Mantine。同时 FieldWithActions 调用方（未迁移的 settings 两页）用 Mantine style props（px/w），顺手换 className（px-5 py-3 / w-[360px]），页面本体留阶段 6。

**1. 画质优先级 MultiSelect 降级为 TextInput**：原 Mantine MultiSelect（13 项画质、searchable+clearable、选择顺序即优先级）是 bilibili 域唯一多选场景，为它自建 ui/multi-select（combobox+badge+排序）成本与收益不成比例——qualityPriority 数据模型本来就是逗号串（BBDown CLI 参数语义），目标用户为高级用户。降级为 Input：hint 沿用 qualityPriorityPlaceholder 词条（"按优先级顺序选择…"）、placeholder 给格式示例（硬编码画质名，同 area 字段 "hk / tw / th" 先例）。**备选**（若用户反馈不佳）：Radix Popover + checkbox 列表轻量版。13 个 bilili.quality.* 词条随之删除（前端 512 键）。

**2. 新建 ui 件三枚**：`segmented`（radiogroup/radio 语义，表单互斥选择用；L2 页签导航的 SegmentedControl 留阶段 4 换 ui/tabs，语义不同）、`password-input`（Input + 可见性切换，词条 common.togglePasswordVisibility）、`number-field`（原生 input[type=number]，空/非法输入回调 null 由调用方回退——network 域两处 min 约束保留，media/music 域阶段 4/5 复用）。

**3. CookieFileField 的 clearable**：Mantine trigger 内嵌小 X 在 Radix Select 会有嵌套交互问题——改为 actions 区独立"清除"按钮（value 非空时出现，词条 common.clear），语义与键盘可达性更好。"添加 Cookie 文件"特殊项由 Radix SelectItem children 自定义（原 renderOption 等价）。验证中状态图标色接语义 token（text-success/text-destructive 替代 --mantine-color-green-6/red-6）。

**4. 登出按钮 accessible name 修复**（D16 遗留）：旧实现 hover 时文本"已登录"↔"登出"切换——读屏的 accessible name 随 hover 抖动，且 aria-label 换词会违反 WCAG 2.5.3（Label in Name）。新实现：文案恒为"登出"，hover 只切换图标（已登录 check ↔ 登出箭头）与颜色（success ↔ destructive 语义），状态与动作解耦且 name 稳定。登出确认改 ui/dialog（Radix）。

**5. 浏览器走查的合成事件天花板**：Radix Select 的 SelectItem 依赖真实 pointer/key 序列；此环境 Playwright locator click 全程超时（阶段 2 已知）、dispatchEvent 合成事件在 Portal 内不可靠（焦点 scope 正常：Enter 打开面板、焦点正确落入 Portal 内选项）。选择闭环以代码审查背书（onValueChange 直连 onUpdate 受控链路，Radix 为生产级组件）。**真机（tauri 窗口）复验点**：Bilibili 模式下拉选择、Cookie 下拉（含"添加"项与清除按钮）、network 数字框步进。已实测通过：Segmented 切换（aria-checked 正确）、NumberField 输入受控回写、两域零 Mantine（grep+DOM 探测）、FieldRow/OptionGroup/开关瓦片渲染。

**6. number-field 落地提前说明**：原计划阶段 3 建件是为 network 两处 NumberInput（摸底后确认）；media/music 的 NumberInput 是额外用点，阶段 4/5 直接复用本件（原 NumberInput 带 hideControls 语义的用法若存在再评估）。

## D20 · 阶段 3 验收裁决与修复记录

双 review（ui-reviewer + UX-reviewer）产出 2×P1 + 15×P2 + 8×P3，裁决：全部 P1/P2 + 低成本 P3 修复，5 项记档不做。修复分五批落地：

**批 1（ui 件层）**：① `number-field` 草稿态修复（P1）——受控 value 把 null 回退值瞬间写回输入框造成"清空后字符粘回"死循环；改为 `draft: string | null` 草稿层，输入中间态只写 draft、合法值实时回调、onBlur 归一化。② `segmented` roving tabindex（radiogroup 整组单 Tab 停留点，Arrow 键换值移焦点；组级与单选项 disabled 透明度分离，避免 0.5×0.5 叠乘）。③ `password-input` 切换钮 32px + aria-label 动态化（显示内容↔隐藏内容，弃 aria-pressed）。④ `select` trigger 焦点环 `focus-visible:ring-ring/30`（字段类惯例）+ 新增 `SelectSeparator`。

**批 2（FieldRow 层）**（P1）：表单 label 无程序关联——FieldRow 新增 `htmlFor`（label 元素）+ `hintId`（提示 p id，配合 aria-describedby）props，两域全部字段补 useId 关联。SwitchRow 改 `<label>` 包裹（label[for] 免费获得，点击瓦片不再双触发）。SwitchTileGrid 学 MangoDisk md-settings-row.vue 改容器查询（`@container` + `@[20/30/40rem]:grid-cols-N`）——桌面窗口视口断点恒激活（minWidth 900 死代码），容器随内容宽度换列才是目标语义。

**批 3（四字段组件 useId 关联）**：BilibiliAdvancedFields（8 处，含 Select trigger 用 aria-label 而非 label[for]——Radix ButtonRole 不可关联）、NetworkVideoAdvancedFields（6 处）、BilibiliDownloadFields（4 处）、NetworkVideoDownloadFields（5 处）；ValueRows 单 useId 多行复用改 `${baseId}-${key}` 派生。qualityPriority placeholder 换 `qualityPriorityExample` 词条（"1080P 高清， 4K 超清"，BBDown 词元本身中文，en 同值）。

**批 4（页面层 9 文件定点）**：BilibiliPageHeader（登出确认 pending 时禁 Esc/遮罩关闭——关窗会被读作"取消"而登出继续执行；登出钮文字保持默认色、语义色只上图标+底色，success/destructive 做文字色浅色下不达 AA；提交钮 disabled 时 Tooltip 显示 common.submitWaitingPreview）｜NetworkVideoPageHeader（probe 钮 size sm 32px/图标 16、disabled 时 Tooltip 换 network.probe.urlRequired）｜CookieFileField（trigger 弃 aria-label——可见内容即名称，与浏览钮不再重名；placeholder 用新词条 common.cookieFilePlaceholder；校验钮 label/Tooltip 随状态播报 valid/invalid 结论；全部动作钮 span 桥接 Tooltip 修禁用态；"添加"项前 SelectSeparator 分隔 + onAddCookieFile 条件渲染；回显路径 truncate）｜ExpertCommandPanel（按钮 32px、warning font-medium、进入专家模式自动 focus 文本域）｜NetworkVideoProbeDialog（补 CopyIconButton + DialogDescription 词条 + `max-h-[420px]` 双层限高——ScrollArea 根与 viewport 同时 max-h，Radix 滚动条才在内容超出时生效）｜CopyIconButton（clipboard catch 失败静默复位）｜DependencyMissingBadge（ring-ring 按钮类惯例）｜CommandPreview（aria-live="polite" 播报 + 空态词条 common.previewEmpty）｜OutputDirectoryField（tooltip 与按钮 label 统一 selectOutputDirectory，修 P3-7(UI) 遗留）。新增词条：common.copy / common.cookieFilePlaceholder / network.probe.dialogDescription（zh+en，共 520 键）。

**批 5（词条清理）**：common.showValue/hideValue/previewEmpty/submitWaitingPreview 替换 togglePasswordVisibility；deps.missingBadge 改"依赖缺失：{{names}}"；删 13 个 bilili.quality.* 死词条。

**浏览器复验通过**：submit disabled 包 span、expert 钮 32px、CommandPreview aria-live+错误分支、probe 双钮 32px+span、Cookie 触发器无 aria-label/placeholder 生效、下拉键盘打开 + 分隔线渲染。D17 复发 1 次（select.tsx 改动后 HMR 未生效，reload 解决）。

**记档不做（5 项，交用户审阅）**：① 专家模式还原确认（focus 修复已做，二次确认交互留真机感受）；② Segmented 组禁用 aria-disabled 取舍（视觉半透明已足够，读屏组 role=disabled 语义争议）；③ bilibili QR 登录轮询事件链路（bilibili-login.ts 行为级，迁移无关）；④ Textarea autosize resize 监听（仅窗口 resize 时重算，当前实现内容驱动已覆盖主场景）；⑤ QR 过期自动重发（功能增强，非迁移范围）。

**真机复验点（阶段 7 终验收前）**：Bilibili 模式下拉选择、Cookie 下拉（含"添加"项与清除钮）、network 数字框步进、QR 过期表现、登出确认流、探测结果弹窗滚动+复制。

## D21 · 阶段 4 迁移决策（music + L2TabNav + Mantine 样式层化）

**1. Mantine 样式装进 layer(mantine)（全局基础设施修复）**：music 页 textarea 的 font-mono/text-xs 不生效，追因发现 `@mantine/core/styles.css` 直接 @import 是无层规则，其全局 reset `input, button, textarea, select { font: inherit }` 按层叠规范必胜 `@layer utilities`——**阶段 2-3 迁移页的所有表单元素字号/字重/字体一直被静默覆盖成 16px 继承值**。修法：新建 `styles/mantine-compat.css`，`@layer theme, base, mantine, components, utilities;` 后以 `layer(mantine)` 引入两个 Mantine css，main.tsx 替换原直引。层序置 base 之后：Mantine 组件样式仍赢 preflight（未迁移页零回归，Media/Settings 截图复验），设计系统 utilities 一律赢 Mantine reset。阶段 7 删 Mantine 时一并删本文件。复验：input 14px、textarea mono 12px、按钮字号恢复；music/light+dark、media、settings 截图通过。

**2. L2TabNav 内核换 Radix Tabs（API 不变）**：三域共用（music/media/settings），调用方零改动。旧 .l2-tabnav CSS 块（mantine-SegmentedControl 选择器 + mantine 色变量）删除，样式全部转 Tailwind 类：满宽等宽 pill、激活品牌蓝底白字（shadow-none 覆盖 ui/tabs 默认卡片白）、徽标数琥珀色（激活转白，色随 page===value 计算而非 CSS data 态——徽标 span 的条件类更直观）。不用 TabsContent，页签内容由调用方按 value 渲染（三域现状）。键盘：Arrow 移动焦点（roving tabindex 实测生效）+ Enter/Space 激活。

**3. 新 ui 原语三枚**：`chip`（筛选 chip 开关，aria-pressed 语义，替代 Mantine Chip，音源分组与格式筛选共用）、`checkbox`（Radix，行内选中用；results 表格行点击整行选中、checkbox onClick stopPropagation 防双触发）、`textarea` 增 `autosize` prop（内容驱动高度，ExpertCommandPanel 的手写 effect 收编为本 prop）。

**4. 搜索结果表格原生化**：Mantine Table → 原生 `<table>` + Tailwind（行 hover、行点击选择、queued/lossless Badge 用 ui/badge primary/success 变体、降噪预估提示内联）。行点击选择无键盘等价（旧版同样），读屏用户走行内 checkbox（有 aria-label）——保持既有可达性水平，终验收再评估。

**5. music rerun 页内入口假设确认（D18 移交项）**：music 域不存在页内 rerun 控件——rerun 入口只有任务卡的 rerun 按钮（阶段 2 已迁移），App.seedTaskIntoWorkspace 导航回 music 页并回填表单快照（keyword/playlistUrl 置空防误提交），与 bilibili/network 同构。假设成立，无需页内等价入口。

**6. 错误 Alert 内联化**：Mantine Alert → role="alert" 的 destructive 色内联块（图标+标题+错误详情），不复用 Mantine 变体体系。Loader → IconLoader2 animate-spin（与 ui/button loading 同款）。

**7. 合成事件天花板补充（D13/D19 延伸）**：Radix TabsTrigger 对合成 click 无响应（激活模型是 mousedown/Enter/Space），合成 keydown Enter 激活成功、ArrowRight 移焦点成功但 focus-select 未触发；Chip（原生 button aria-pressed）合成 click 正常切换。tabs 选择闭环以代码审查背书（onValueChange → updateForm 受控链路），真机复验点新增：L2TabNav 点击与键盘切换、chips 点击。

**8. 浏览器走查通过项**：music 双模式切换（placeholder 跟随）、chips aria-pressed 切换、NumberField（searchSize/threadCount 值渲染）、高级区 2×2 等宽文本域 90px 自适应、denoise pill、空结果提示、light+dark 双主题截图、media 页 L2TabNav 直接呈现新版（API 不变的即时收益）。

## D22 · 阶段 4 验收裁决与修复记录

双 review（1×P1 UX + 2×P1 UI、8×P2、12×P3）裁决：P1/P2/P3 全修，6 项记档。批一次落地：

**必修 3 项**：① MusicSourcePicker 分组标题行 Separator 溢出卡片——`w-full shrink-0` 前有标签 span，总宽必超容器；改 `className="flex-1"`（basis 0 让 flex 算法接管）。② 结果区四个工具栏按钮 + 音源重置按钮 h-7 → h-8 gap-1.5（D16/D18 两度确立的 32px 紧凑档，TasksPage 清空历史是直系对照）。③「只选无损」从 response.results 改 visibleResults.filter——原实现无视格式筛选，静默选中被隐藏的其它无损格式行，触发不可见下载。

**应修 8 项**：chip 选中态 `bg-primary/10 text-primary`（≈3.2:1）→ `bg-accent text-accent-foreground`（≈4.8:1，与 Badge primary/sidebar-active 归一）｜结果区标题双重复——删内层标题保留统计行（外层 SettingsSection title/action 是三域锚点）｜threadCount hint 补 hintId + aria-describedby（同文件自相矛盾）｜RawConfigTextarea 的 aria-describedby 从容器 div 落到 Textarea 本体（容器关联是死关联，四格全传 rawHintId）｜Run 按钮禁用原因 Tooltip（span 桥接；新增 music.run.needSource / music.run.needInput 词条，prepared.error 时直接播报错误文案；submitting/会话切换算短暂过渡态不给文案）｜prepared.error 出现时自动展开高级区（错误指路不能指向折叠区）｜音源分组容器补 role=group + aria-label（D16 已定模式回归）｜清空搜索结果两步确认（对齐 tasks.clearHistory：首击变 destructive「确认清空（N 条）」+ 3s 还原；新词条 music.results.clearConfirm）。

**低成本 12 项**：Stop 按钮 autoFocus（防两分支互斥渲染丢焦点）｜denoise pill 改 label 包裹 + 可见文字（删 Tooltip——含义可见即无需悬停提示，整颗 32px pill 成为开关热区，Switch 的 aria-label 由 label 包装免费获得）｜结果行 checkbox aria-label 拼合「歌名 · 歌手 · 音源」｜stats 零值尾巴不渲染｜音源区折叠时隐藏重置按钮（折叠态不应操作看不见的内容，计数保留）｜markQueued false 不再弹成功 toast（会话漂移防御路径静默保留勾选）｜错误详情 text-destructive/90 → text-foreground（90% 红字叠红底 ≈3.4:1，且违反"语义色不上正文"）｜L2TabNav 删 flex-1 死类（grid item 不吃 flex）｜hover:text-destructive 冗余删除 ×2｜checkbox rounded-[4px] → rounded-sm（token）｜checkbox indeterminate 圆点 → IconMinus 横杠｜IconLoader2 stroke 统一 1.7。

**记档（6 项，交用户审阅）**：① L2TabNav 悬空 aria-controls（Radix trigger 恒渲染指向不存在 id，三域一致；阶段 7 无障碍终验评估降级 nav/aria-current）；② text-warning 作 12px 文字色 ≈3.3:1（--warning 只按大文本调档的边界问题，并入阶段 7 token 复审）；③ 触控目标 <24px（chip 22px/checkbox 16px/switch 20px，桌面鼠标风险低，阶段 7 ui-kit 统一评估）；④ stop/end 失败 toast 直出 String(error)（归 D11 待办）；⑤ denoiseEstimate 仅解析 MB 字符串（fail-silent 可接受，后端单位不可控再补）；⑥ 结果表无表头（内容自描述；加排序/列语义前先补 thead）。另：controls.css `.top-nav` 段与 animations.css `top-nav-icon-draw` 段已成死代码，并入阶段 7 CSS 清扫清单（`.mantine-SegmentedControl-*` 段仍服务 settings 两页，勿提前删）。

**验证**：check / i18n 523 键 / build 861ms 全绿；浏览器快验——denoise pill 可见文字、7 个 role=group、Separator flex-1、双 NumberField + Textarea 的 aria-describedby、chip 选中态 accent 色对（#086acc on #EAF4FF）全部生效。表格交互（筛选+无损选择、两步确认）需真机数据验证，列入阶段 7 真机复验点。

## D23 · 阶段 5 决策与验收（media 域 12 tsx + 吸顶工具栏）

**迁移决策**：① 工具栏吸顶落地 D16 承诺——`sticky top-0 z-20 -mx-5 -mt-5 px-5 pt-5 pb-3`（负边距抵消容器 p-5，静止/滚动两态无缝，圆角由 workspace-surface 容器裁剪），z-20 与 Portal 到 body 的 dialog/tooltip/select（z-50）无冲突；② MediaCommandPanel 与 ExpertCommandPanel 同构（isPr 分支差异），PR 模式纯说明文案、其余模式预览↔专家编辑切换；③ 检视/检查弹窗 ScrollArea 双层限高（280/360px）；④ containers undefined 时隐藏容器下拉（gif/逐帧/封面页不出现无意义控件）、单操作页隐藏操作选择器、PR 页去高级区——渐进披露减法成立。

**验收裁决（双 review：UI P1×3/P2×4/P3×5 + UX P1×1/P2×7/P3×6，合并后 P1×3/P2×7 全修、P3 修 4 记档 3）**：

- **P1×3**：① `parentDir()` 迁移手误写成 `slice(index + 1)` 与 fileName 相同——列表渲染「video.mp4 video.mp4」，同名文件（递归扫描常态）消歧信息全丢；改取目录段末段（basename of dir），dir 为空不渲染灰字。② 吸顶工具栏 `bg-background/95` 用错图层——工作区表面是 `--card`（workspace-surface），轨道色在卡面上形成 3-4% 灰度色带；改 `bg-card/95` 对齐所在表面，并补 `border-b border-border/40` 供滚动时辨认边界（静止态淡线与 L2TabNav 间距可接受）。③ inspect IconButton 漏 `size="sm"`（36px 与相邻 32px 提交钮错位），补齐。
- **P2×7**：① submit 禁用原因 Tooltip（span 桥，`media.submit.needFiles`；对齐 bilibili/network/music 三域惯例，media 是最后一个缺口）；② 8 处 hint 死关联修复——outputDirectory 补 `inputId`/`describedById` 透传（props 本为此而建）+ streamIndex 真 hint 接 hintId；**placeholder 型提示（startTime/duration/crop/videoBitrate/sampleRate/volume 共 6 处）读屏不播报**，用组件内 `p.sr-only[id]` 建 describedby 关联（视觉零变化）；③ OptionGroup 补 `role=group + aria-labelledby`（三域共用的分组语义，bilibili/network 同步收益）；④ 专家模式退出焦点坠 body——MediaCommandPanel 与 ExpertCommandPanel 同修：不用 autoFocus（高级区展开时按钮 mount 会抢焦点），改 `prevExpertRef` 追踪 true→false 转移后 focus「编辑命令」；⑤ previewError 出现自动展开高级区 + 「编辑命令」禁用 Tooltip（`media.command.waitingPreview`，有错误时直接播报错误文案）——media 唯一「无路可走」状态解除；⑥ InspectionDialog 补 DialogDescription（`media.inspection.description`，与 D20 ProbeDialog 裁决归一，删 `aria-describedby={undefined}` 压制写法）+ CopyIconButton（媒体信息是典型"贴给别人看"内容）；⑦ 文件移除后焦点管理——删除行 unmount 前记 index，requestAnimationFrame 后焦点落同位邻近行，删空经 `onEmptied` 回调把焦点交回拖放区（D18 focusNeighbourTask 同源模式）。
- **P3 修 4**：dragActive `bg-primary/10 text-primary` → `bg-accent text-accent-foreground`（D22 废弃色对，border-primary 保留作拖放强调）；IconX 14→16；dropzone 删 aria-label 用可见文字作 accessible name（Label-in-Name：aria「与文件夹」vs 可见「或文件夹」不同字）；MediaCommandPanel gap-1.5 → gap-2.5 对齐 ExpertCommandPanel 节奏。
- **记档 3（交用户审阅）**：① 工具栏静止态下缘距 28px（pb-3 12px + gap-4 16px）vs 四页 16px——pb-3 是吸顶态模糊底喘息补偿，保留并记档；② dropzone IconUpload 30px 配 stroke 1.4 是全应用唯一非 1.7/1.8 描边——大图标光学减重意图，保留记档；③ expertMode 时 submit 恒可用语义成立（manual 分支不消费 inputs，命令文本是唯一事实源；三重警示已足），与 bilibili 同构，双 reviewer 一致认可维持现状。另有 3 项既有行为记录不阻断：页签切换静默清空文件列表（HEAD 同逻辑，体验池候选：按页签保留 inputs）、文件夹扫描无进行时反馈、expertMode 下禁用字段原因播报（归阶段 7 无障碍终验）。
- **NumberField 键入越界静默收值**（speed min 0.25 可键入 0）：原生 number input min 只约束步进，Mantine NumberInput 失焦 clamp 行为迁移后丢失；修在 `number-field.tsx` onBlur 归一化处可一处修全域（network 两处同病）——**归阶段 7 与「数字框步进」真机复验一起评估**，不在本域单独动验收过的 ui 件。

**验证**：check / i18n 526 键 / build 737ms 全绿；浏览器 DOM 断言——工具栏类与 32px 双钮、submit 禁用桥、dropzone 无 aria-label、3 个 role=group 指向标题、7 处 describedby 全部指向存在元素、6 处 sr-only hint、编辑命令 Tooltip 桥全部生效。MediaFileList 焦点链、parentDir 渲染、检视弹窗描述与复制需真实文件数据，归阶段 7 真机复验点（拖含子目录文件夹验证同名消歧）。截图服务本轮超时，双主题视觉复验并入阶段 7 终验收。

## D24 · 阶段 6 迁移决策（settings 域 9 文件 + 语义映射表）

**迁移范围**：SettingsShell/SettingsBlocks/GeneralSettingsPage/DependenciesSettingsPage/AboutSettingsPage/DependencyStatusPanel/StartupTipsModal/SplashScreen/AppBrand 全量重写；`ui/segmented` 扩展 `icon?: ReactNode`（按钮转 flex 布局）。**至此页面层 Mantine 组件清零**，src 内仅剩 main.tsx provider import、mantine-compat.css、theme/index.ts 三个阶段 7 目标；`@mantine/carousel` 随 StartupTipsModal 迁出后全局零消费（embla-carousel-react 首次直用：`useEmblaCarousel({ loop: false, watchDrag: false })` + select 事件同步 React state）。

**语义映射表（后续对照基准）**：ActionIcon variant default size input-sm → IconButton outline sm｜Button variant default → outline｜Button transparent gray → ghost｜ActionIcon filled green（下载更新）→ IconButton primary（D12 品牌蓝强调，放弃绿色语义——更新动作是全 app 唯一绿色 filled 钮）｜Badge transparent yellow/blue/teal → warning/primary/success｜Button compact-sm light → sm secondary｜compact-sm subtle → sm ghost｜SegmentedControl w=320 → w-80 + 选项 flex-1 等分｜Mantine Card radius md(8px) → ui/card 统一 rounded-xl(12px)。

**CSS 同步清理（阶段 7 清单提前完成部分）**：controls.css 删 `.top-nav/.app-header-icon/.history-clear-all/.about-action/.dep-refresh` hover 段与 `.mantine-SegmentedControl-*` 段（零引用确认）；about.css `[data-mantine-color-scheme="dark"]` → `.dark`、`--mantine-color-default-border` → `--border`；animations.css dots-loader 的 mantine 圆角/品牌色变量 → `9999px`/`var(--primary)`。

## D25 · 阶段 6 验收裁决与修复记录

双 review（UI：P2×3/P3×7 + UX：P2×2/P3×7，均无 P1——平移忠实度双高评）合并裁决：P2×4 全修、P3 修 8、记档 9：

**必修 4 项**：① Segmented 固定宽轨道不填充（原 Mantine w=320 等分）——`segmented.tsx` 选项加 `flex-1 justify-center min-w-0`，一处修全域（自然宽容器惰性无副作用）；② StartupTipsModal 缺 DialogDescription（违反 D23 归一裁决，4 个既有 dialog 全带描述）——补 `startup.description` 词条（zh「三则影响下载质量的提示，翻页查看」）；③ 更新下载按钮 `disabled={downloading}` 丢 spinner（原 Mantine loading）——改 `loading={downloading}` + accessible name 动态化（下载中播报 downloading/downloadingProgress 词条）；④ 表单名称关联缺口——三个 Segmented radiogroup 补 `aria-label`（对应行标题词条）、输出目录/代理 Input 补 `aria-label`。

**低成本 8 项**：SettingsBlocks 标题 px-2.5/gap-2.5 精确等值原版｜About app 图标 rounded-md→rounded-sm（原 radius sm）｜团队链接钮 size="sm" + 恢复居中 + gap-8（32px 紧凑档 + 原版对齐/间距）｜quote-hero mt-8/gap-2.5/leading-[1.8] 三处对齐原版｜StartupTipsModal 页内 gap-3、底栏 mt-2.5（原 sm/xs 节奏）｜DependenciesSettingsPage 告警块几何对齐 music alert（gap-2.5 rounded-lg px-3.5 py-2.5 bg-_/5 border-_/30 统一架构，warning 变体）｜Progress aria-label 拼 `工具名 · 状态`（D18 惯例，多工具队列可区分）｜Cookie 保存校验改 trim 值（whitespace-only 绕过校验修复，HEAD 同病顺手修）。

**死键清理 6 个**：common.selectDirectory、bilibili.login.signedIn、music.outputDirectory.aria、settings.about.downloadLatest、shell.feedback、app.updateAvailableNotice（全仓扫描零引用，zh+en 同删）——526→521 键。词条净变化：+startup.description。

**记档 9 项（交用户审阅）**：① footer 保存区条件渲染布局跳动（HEAD 同病；常驻 invisible 占位是候选改进）；② 下载中进度 Tooltip 降级为悬停显示（原 Mantine opened 强制常显；ui/tooltip 无受控 open，扩展属阶段 7 评估；loading spinner 已恢复基本可见性）；③ embla 无键盘方向键翻页（原 Mantine Carousel 同样无，prev/next 按钮链路完整）；④ Cookie 行删除焦点坠 body（key={index} 渲染，D23 的 rAF 邻行焦点模式可复用）；⑤ 语言/依赖偏好切换 disabled 瞬态焦点坠（HEAD 同，极短）；⑥ aria-live 块随 installing 挂载致首条「准备中」不播报（live region 需先于内容存在的平台约束，后续百分比正常播报 + toast 兜底）；⑦ 安装中全行禁用焦点丢失（app 既有模式，待全应用统一焦点恢复方案）；⑧ SplashScreen 读屏静默（HEAD 同，启动窗口短）；⑨ SettingsRow 左右 gap-6（24px）较原版 xl（32px）保守——窄窗让位更安全，保留。

**验证与真机复验点**：check / i18n 521 键 / build 943ms 全绿。浏览器验证：AppBrand SPAN 渲染、DOM 层 mantine 类零残留、StartupTipsModal 挂载/三页结构/翻页按钮/dismissForever 持久化（localStorage 写入 + 关闭链路——data-state=closed 与手动 animationend 卸载均实证）。**IAB 环境限制记档**：浏览器面板被遮挡时 Chromium 冻结渲染管线（截图超时、embla rAF 卡 0、CSS 动画 animationend 不派发三现象同源），Radix dialog 卡在 closed 态不卸载属环境问题非代码缺陷；settings 三页在浏览器因无 Tauri 后端渲染空白（App.tsx renderSettingsArea `if (!settings) return null` 既有行为）。**真机复验点新增**：首启弹窗翻页动画与关闭、三个设置页双主题视觉、主题/语言 Segmented 等分形态（zh/en 双语）、依赖面板安装流 spinner/进度、About 更新下载 spinner、Cookie 行增删。

## D26 · 阶段 7：Mantine 移除与终态收敛

**移除清单（全部完成）**：① `main.tsx` 删 MantineProvider/`theme` import/mantine-compat.css import（App 与 AppToaster 直接挂根）；② 删 `src/theme/` 目录（createTheme + blue/dark 色板——design-system.css 已自成色板）；③ 删 `styles/tokens.css`（15 个 app 变量 14 死，唯一活变量 quote 渐变迁移，见下）；④ 删 `styles/mantine-compat.css`（D21 层化方案随宿主移除，Tailwind 层序恢复默认，utilities 仍最后）；⑤ `lib/theme.ts` 删 `data-mantine-color-scheme` 双写与 `mantine-color-scheme-value` 写入（**读侧迁移保留**——老用户首启仍从旧 key 迁移偏好，isColorScheme 三值校验不变）；⑥ `index.html` 防闪脚本删 data 属性写入，并**修正迁移 key 笔误**：原读 `mantine-color-scheme`（不存在，等于防闪对老用户失效首帧闪白），对齐 theme.ts 的 `mantine-color-scheme-value`；⑦ 卸载 `@mantine/core`/`carousel`/`hooks`/`notifications` 四包。终态：package.json 与运行时 DOM 零 Mantine 痕迹，仅 lib/theme.ts 保留 LEGACY key 读取与两处注释。

**quote 渐变 token 迁移（硬阻塞解除）**：about.css 的 `.quote-hero-mark` 渐变原依赖 tokens.css 的 `--app-quote-gradient-*`（指向 Mantine 色板变量）。值固化进 design-system.css：light `#0a84ff`（blue[6] 品牌蓝）→ `#15aabf`（cyan-4）、dark `#5ca9ff`（blue[4] 提亮）→ `#66d9e8`（cyan-3）。

**NumberField 失焦 clamp 落地（D23 移交评估项闭环）**：键入越界值失焦收敛到 min/max 边界（对齐旧 Mantine NumberInput 行为）；原生 min/max 属性为 `string | number`，clamp 前收窄（无效/空串 → undefined 跳过 clamp），未传 min/max 的调用方零影响。

**遗留评估项终审结论（D22/D23 记档项，维持原判）**：text-warning 12px 文字 ≈3.3:1（--warning 按大文本调档，浅色正文用 warning 需换 token，现无处使用——留档）；触控目标 <24px（chip 22px/checkbox 16px/switch 20px，桌面鼠标风险低）；L2TabNav aria-controls 悬空（无 TabsContent 架构的固有限制，tablist 语义本身完整）；焦点环两档惯例（ring-ring/30 字段 vs ring-ring 按钮）维持；MediaCommandPanel 与 ExpertCommandPanel 合并候选（仅 isPr 分支差异）留作后续重构。

**D18 移交项结案：destructive 文字深档 token**——浅色 `--destructive: #e03131` 对白底 ≈4.5:1 压线（大文本达标；正文级用法 6 处：依赖错误详情/命令预览错误/任务失败脚注/池满载提示/失败日志/错误徽标，其中日志已用 text-xs+font-medium 缓解）。token 表中已有 `--destructive-hover: #c92a2a`（≈5.5:1）可作深档基准，但收尾阶段引入新 token 涉及 6 处替换 + 双主题真机复验（IAB 截图通道当前不可用），风险与收益不成比例。**结论：迁移按现状收尾；建议合并后立独立 ticket**——引入 `--destructive-text` 深档（light `#c92a2a`，dark 沿用现值或 `#fa5252`），替换 6 处正文级用法并真机复验。

**D25 记档②结案：下载进度 Tooltip 受控 open**——原 Mantine `opened` 强制常显在迁移时降级为悬停显示。**结论：维持现状**——按钮 `loading` spinner + accessible name 动态化（下载中/进度词条）已恢复状态可见性与读屏播报；ui/tooltip 为此单点需求扩受控 open API 不成比例，出现第二个"必须常显"场景时再扩。

**浏览器回归（IAB 环境限制记档见 D25）**：五页（bilibili/network/music/media/tasks）DOM 断言全绿——无空渲染、input 14px、按钮 32px 紧凑档、combobox 数量正确、`[class*="mantine-"]` 全页 0；双主题变量链路（.dark toggle → --card/--background 切换）实测生效；html 无 data-mantine-color-scheme。截图与动画视觉复验归真机（tauri:build 产物验证）。

**真机复验清单**：终审时发现本条初版清单漏收 D16/D18/D19/D20/D21/D22/D23/D25 的移交项，已全部补齐并归并为权威清单移至 **D27 真机复验清单**（按页域分组，含出处标注），本条不再单独维护。

## D27 · 终审验收裁决与修复记录（UI/UX 终审后）

**终审概况**：UI 终审**通过**（P2×2 + P3×8）；UX 终审判定跨域一致性高，代码侧仅 P2×1（ExpertCommandPanel 裸禁用与 MediaCommandPanel 的跨域双标），P1×3 均为文档缺口（D26 真机清单漏收 D19-D23 移交点、索引表止于 D16、缺记档汇总索引）。裁决：代码小修本轮顺手修掉，文档缺口由本轮文档大修补齐（即本条 + 索引表扩展 + 文末汇总索引），其余 P3 记档不修。

**验收修复 6 项**（`pnpm check` / i18n 521 键 / `pnpm build` 全绿）：

1. **OutputDirectoryField 两个 IconButton 包 `span.inline-flex` 桥 Tooltip**（P2-1 UI）——禁用态悬停无反馈：IconButton 基类 `disabled:pointer-events-none` 阻断 hover，Tooltip 无法跟随；span 桥为全应用既定模式。
2. **ExpertCommandPanel「编辑命令」禁用时补 Tooltip span 桥**（P2-1 UX）——`previewError ?? t("common.submitWaitingPreview")`，复用既有词条，消除与 MediaCommandPanel（D23⑤ 同款桥）的跨域双标；editButton 提取为变量按 preview 有无条件包裹。
3. **TasksPage 清空历史 IconTrash 补 `stroke={1.8}`**（P2-2 UI）——全仓最后一个漏 stroke 的 14px 图标。
4. **CollapsibleSection chevron 补 `stroke={1.8}`**（P3-1 UI）。
5. **`hover:text-destructive` / `hover:text-secondary-foreground` 冗余删除 ×2**（P3-2 UI，TasksPage / BilibiliPageHeader）——hover 态由 `hover:bg-destructive/10` 完成切换，text 类冗余且前者与自身 `text-destructive` 重复（与 D22 同类裁决）。
6. **GeneralSettingsPage 添加 Cookie 的 IconPlus 15→14**（P3-4 UI）——归一 14px/1.8 紧凑档惯例。

**P3 记档不修（7 项，交用户审阅）**：① 破坏性轻按钮三变体并存（ghost-destructive / outline-destructive / 裸 text-destructive+hover:bg）——语义同为「低强调破坏动作」，实为密度梯度非漂移；统一变体属 ui-kit 演进另立。② 设置页保存 CTA（36px default）与行内紧凑钮（32px）并存——主次层级意图保留。③ Sidebar 徽标色对（依赖缺失 warning 黄 / 任务运行 primary 蓝）——语义不同源色，非同组误配。④ About 页 text-primary 强调文字（quote 与版本号）——营销页语义，不属「语义色不上正文」的正文场景。⑤ LogoutButton hover 切换用 onMouseEnter/Leave（无 focus 等价）——键盘/触屏路径不受影响，确认流由 click 打开的 dialog 承担。⑥ UX 终审 A3 六个焦点场景——同属「全应用统一焦点恢复方案」候选（汇总索引 33/42）。⑦ MediaTaskOptions 12 字段平铺 vs 分组——阶段 5 UX 已评估平铺可达，重组留体验池。

**两项移交结案**（详细论证见 D26）：D18 destructive 文字深档 → 维持收尾 + 合并后 ticket 建议；D25 记档② 下载 Tooltip 受控 open → 维持现状不扩 ui/tooltip API。

**文档大修（本条随附完成）**：索引表补齐 D17-D27 并扩展状态语义（已执行/已消解/记录待办 + 闭环去向指向）；D11/D13/D15/D16/D18 正文补闭环标注；全文档记档项汇总为文末「记档项汇总索引」（初版 43 项，D29 审计后追加至 46）；真机复验清单归并为下方权威版。

**真机复验清单（权威终版，用户侧执行；括号为出处）**：

_Shell / 全局_

- 侧栏折叠/展开动画观感、折叠态任务黄点对比度（D14/D16）
- 1366×768 窗口四页吸顶工具栏滚动表现（D16③/D23/D28——bilibili/network/music 吸顶为 D28 新增）
- 弹窗在 tauri 窗口的打开/关闭链路复核（D13 消解复核）
- NVDA 播报抽查：radiogroup 命名、dialog 描述、Progress 工具名、expertMode 禁用字段原因（D16/D18/D23/D25）
- 通知中文读屏播报（需 sonner 升级后回归，D7 已知限制）

_启动 / 设置_

- 首启弹窗：翻页动画、末页 dismiss、关闭动画、「不再提示」持久化（D25）
- 三个设置页双主题视觉（D25——浏览器无后端无法走查）
- 主题/语言 Segmented 等分形态（zh/en 双语）（D25）
- 依赖面板安装流：spinner、进度、aria-live、多工具队列播报（D25/D18）
- About 更新下载 spinner 与下载中 Tooltip 表现（D25）
- 设置页 Cookie 行增删与焦点（D25）

_bilibili / network_

- Bilibili 模式下拉选择（D19⑤/D20）
- Cookie 下拉：含「添加」项与清除钮（D19③/D20）
- QR 登录：扫码成功流、QR 过期表现（D20）
- 登出确认流：hover 图标切换 + 确认 dialog（D19④/D20）
- 探测结果弹窗滚动与复制（D20）
- network 数字框步进与越界 clamp（D19⑤/D26）

_music / media / tasks_

- L2TabNav 点击与键盘切换（Arrow/Enter）、chips 点击（D21⑦）
- 搜索结果表格交互：筛选、行选择、无损选择、「只选无损」、清空两步确认（D22）
- 专家模式还原确认交互感受（D20①，bilibili/music 同构）
- media 文件列表：同名消歧（拖入含子目录文件夹）、移除焦点链、删空回拖放区（D23）
- 检视弹窗：描述、滚动、复制（D23）
- media/music 双主题视觉终复验（D23/D25 截图超时移交）
- tasks 批量删除部分失败核对（后端返回成功子集行为假设）（D18）
- 数字框越界 clamp 全域抽查（如 speed 键入 0 失焦归 0.25）（D26）

---

## 记档项汇总索引

全部「记档不修 / 待办 / 移交」事项的唯一汇总表（UX 终审 P1-3 要求建立）。状态四种：**已结案**（终审给出结论）、**已闭环**（移交点已在后续阶段处理）、**移交终验**（列入 D27 真机清单）、**维持/候选**（有意保留或留作产品迭代输入，非缺陷）。

| #   | 出处 | 主题                                                             | 状态/建议动作                                                             |
| --- | ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | D16  | 折叠钮 collapse/expand 双词动态 label                            | 维持不做（aria-expanded 已足）                                            |
| 2   | D18  | destructive 文字深档 token                                       | 已结案：维持收尾 + ticket 建议 light `#c92a2a`（D26）                     |
| 3   | D18  | cancel pending 本地态                                            | 维持（IPC 窗口极小）                                                      |
| 4   | D18  | 池信息拉取失败静默消失                                           | 维持（无后端环境合理降级）                                                |
| 5   | D18  | SettingsSection/CollapsibleSection 合并                          | 待第三种折叠变体出现再合并 density prop                                   |
| 6   | D18  | motion 规格（导航 240ms 曲线 / 内容折叠 200ms ease-out）         | 已定规格，沿用                                                            |
| 7   | D18  | music onRerun 页内等价入口                                       | 已闭环（D21⑤：入口在任务卡，假设成立）                                    |
| 8   | D18  | deleteTasks 部分失败行为假设                                     | 移交终验（D27 清单）                                                      |
| 9   | D20  | 专家模式还原二次确认                                             | 移交终验（真机感受后定，D27 清单）                                        |
| 10  | D20  | Segmented 组禁用 aria-disabled                                   | 维持（视觉半透明已足，读屏语义存争议）                                    |
| 11  | D20  | bilibili QR 登录轮询事件链路                                     | 范围外（行为级，与迁移无关）                                              |
| 12  | D20  | Textarea autosize 仅窗口 resize 时重算                           | 维持（内容驱动已覆盖主场景）                                              |
| 13  | D20  | QR 过期自动重发                                                  | 功能增强，产品侧另议（过期表现列 D27 清单）                               |
| 14  | D22  | L2TabNav 悬空 aria-controls                                      | 已结案：维持（D26，tablist 语义完整）                                     |
| 15  | D22  | text-warning 12px 文字 ≈3.3:1                                    | 已结案：留档（D26，浅色正文无处使用）                                     |
| 16  | D22  | 触控目标 <24px（chip/checkbox/switch）                           | 已结案：维持（D26，桌面鼠标风险低）                                       |
| 17  | D22  | stop/end 失败 toast `String(error)` 直出                         | 并入 D11 ticket 一并处理                                                  |
| 18  | D22  | denoiseEstimate 仅解析 MB 字符串                                 | 维持（fail-silent，后端单位不可控再补）                                   |
| 19  | D22  | 结果表无表头                                                     | 加排序/列语义前先补 thead                                                 |
| 20  | D22  | controls.css / animations.css top-nav 死段                       | 已闭环（D24/D26 已删除）                                                  |
| 21  | D23  | 工具栏静止态下缘距 28px                                          | 已消解：D28 用户裁决统一后，四页页头均为 28px 节奏                        |
| 22  | D23  | dropzone IconUpload stroke 1.4                                   | 保留（大图标光学减重，全应用唯一例外）                                    |
| 23  | D23  | expertMode submit 恒可用                                         | 维持（双 reviewer 认可，与 bilibili 同构）                                |
| 24  | D23  | 页签切换静默清空文件列表                                         | 候选：按页签保留 inputs（HEAD 同逻辑，体验池）                            |
| 25  | D23  | 文件夹扫描无进行时反馈                                           | 候选（既有行为，体验池）                                                  |
| 26  | D23  | expertMode 禁用字段原因播报                                      | 移交终验（D27 清单 NVDA 抽查扩展）                                        |
| 27  | D25  | footer 保存区条件渲染布局跳动                                    | 候选：常驻 invisible 占位（HEAD 同病）                                    |
| 28  | D25  | 下载进度 Tooltip 悬停显示（原强制常显）                          | 已结案：维持（D26，spinner + 动态 name 已足）                             |
| 29  | D25  | embla 无键盘方向键翻页                                           | 维持（prev/next 链路完整，原版同样无）                                    |
| 30  | D25  | Cookie 行删除焦点坠 body                                         | 候选：D23 rAF 邻行焦点模式复用                                            |
| 31  | D25  | 语言/依赖偏好切换 disabled 瞬态焦点坠                            | 维持（HEAD 同，极短）                                                     |
| 32  | D25  | aria-live 首条「准备中」不播报                                   | 维持（live region 需先于内容存在的平台约束，toast 兜底）                  |
| 33  | D25  | 安装中全行禁用焦点丢失                                           | 候选：全应用统一焦点恢复方案                                              |
| 34  | D25  | SplashScreen 读屏静默                                            | 维持（HEAD 同，启动窗口短）                                               |
| 35  | D25  | SettingsRow gap-6 较原版 xl 保守                                 | 保留（窄窗让位更安全）                                                    |
| 36  | D27  | 破坏性轻按钮三变体并存                                           | 记档：密度梯度非漂移；统一变体待 ui-kit 演进                              |
| 37  | D27  | 设置页保存 CTA 36px 与行内钮并存                                 | 记档：主次层级意图保留                                                    |
| 38  | D27  | Sidebar 徽标色对（warning / primary）                            | 记档：语义不同源色，保留                                                  |
| 39  | D27  | text-primary 强调文字（About quote/版本号）                      | 记档：营销页语义，保留                                                    |
| 40  | D27  | LogoutButton mouseenter 触发（无焦点等价）                       | 记档：确认流由 click dialog 承担，保留                                    |
| 41  | D27  | MediaTaskOptions 12 字段平铺                                     | 记档：可达性已评估，重组留体验池                                          |
| 42  | D27  | UX 终审 A3 六个焦点场景                                          | 候选：并入「全应用统一焦点恢复方案」（与 33 同池）                        |
| 43  | 补记 | Cookie 删除 / media 文件移除无二次确认                           | 有意维持：单项低风险易恢复，两步确认保留给批量/历史级操作                 |
| 44  | D29  | tasks store init 重试路径可能双订 task-event                     | 候选：catch 里先 unlisten 再复位 initStarted（并入 D11 ticket，既有缺陷） |
| 45  | D29  | 全局 store 监听无 unlisten（bilibili-login/music-session/tasks） | 有意设计（应用级单例，防双订守卫已有）；可选：HMR 热更清理                |
| 46  | D29  | 请求 struct `#[serde(default)]` 静默默认值                       | 记档：前端拼错键名不报错；本次逐键核对无问题，后续改动警惕                |

以上全部记档项均已随对应阶段验收裁决，无未裁决项；「候选」为后续产品迭代输入而非缺陷。

## D31 · 图标库迁移 Tabler → Phosphor（用户裁决：默认 Regular）

**背景**：Mantine 摆脱后图标仍用 `@tabler/icons-react`，用户要求统一为 Phosphor。初议 Light 系列，用户裁决「直接默认 regular」——不做 Light、不做小尺寸自动升档封装，全部组件默认 weight（Regular）。

**映射**：67 项 Tabler→Phosphor 语义映射（IconX→X、IconChevronDown→CaretDown、IconLoader2→CircleNotch、IconLayoutSidebarLeft{Collapse,Expand}→ArrowLine{Left,Right} 等）经幂等脚本一次性落位（词边界用 lookaround，见工程教训）。四个特例：
- `IconActivity`→**Pulse**：Phosphor 无 Activity，心电线即 Pulse（任务页「进行中」统计块）。
- `IconCancel`→**Prohibit**：任务 canceled 态为中性灰，须与 failed 态红色 XCircle 形状区分（圈禁符号 vs 叉号）。
- `IconClock`→`Clock`、tasks 导航 `ListChecks`→**Stack**：后者为用户走查时追加裁决（「task 的 icon 换成 layer」；Phosphor 层叠图标实名 Stack）。
- 通知四语义图标保留 `weight="fill"`（notifications.tsx）、checkbox 勾选/半选用 `weight="bold"`（12px 小尺寸可读性）——Regular 为主的例外，逐处显式标注。

**结构决策**：
1. Tabler 的 `stroke={n}` 笔画粗细 prop 全仓删除（Phosphor 为 fill 路径体系，无此概念）；`type Icon as TablerIcon` 别名改为 Phosphor 原生 `Icon` 组件类型（navigation/Sidebar/TaskCard 三处 import 直用）。
2. **Sidebar 描线动效退役**：原 strokeDasharray 划线（迁自旧 TopNavigation）依赖 stroke 路径，Phosphor fill 路径不兼容；改为 `enterIcon` 淡入 + scale(0.92→1)，时长 240ms 复用折叠主曲线 EASE——图标入场与侧栏收放共用一套动效语言。跳过逻辑不变（同页重复导航 / tasks 运行中不播）。
3. **依赖审计**（用户要求「去掉无关依赖」）：32 个依赖全量 `git grep` 引用计数，仅 `@tabler/icons-react` 零引用 → 卸载；零引用假阴性四项保留——`@tauri-apps/cli`（`pnpm tauri` 脚本二进制）、`@types/*`（tsc 类型）、`prettier`（format 脚本）。

**工程教训（重要）**：首轮批量替换脚本 `new RegExp(\`\\b${from}\\b\`)` 经 shell/JSON 双层转义后 `\b` 退化为**退格字符（U+0008）**，词边界永不匹配——33 个文件「import 路径换了、符号全没换」且静默无报错（touched 计数被路径替换撑满，掩盖了符号替换空转）。复现排查后重写脚本：**跨层传递的正则严禁携带 `\b`**，词边界一律用 `(?<![A-Za-z0-9_$])…(?![A-Za-z0-9_$])` lookaround（零反斜杠）；脚本用 Write 工具直写文件绕开 shell 转义层。

**验证**：`pnpm check` 双 tsc 全绿、`pnpm i18n:check` 521 键通过、`pnpm build` 通过（452ms，chunk 体积警告为既有问题）。IAB 走查：五页导航图标 21–34 个 SVG **0 broken**、viewBox 统一 256×256（Phosphor 签名）、path fill 计算值继承 currentColor；入场动效以 `document.getAnimations()` 探针实证（点击导航即出现 target=svg 的 WAAPI Animation）；Tasks→Stack 经 HMR 复验。截图通道（IAB capture guest 失败）未用于本条，全部以 DOM/计算样式取证。

**真机复验（并入 D27 清单）**：TaskCard 七态状态图标（Prohibit/Clock/旋转 CircleNotch 等在真实任务卡上的观感）、通知 fill 语义图标的视觉重量、暗色主题下图标取色、折叠态 sidebar 图标居中。



## D30 · Effect 白名单制度全面落地（用户提供《React 状态管理与 Effect 使用规范》，Default Deny 清理）

**背景**：用户提供完整规范（Effect 白名单五类准入、十条禁止行为、可派生数据不入 state、事件驱动状态迁移、禁止规避手段），要求按规范全面清理 useEffect/useMemo/useLayout，并找出所有隐藏状态机精简冗余状态。规范优先于 AI 一般 React 习惯。

**清点结论**：全仓 30 处 Effect（重构后）+ 41 处 useMemo/useCallback。useMemo/useCallback 无一违规（无渲染期副作用、无惰性初始化副作用；Sidebar/TasksPage 的 localStorage 纯读初始化为合规纯读）。原 67 个 grep 命中中实际违规 11 类，全部重构。

**违规重构清单**（禁止行为 → 修法）：

1. **App 语言镜像 Effect**（settings.language → setLanguageChoice 链式同步）→ 移入 `useBackend.refreshSettings` 数据到达事件；写入路径唯一（changeLanguage 乐观更新+失败回滚），Effect 删除。
2. **App 两个通知-once 状态机**（`dependencyNotifiedRef`/`mirrorUpdatesNotifiedRef` + Effect 观察加载态）→ 通知移入 `useBackend` 取数 `.then`（数据到达即事件），once 标志随行；App 删 2 Effect + 2 ref。
3. **WorkspaceSessionHost visit/evict 双 Effect**（route/sessions 观察式 GC）→ App 新增 `navigate()` 唯一路由入口：visit + bilibili 登录态刷新 + 可释放会话驱逐全部由导航事件直接驱动；WorkspaceSessionHost 回归纯渲染。
4. **seed 恢复 Effect ×4**（bilibili/network/media/music 的 seed→表单/专家文本/降噪）→ **架构改造**：种子交付并入 workspaces store（session 携带 `seed` 字段，`deliver()` 写入 + generation+1 重挂，`evictIfReleasable` 清除），四个 hook 改挂载初始化器恰好消费一次；`onSeedConsumed` 回调链与 App 级 `taskSeed` state 整体删除。打码参数警告（bilibili/network）移到点击「重跑」时就地发出。
5. **media `draftPage` 渲染期重置**（两处渲染期观察 page prop 写 state）→ `switchPage(next)` 事件：L2TabNav onChange 直调 hook 方法（重置 inputs/form/operation/advanced/inspection/专家文本/预览），再调 onNavigatePage。
6. **三处「默认输出目录填表」Effect 链**（music fillDefault + draft hook mount resolve + bilibili/network/media onDefaultOutputDirectory 回调）→ 整体删除：后端四个 adapter 均把空 outputDirectory 当默认位置（bilibili `push_value` 空跳过 / network `CwdPolicy::Inherit` / media 回退源目录 / music 提交层 `|| null`），草稿不再烘焙默认值（用户改默认目录后存量草稿自动跟随，行为改进）。
7. **GeneralSettingsPage/DependenciesSettingsPage 草稿镜像 Effect**（changingLanguage/Preference 复位时镜像回 settings.*）→ 事件内乐观更新 + catch 直接回滚；`changing*` 保留为 in-flight 标志（不再作 Effect 依赖）。
8. **DependencyStatusPanel `selected` 重置 Effect**（队列清空 → 重置为建议集）→ 「带键覆盖」派生：`selectionOverride = {key: suggestedKey, tools}`，建议集变化天然使覆盖失效（安装期间勾选框禁用 ⇒ 覆盖只产生于建议集一致时段，语义等价）。
9. **DependencyStatusPanel `opened` 强制展开 Effect** → `opened = userOpened ?? hasProblem` 派生（问题状态缺依赖/有更新/安装中）。
10. **MusicPage `resultsOpen` Effect**（searchResponse 到达 → 展开）→ 反转派生 `resultsCollapsed`（初值收起），展开由 run() 搜索事件驱动。
11. **music/media 高级区错误联动 Effect**（prepared.error/previewError → setAdvancedOpen(true)）→ 渲染期派生 `opened = advancedOpen || error !== null`。
12. **bilibili active→refreshLoginStatus Effect** → App.navigate 进入 bilibili 时刷新。

**有意的行为修正**（等价性推演后接受的三处，需用户知悉）：① music 发起搜索即展开结果面板（原：响应到达才展开）——搜索中即有反馈；② 依赖面板「无问题自动收起、用户收起后新问题不再强开」（原：问题出现即强开、装完仍保持展开）——「没有问题就收起」更符合直觉，重检按钮保留缺依赖时展开；③ 依赖面板建议集不变时不再强制重置勾选（原：队列清空一律重置；安装期间勾选禁用 ⇒ 实际值恒等）。

**保留的 Effect（白名单归类，逐条注释落码）**：② 外部事件订阅 ×7（update-download-progress / dependency-download-progress / dependency-install-finished / webview onDragDropEvent / onLanguageChanged / StyleguideLayer keydown / store init 内 listen）；③ 命令式同步 ×5（embla on/off+reInit、textarea autosize、焦点管理 ×2、MediaDropzone latest-ref、draft hook onRetainRef）；④ 生命周期 ×4（卸载清 timer ×3、App booted 一次性推进——刻意让 SplashScreen 至少存在一帧）；⑤ 外部系统同步 ×9（localStorage 草稿/降噪持久化 ×5、预览防抖取数 ×2、encoders 拉取、pool definitions、启动更新检查、挂载三连取数）——⑤ 类均带「白名单⑤ + 必要性」注释，**按规范需用户批准，随本条记档一并呈请**。

**删除的死状态机**：`taskSeed`（App state）、`onSeedConsumed`（4 hook + 4 组件 props）、`consumeTaskSeed`、`draftPage`、`resultsOpen`、`dependencyNotifiedRef`×2、`workspaces.reset()`（无调用方，deliver 覆盖）、draft hook `onDefaultOutputDirectory` 通道。

**验证**：`pnpm check` 双 tsc 全绿（每批次跑）、`pnpm i18n:check` 521 键通过、`pnpm build` 通过。**⑤ 类保留项：用户裁决「保留」（批准随本条生效，9 处带必要性注释留在原位）**。浏览器抽验（IAB，无 Tauri runtime 环境内做到最实）：boot 正常、四页导航往返、bilibili 草稿跨导航保持（visit/sweep 事件化未破坏 session retained）、media switchPage（页签激活+字段切换+高级区重置）、music mode 页签、结果面板初始收起。设置页依赖面板（settings 为 null 不渲染）由类型检查+等价性推演覆盖，归真机复验。**IAB 新知**：Radix TabsTrigger 激活绑 `onMouseDown`（`element.click()` 不含 mousedown ⇒ 静默失败），hidden Activity 子树不处理合成事件——此前两轮「页签失灵」均为测试方法伪影，非代码回归。

**真机复验补充（并入 D27 清单）**：设置页语言切换（乐观更新+失败回滚）、依赖面板勾选派生与展开派生、四工作区「重跑/复用」种子恢复（rerun 保留输入文件、reuse 清 URL）、music 搜索结果面板展开时序、media L2 页签切换后表单重置。

## D29 · 前后端通信完整性审计（用户要求，3 agent 并行 + 主 agent 复核）

**背景**：重构收尾后用户要求派 agent 全面核查前端↔后端通信，担心重构漏掉调用。三个 agent 并行分三条线：① invoke 命令前后端对齐；② 事件通道双向对齐；③ 重构前后（HEAD 基线）调用差集。

**结论：通信链路完整，无 P0/P1**。承重事实（主 agent 逐条复核通过）：本次重构**未触碰 IPC 层**——7 个 api.ts、`contracts/`、整个 `src-tauri/` 相对 HEAD 零改动（git diff 为空）；36 个 `#[tauri::command]` 与前端 36 个 api 包装一一对应（参数键走 Tauri 2 默认 camelCase↔snake_case，struct 统一 serde camelCase，枚举值域对齐）；7 个事件名（task-event / job-state / bbdown-login-qr / musicdl-search-result / update-download-progress / dependency-download-progress / dependency-install-finished）双侧一一对应、payload 逐字段匹配（含 TaskStatus 七态、Option→null 序列化）；plugins（dialog/opener/updater/window）与 capabilities 全对齐。差集审计：73 个改动文件中的全部通信相关差异均为决策文档记录过的有意变更（HeaderActions/TopNavigation 删除但回调原样迁入页内工具栏、qualityPriority 降级 D19、清空历史两步确认 D18 等），无孤儿导出、无丢失监听。

**验收处置**：

- **已修（P2 类型标注）**：`install_update` / `task_export_diagnostics` 后端返回 `String` 而前端标 `Promise<void>`——改 `Promise<string>` 并加注释（调用方均不消费返回值，零运行时影响）；check/build 全绿。
- **记档（既有缺陷，非重构引入，建议并入 D11 ticket）**：① `stores/tasks.ts` init 重试路径可能双订 task-event——listen 成功后 `fetchTasksSnapshot` 抛错进 catch 时 `initStarted` 复位但旧监听不清理（HEAD 同代码）；修法：catch 里先 unlisten 再复位，或 listen 挪到 snapshot 成功之后。② 三个全局 store（bilibili-login/music-session/tasks）监听无 unlisten——应用级单例系有意设计（`initStarted`/`initPromise` 已防 StrictMode 双订），仅 HMR 开发期有热更残留。
- **记档（结构性风险提示）**：请求 struct 普遍带 `#[serde(default)]`（如 MediaIntent 全字段默认）——前端拼错表单键名后端会**静默采用默认值不报错**，此类错误无法经运行时暴露；本次已逐键核对无问题（media 38 键、music 3 struct、settings/network/bilibili 均吻合），后续改动需警惕此模式。

## D28 · 页头吸顶工具栏统一为四页标准（用户两轮裁决后落地）

**疑惑**：media 吸顶工具栏（sticky + 淡分隔线 + 模糊底）为四页唯一变体，bilibili/network/music 三页页头是普通静态行——是否统一？

**执行 agent 初判**：线是吸顶悬浮层的功能件（滚动内容从半透明层下方经过需要边界），静态页头不加；吸顶行为属行为升级，入体验池。

**用户裁决①（统一分隔线）**：其余三页展开高级选项后同为长页滚动场景，四页页头应呈一致表面结构——落地 media 同款几何 `-mx-5 -mt-5 px-5 pt-5 pb-3 border-b border-border/40`，顺带消解 D23 记档①（静止态下缘 28px 四页统一）。

**用户裁决②（统一吸顶）**：「好像不是 sticky？统一下」——三页补齐 `sticky top-0 z-20 bg-card/95 backdrop-blur-sm`。**四页页头类名自此完全一致**；D16③ 移交的「配置→提交滚回顶部」摩擦在全部四页解除，体验池该项闭环。

**浏览器验证（IAB 环境限制内做到最实）**：四页 `position: sticky` 计算值全部生效、backdrop-blur active；**network（滚 400px）与 music（滚 362px 触底）滚动后工具栏精确钉在 main 顶缘（top 16 == mainTop）实测通过**。bilibili/media 在当前视口高度无可滚动溢出，sticky 已生效、真实滚动观感归真机。首轮 network 测得 +6px 偏差系 `workspace-enter` 入场动画（translateY 6px→none，180ms）在冻结环境未跑完的测量伪影，复测 transform none 后钉住精确成立。

**真机复验补充（并入 D27 清单）**：四页吸顶滚动观感（1366×768 尤其）、blur 底下滚动内容透过的可读性、页签切换入场动画与吸顶的衔接。

**后记（组件化）**：四页类名逐字一致且已因「只改 media 一页」漂移过一次（本条的起因），提取为 `src/components/common/PageToolbar.tsx`——children + className 覆盖，容器契约（负边距 ↔ p-5 配对、z-20 vs Portal z-50、bg-card 对齐表面）写入组件 docstring。grep 确认类串仅存组件一处、四个调用点（BilibiliPageHeader/NetworkVideoPageHeader/MusicPageHeader/MediaWorkspace）收敛；check/build 全绿，浏览器复测吸顶行为不变（network/music 真实滚动钉住实测，冻结环境的 +6px 伪影复现于动画未完成帧，与提取无关）。**边界**：只提取工具栏行，不统一页面容器（bilibili/network 多一层 `min-h-full` wrapper，强行归一是无行为收益的结构折腾）。
