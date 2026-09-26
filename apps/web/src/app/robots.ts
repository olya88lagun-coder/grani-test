import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Результаты, разборы, пары и ссылки-приглашения личные: в поиск они попадать не должны
const PRIVATE = ["/api/", "/test", "/login", "/me", "/result/", "/report/", "/pair/", "/p/", "/f/", "/purchases/", "/cards/", "/dev/", "/continue/"];

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }], sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
