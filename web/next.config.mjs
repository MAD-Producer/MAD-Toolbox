import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：build 产物在 out/，可直接上传 Cloudflare Pages
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // 仓库根目录还有主应用的 package-lock.json，显式指定 web/ 为根以消除多锁文件警告
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
};

export default nextConfig;
