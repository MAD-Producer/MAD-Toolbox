# MAD Toolbox 官网（web/）

MAD Toolbox 的产品宣传页。Raycast 风格暗色设计，Next.js 静态导出，构建产物为纯静态文件。

## 技术栈

- Next.js 15（App Router，`output: "export"` 静态导出）
- TypeScript
- Tailwind CSS v4
- Framer Motion（滚动揭示、打字机循环、鼠标视差、进度动画）

品牌令牌取自主应用：主色 `#0A84FF`（blue 刻度）、深色刻度 `#101013 / #151518 / #1D1D20`、图标三色（紫 `#8177FF` / 粉 `#FF5C91`）、品牌字体 Sinter（自托管于 `public/fonts/`）。

## 本地开发

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## 构建与部署（GitHub Pages）

```bash
npm run build      # 产物输出到 web/out/
```

部署方式任选其一：

1. **自动部署（推荐）**：`.github/workflows/deploy-web.yml` 会在 `web` 分支有 commit（且改动涉及 `web/`）时自动构建并部署到 GitHub Pages。首次使用前需在仓库 Settings → Pages 将 Source 设为 **GitHub Actions**（无需配置任何密钥）。
2. **Wrangler CLI / Cloudflare Pages**（备用）：`npx wrangler pages deploy out`，需要先在 `next.config.mjs` 中把 `basePath` 改为 `""`（Cloudflare Pages 部署在根路径）。

> 站点地址为 `https://mad-producer.github.io/MAD-Toolbox/`（子路径部署，已通过 `basePath` 适配）。
> 若绑定自定义域名改为根路径部署，同样需要把 `basePath` 与 `src/lib/site.ts` 中的 `BASE_PATH` 置空。

## 目录结构

```
web/
├── public/            # 字体、图标等静态资源
├── src/
│   ├── app/           # layout / page / 全局样式 / favicon
│   └── components/
│       ├── ui/        # Reveal、SpotlightCard、Icons 等基础件
│       ├── sections/  # 各页面区块（Bento、DeepDive、Editions…）
│       ├── AppWindow.tsx  # Hero 应用窗口模拟（打字机 + 场景轮播）
│       ├── Background.tsx # 极光氛围背景
│       ├── Hero.tsx / Navbar.tsx
└── out/               # 构建产物（gitignore）
```
