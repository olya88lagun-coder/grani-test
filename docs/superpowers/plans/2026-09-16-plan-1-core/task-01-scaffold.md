# Task 1: Монорепо и пакет `@grani/core`

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`, `.editorconfig`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Create: `packages/core/src/traits.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/traits.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  ```ts
  const TRAITS: readonly ["openness", "conscientiousness", "extraversion", "agreeableness", "stability"];
  type Trait = (typeof TRAITS)[number];
  type TraitScores = Readonly<Record<Trait, number>>; // целые 0–100
  ```
  Скрипты корня: `pnpm test`, `pnpm test:coverage`, `pnpm typecheck`.

- [ ] **Step 1: Ветка**

```bash
cd /c/dev/grani-test
git checkout -b feat/core
```

- [ ] **Step 2: Корневые файлы**

`package.json`:
```json
{
  "name": "grani",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.4.1",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "pnpm -r --parallel typecheck"
  },
  "devDependencies": {
    "@types/node": "26.5.1",
    "@vitest/coverage-v8": "5.0.0",
    "typescript": "6.0.3",
    "vitest": "5.0.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
```

`.gitignore`:
```
node_modules/
.next/
coverage/
dist/
.env
.env.*
!.env.example
*.log
```

`.editorconfig`:
```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
```

- [ ] **Step 3: Пакет `@grani/core`**

`packages/core/package.json`:
```json
{
  "name": "@grani/core",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc -p tsconfig.json" }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"]
}
```

`packages/core/vitest.config.ts`:
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "core", environment: "node" },
});
```

- [ ] **Step 4: Тест (падает)**

`packages/core/src/traits.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { TRAITS } from "./traits";

describe("TRAITS", () => {
  test("lists the five Big Five traits in the canonical order used by type codes", () => {
    expect(TRAITS).toEqual(["openness", "conscientiousness", "extraversion", "agreeableness", "stability"]);
  });
});
```

- [ ] **Step 5: Установка и запуск — тест падает**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm install
pnpm test
```
Expected: FAIL — `Failed to resolve import "./traits"`.

- [ ] **Step 6: Реализация**

`packages/core/src/traits.ts`:
```ts
export const TRAITS = ["openness", "conscientiousness", "extraversion", "agreeableness", "stability"] as const;

export type Trait = (typeof TRAITS)[number];

export type TraitScores = Readonly<Record<Trait, number>>;
```

`packages/core/src/index.ts`:
```ts
export * from "./traits";
```

- [ ] **Step 7: Тесты, типы, покрытие — зелёные**

```bash
pnpm test && pnpm typecheck && pnpm test:coverage
```
Expected: 1 passed; typecheck без ошибок; покрытие 100%, пороги пройдены.

- [ ] **Step 8: Коммит**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json vitest.config.ts .gitignore .editorconfig packages/core
git commit -m "chore: monorepo scaffold and @grani/core package"
```
