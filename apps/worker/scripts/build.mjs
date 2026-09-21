import { build } from "esbuild";

// Воркер собирается в один ESM-файл: workspace-пакеты экспортируют .ts, а Node не резолвит их импорты без расширений.
// grammy — внешний: в бандле его запрос к Telegram зависает (esbuild ломает node-fetch внутри grammy).
await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: "dist/main.mjs",
  external: ["pg-native", "grammy"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
