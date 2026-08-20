import type { NextConfig } from "next";
import path from "node:path";

/**
 * تنظیمات Next.js برای Liara Copilot
 * - output: standalone برای دیپلوی بهینه روی پلتفرم Next.js لیارا
 * - serverExternalPackages برای Prisma
 */
const nextConfig: NextConfig = {
  output: "standalone",
  // پوشهٔ والد یک lockfile مستقل دارد؛ tracing باید در همین پروژه بماند.
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    // امکان استریم طولانی‌تر پاسخ ایجنت
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "docs.liara.ir",
      },
    ],
  },
};

export default nextConfig;
