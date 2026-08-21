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

## 构建与部署（Cloudflare Pages）

```bash
npm run build      # 产物输出到 web/out/
```

部署方式任选其一：

1. **仪表盘直传**：Cloudflare Pages → Create project → Direct Upload，把 `out/` 目录拖进去。
2. **Git 集成**：仓库连 Pages，构建配置填：
   - Build command: `cd web && npm install && npm run build`
   - Build output directory: `web/out`
3. **Wrangler CLI**：`npx wrangler pages deploy out`

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
