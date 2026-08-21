import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：build 产物在 out/，通过 GitHub Actions 部署到 GitHub Pages
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // GitHub Pages 项目站点位于子路径 /MAD-Toolbox/ 下；
  // 若日后绑定自定义域名（根路径部署），将 basePath 改为 ""
  basePath: "/MAD-Toolbox",
  // 仓库根目录还有主应用的 package-lock.json，显式指定 web/ 为根以消除多锁文件警告
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
};

export default nextConfig;
