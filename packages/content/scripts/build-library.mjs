import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function markdownFiles(dir, prefix = []) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  return entries.flatMap((entry) => {
    if (entry.isDirectory()) return markdownFiles(join(dir, entry.name), [...prefix, entry.name]);
    return entry.name.endsWith(".md") ? [[...prefix, entry.name]] : [];
  });
}

export function collectLibrary(blocksDir) {
  const library = {};
  for (const parts of markdownFiles(blocksDir)) {
    const keys = [...parts.slice(0, -1), parts.at(-1).replace(/\.md$/, "")];
    let node = library;
    for (const key of keys.slice(0, -1)) {
      node[key] ??= {};
      node = node[key];
    }
    const text = readFileSync(join(blocksDir, ...parts), "utf8").replace(/\r\n/g, "\n").trim();
    node[keys.at(-1)] = text;
  }
  return library;
}

// Статьи разбираются и проверяются в TypeScript (src/articles.ts), здесь только собираются
export function collectArticles(articlesDir) {
  const articles = {};
  for (const name of readdirSync(articlesDir).filter((file) => file.endsWith(".md")).sort()) {
    articles[name.replace(/\.md$/, "")] = readFileSync(join(articlesDir, name), "utf8").replace(/\r\n/g, "\n").trim();
  }
  return articles;
}

if (import.meta.main) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const library = collectLibrary(join(root, "blocks"));
  const output = join(root, "src", "generated", "library.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(library, null, 2)}\n`, "utf8");
  console.log(`library.json written: ${output}`);
  const articlesOutput = join(root, "src", "generated", "articles.json");
  writeFileSync(articlesOutput, `${JSON.stringify(collectArticles(join(root, "articles")), null, 2)}\n`, "utf8");
  console.log(`articles.json written: ${articlesOutput}`);
}
