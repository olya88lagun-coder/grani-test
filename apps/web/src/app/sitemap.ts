import type { MetadataRoute } from "next";
import { lastModified, PUBLIC_PATHS, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS().map((path) => {
    const modified = lastModified(path);
    return {
      url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
      ...(modified ? { lastModified: modified } : {}),
      changeFrequency: "monthly",
      priority: path === "/" ? 1 : 0.7,
    };
  });
}
