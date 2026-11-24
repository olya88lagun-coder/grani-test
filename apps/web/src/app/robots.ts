import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Роли URL Big Five:
//   /big-five-test — SEO-лендинг (в sitemap, индексируется);
//   /test — анкета/раннер (гостевой результат в браузере, progress в localStorage).
// /test остаётся Disallow: это интерактивный поток, а не посадочная страница; хаб и футер
// ведут на /big-five-test для discovery. Allow /tests длиннее Disallow: /test и открывает хаб.
// Остальное — личные результаты, разборы, пары и приглашения.
const PRIVATE = [
  "/api/",
  "/test",
  "/login",
  "/me",
  "/result/",
  "/report/",
  "/pair/",
  "/p/",
  "/f/",
  "/together/invite/",
  "/purchases/",
  "/cards/",
  "/dev/",
  "/continue/",
  "/short/",
  "/short-pair/",
  "/sp/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/tests"], disallow: PRIVATE }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
