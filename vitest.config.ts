import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts", "packages/content/src/**/*.ts", "packages/db/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/generated/**", "**/testing.ts", "**/client.ts"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
