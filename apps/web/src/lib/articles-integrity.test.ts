import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inlineLinks } from "@grani/content";
import { getArticles } from "@grani/content/data";
import { describe, expect, it } from "vitest";
import { PUBLIC_PATHS } from "./seo";

// Статьи публикуются конвейером без ручной вычитки: сайт сам проверяет, что они не ведут в пустоту
const PUBLIC_DIR = fileURLToPath(new URL("../../public", import.meta.url));

describe("published articles", () => {
  it("use illustrations that exist in the site assets", () => {
    for (const article of getArticles()) {
      expect(article.image, article.slug).toBeTruthy();
      expect(existsSync(`${PUBLIC_DIR}${article.image}`), `${article.slug}: ${article.image}`).toBe(true);
    }
  });

  it("link only to existing public pages or the test", () => {
    const allowed = new Set([...PUBLIC_PATHS(), "/test"]);
    for (const article of getArticles()) {
      const hrefs = article.blocks
        .flatMap((block) => (block.kind === "ul" ? block.items : [block.text]))
        .flatMap(inlineLinks)
        .flatMap((part) => ("href" in part ? [part.href.split("#")[0]!] : []));
      for (const href of hrefs) expect(allowed.has(href), `${article.slug} → ${href}`).toBe(true);
    }
  });
});
