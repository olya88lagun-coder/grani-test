import path from "node:path";
import type { NextConfig } from "next";

// Базовая защита браузера для всех ответов. Полную CSP не ставим: Метрика и ЮKassa тянут сторонние скрипты,
// строгую политику надо собирать отдельно, иначе сломается оплата. Поэтому только директивы, которые не задевают
// скрипты и стили: запрет встраивания чужими сайтами, плагинов и подмены base
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Картинки из public без хэша в имени: день держим в кэше, неделю отдаём старую, пока браузер проверяет новую
const PUBLIC_IMAGE_CACHE = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

// `next build` запускается из apps/web (pnpm --filter), корень монорепо — на два уровня выше
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  outputFileTracingIncludes: { "/api/pairs/*/map/pdf": ["./assets/pdf/**/*"], "/api/report/*/atlas/pdf": ["./assets/pdf/**/*"] },
  transpilePackages: ["@grani/core", "@grani/content", "@grani/db"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/home/:file*", headers: PUBLIC_IMAGE_CACHE },
      { source: "/og/:file*", headers: PUBLIC_IMAGE_CACHE },
    ];
  },
};

export default nextConfig;
