# Task 3: Библиотека блоков — ключи, проверка файлов, сборщик и схема

**Files:**
- Create: `packages/content/src/keys.ts`, `packages/content/src/check.ts`, `packages/content/src/library.ts`
- Create: `packages/content/scripts/build-library.mjs`, `packages/content/scripts/build-library.d.mts`
- Create: `packages/content/blocks/.gitkeep`
- Test: `packages/content/src/keys.test.ts`, `packages/content/src/check.test.ts`, `packages/content/src/library.test.ts`
- Create (тестовый помощник): `packages/content/src/testing.ts`
- Modify: `packages/content/src/index.ts`

**Interfaces:**
- Consumes: `TRAITS`, `Trait`, `TraitLevel`, `Stability`, `PairVariant`, `CompatibilityLevel`, `TypeCode`, `ALL_TYPE_CODES` из `@grani/core`; `findStopWords`, `StopTopic` (Task 2).
- Produces:
  ```ts
  // keys.ts
  const TRAIT_LEVELS: readonly ["high", "low", "borderline"];
  const TRAIT_SECTIONS: readonly ["strengths", "blind_spots", "work", "relationships", "money", "conflict", "stress"];
  type TraitSection = (typeof TRAIT_SECTIONS)[number];
  const PAGE_POLES: readonly ["high", "low"];
  type PagePole = (typeof PAGE_POLES)[number];
  const STABILITIES: readonly ["calm", "sensitive"];
  const PAIR_VARIANTS: readonly ["both_high", "both_low", "different"];
  const PAIR_SECTIONS: readonly ["similar", "differences", "conflicts", "home_money", "support"];
  type PairSection = (typeof PAIR_SECTIONS)[number];
  const COMPATIBILITY_LEVEL_IDS: readonly ["excellent", "high", "good", "effort", "challenging"];
  type Limit = { readonly min: number; readonly max: number };
  const LIMITS: { traitBlock; traitPage; typeShort; typeLong; stability; pairBlock; compatibilityPhrase; compatibilityText }; // Limit каждый
  function typeCodeToDir(code: TypeCode): string; // "++-+" → "ppmp"
  const TYPE_DIRS: readonly string[];
  const LIBRARY_FILES: readonly string[]; // 234 пути вида "traits/openness/high/strengths.md"
  function limitFor(file: string): Limit;

  // check.ts (точка входа "@grani/content/check", использует node:fs)
  const BLOCKS_DIR: string;
  type BlockProblem = { readonly file: string; readonly problem: string };
  function normalizeBlock(raw: string): string;
  function checkBlockText(file: string, text: string): BlockProblem[];
  function checkBlockFiles(blocksDir: string, prefix: string): BlockProblem[];

  // scripts/build-library.mjs
  function collectLibrary(blocksDir: string): Record<string, unknown>;

  // library.ts
  const LibrarySchema: z.ZodType; type Library = z.infer<typeof LibrarySchema>;
  class LibraryError extends Error {}
  function parseLibrary(raw: unknown): Library;
  function traitBlock(library: Library, trait: Trait, level: TraitLevel, section: TraitSection): string;
  function traitPageIntro(library: Library, trait: Trait, pole: PagePole): string;
  function typeTexts(library: Library, code: TypeCode): { readonly short: string; readonly long: string };
  function stabilityText(library: Library, stability: Stability): string;
  function pairBlock(library: Library, trait: Trait, variant: PairVariant, section: PairSection): string;
  function compatibilityTexts(library: Library, level: CompatibilityLevel): { readonly phrase: string; readonly text: string };

  // testing.ts (только для тестов)
  function placeholderText(file: string): string;
  function writeLibraryFiles(blocksDir: string, files: readonly string[], textFor?: (file: string) => string): void;
  ```

Секции разбора пары в `PAIR_SECTIONS` соответствуют разделам 4.6 спецификации: «В чём вы похожи» — `similar`, «Где разные и как это использовать» — `differences`, «Откуда будут конфликты и как договариваться» — `conflicts`, «Быт и деньги» — `home_money`, «Как поддерживать друг друга» — `support`.

- [ ] **Step 1: Тесты (падают)**

`packages/content/src/testing.ts`:
```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { limitFor } from "./keys";

export function placeholderText(file: string): string {
  return `${file} `.padEnd(limitFor(file).min, "я").trimEnd();
}

export function writeLibraryFiles(
  blocksDir: string,
  files: readonly string[],
  textFor: (file: string) => string = placeholderText,
): void {
  for (const file of files) {
    const path = join(blocksDir, ...file.split("/"));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, textFor(file), "utf8");
  }
}
```

`packages/content/src/keys.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { LIBRARY_FILES, LIMITS, limitFor, TYPE_DIRS, typeCodeToDir } from "./keys";

describe("LIBRARY_FILES", () => {
  test("lists 234 unique markdown files", () => {
    expect(LIBRARY_FILES).toHaveLength(234);
    expect(new Set(LIBRARY_FILES).size).toBe(234);
    for (const file of LIBRARY_FILES) expect(file).toMatch(/^[a-z-]+\/[a-z_/]+\.md$/);
  });

  test("counts files per group as in the spec", () => {
    const count = (prefix: string) => LIBRARY_FILES.filter((file) => file.startsWith(prefix)).length;

    expect(count("traits/")).toBe(105);
    expect(count("trait-pages/")).toBe(10);
    expect(count("types/")).toBe(32);
    expect(count("stability/")).toBe(2);
    expect(count("pairs/")).toBe(75);
    expect(count("compatibility/")).toBe(10);
  });
});

describe("typeCodeToDir", () => {
  test("encodes plus as p and minus as m", () => {
    expect(typeCodeToDir("++-+")).toBe("ppmp");
    expect(typeCodeToDir("----")).toBe("mmmm");
  });

  test("gives 16 distinct directories", () => {
    expect(new Set(TYPE_DIRS).size).toBe(16);
  });
});

describe("limitFor", () => {
  test.each([
    ["traits/openness/high/strengths.md", LIMITS.traitBlock],
    ["trait-pages/stability/low.md", LIMITS.traitPage],
    ["types/ppmp/short.md", LIMITS.typeShort],
    ["types/ppmp/long.md", LIMITS.typeLong],
    ["stability/calm.md", LIMITS.stability],
    ["pairs/agreeableness/different/support.md", LIMITS.pairBlock],
    ["compatibility/good/phrase.md", LIMITS.compatibilityPhrase],
    ["compatibility/good/text.md", LIMITS.compatibilityText],
  ] as const)("%s", (file, limit) => {
    expect(limitFor(file)).toEqual(limit);
  });

  test("throws for an unknown file", () => {
    expect(() => limitFor("notes/readme.md")).toThrow(/notes\/readme\.md/);
  });
});
```

`packages/content/src/check.test.ts`:
```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { checkBlockFiles, checkBlockText, normalizeBlock } from "./check";
import { LIBRARY_FILES, LIMITS } from "./keys";
import { placeholderText, writeLibraryFiles } from "./testing";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grani-blocks-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("normalizeBlock", () => {
  test("converts CRLF to LF and trims", () => {
    expect(normalizeBlock("\r\n  Первый.\r\nВторой.  \r\n")).toBe("Первый.\nВторой.");
  });
});

describe("checkBlockText", () => {
  const file = "compatibility/good/phrase.md";

  test("accepts text within limits", () => {
    expect(checkBlockText(file, "а".repeat(LIMITS.compatibilityPhrase.min))).toEqual([]);
  });

  test("reports too short and too long text", () => {
    expect(checkBlockText(file, "а".repeat(LIMITS.compatibilityPhrase.min - 1))).toEqual([
      { file, problem: `too short: 19 < 20` },
    ]);
    expect(checkBlockText(file, "а".repeat(LIMITS.compatibilityPhrase.max + 1))).toEqual([
      { file, problem: `too long: 161 > 160` },
    ]);
  });

  test("reports stop words", () => {
    expect(checkBlockText(file, "У вас похожий диагноз, но это не страшно.")).toEqual([
      { file, problem: "stop word: diagnosis" },
    ]);
  });
});

describe("checkBlockFiles", () => {
  test("reports every missing file of a group", () => {
    const problems = checkBlockFiles(dir, "stability/");

    expect(problems).toEqual([
      { file: "stability/calm.md", problem: "missing" },
      { file: "stability/sensitive.md", problem: "missing" },
    ]);
  });

  test("passes a complete group", () => {
    writeLibraryFiles(
      dir,
      LIBRARY_FILES.filter((file) => file.startsWith("types/")),
    );

    expect(checkBlockFiles(dir, "types/")).toEqual([]);
  });

  test("normalizes files before measuring", () => {
    const file = "stability/calm.md";
    writeLibraryFiles(dir, ["stability/calm.md", "stability/sensitive.md"]);
    writeFileSync(join(dir, "stability", "calm.md"), `\r\n\r\n${placeholderText(file)}\r\n\r\n`, "utf8");

    expect(checkBlockFiles(dir, "stability/")).toEqual([]);
  });
});
```

`packages/content/src/library.test.ts`:
```ts
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { collectLibrary } from "../scripts/build-library.mjs";
import { LIBRARY_FILES } from "./keys";
import {
  compatibilityTexts,
  LibraryError,
  pairBlock,
  parseLibrary,
  stabilityText,
  traitBlock,
  traitPageIntro,
  typeTexts,
} from "./library";
import { placeholderText, writeLibraryFiles } from "./testing";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "grani-library-"));
  writeLibraryFiles(dir, LIBRARY_FILES);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("collectLibrary + parseLibrary", () => {
  test("accepts a complete library", () => {
    expect(() => parseLibrary(collectLibrary(dir))).not.toThrow();
  });

  test("names the missing block", () => {
    unlinkSync(join(dir, "pairs", "openness", "different", "support.md"));

    expect(() => parseLibrary(collectLibrary(dir))).toThrow(/pairs\/openness\/different\/support/);
  });

  test("rejects a text below its minimum length", () => {
    writeFileSync(join(dir, "types", "ppmp", "short.md"), "Коротко.", "utf8");

    expect(() => parseLibrary(collectLibrary(dir))).toThrow(LibraryError);
  });

  test("rejects unexpected files", () => {
    writeFileSync(join(dir, "stability", "extra.md"), placeholderText("stability/calm.md"), "utf8");

    expect(() => parseLibrary(collectLibrary(dir))).toThrow(/extra/);
  });

  test("ignores non-markdown files and normalizes line endings", () => {
    writeFileSync(join(dir, "README.txt"), "заметки", "utf8");
    writeFileSync(join(dir, "stability", "calm.md"), `\r\n${placeholderText("stability/calm.md")}\r\n`, "utf8");

    const library = parseLibrary(collectLibrary(dir));

    expect(stabilityText(library, "calm")).toBe(placeholderText("stability/calm.md"));
  });
});

describe("accessors", () => {
  test("return the text of the matching file", () => {
    const library = parseLibrary(collectLibrary(dir));

    expect(traitBlock(library, "openness", "borderline", "blind_spots")).toBe(
      placeholderText("traits/openness/borderline/blind_spots.md"),
    );
    expect(traitPageIntro(library, "stability", "low")).toBe(placeholderText("trait-pages/stability/low.md"));
    expect(typeTexts(library, "+-++")).toEqual({
      short: placeholderText("types/pmpp/short.md"),
      long: placeholderText("types/pmpp/long.md"),
    });
    expect(pairBlock(library, "extraversion", "both_low", "home_money")).toBe(
      placeholderText("pairs/extraversion/both_low/home_money.md"),
    );
    expect(compatibilityTexts(library, "effort")).toEqual({
      phrase: placeholderText("compatibility/effort/phrase.md"),
      text: placeholderText("compatibility/effort/text.md"),
    });
  });
});
```

`packages/content/scripts/build-library.d.mts`:
```ts
export function collectLibrary(blocksDir: string): Record<string, unknown>;
```

- [ ] **Step 2: Запуск — тесты падают**

```bash
export PATH="/c/Users/olya8/AppData/Roaming/npm:$PATH"
pnpm vitest run packages/content/src/keys.test.ts packages/content/src/check.test.ts packages/content/src/library.test.ts
```
Expected: FAIL — не найдены модули `./keys`, `./check`, `./library`, `../scripts/build-library.mjs`.

- [ ] **Step 3: Реализация `keys.ts`**

`packages/content/src/keys.ts`:
```ts
import {
  ALL_TYPE_CODES,
  TRAITS,
  type CompatibilityLevel,
  type PairVariant,
  type Stability,
  type TraitLevel,
  type TypeCode,
} from "@grani/core";

export const TRAIT_LEVELS = ["high", "low", "borderline"] as const satisfies readonly TraitLevel[];
export const TRAIT_SECTIONS = ["strengths", "blind_spots", "work", "relationships", "money", "conflict", "stress"] as const;
export type TraitSection = (typeof TRAIT_SECTIONS)[number];
export const PAGE_POLES = ["high", "low"] as const;
export type PagePole = (typeof PAGE_POLES)[number];
export const STABILITIES = ["calm", "sensitive"] as const satisfies readonly Stability[];
export const PAIR_VARIANTS = ["both_high", "both_low", "different"] as const satisfies readonly PairVariant[];
export const PAIR_SECTIONS = ["similar", "differences", "conflicts", "home_money", "support"] as const;
export type PairSection = (typeof PAIR_SECTIONS)[number];
export const COMPATIBILITY_LEVEL_IDS = [
  "excellent",
  "high",
  "good",
  "effort",
  "challenging",
] as const satisfies readonly CompatibilityLevel[];
const TYPE_TEXT_KINDS = ["short", "long"] as const;
const COMPATIBILITY_TEXT_KINDS = ["phrase", "text"] as const;

export type Limit = { readonly min: number; readonly max: number };

export const LIMITS = {
  traitBlock: { min: 200, max: 1500 },
  traitPage: { min: 300, max: 2000 },
  typeShort: { min: 150, max: 600 },
  typeLong: { min: 1500, max: 6000 },
  stability: { min: 200, max: 1500 },
  pairBlock: { min: 200, max: 1500 },
  compatibilityPhrase: { min: 20, max: 160 },
  compatibilityText: { min: 200, max: 1500 },
} as const satisfies Record<string, Limit>;

export function typeCodeToDir(code: TypeCode): string {
  return code.replaceAll("+", "p").replaceAll("-", "m");
}

export const TYPE_DIRS: readonly string[] = ALL_TYPE_CODES.map(typeCodeToDir);

function buildLibraryFiles(): string[] {
  const files: string[] = [];
  for (const trait of TRAITS)
    for (const level of TRAIT_LEVELS)
      for (const section of TRAIT_SECTIONS) files.push(`traits/${trait}/${level}/${section}.md`);
  for (const trait of TRAITS) for (const pole of PAGE_POLES) files.push(`trait-pages/${trait}/${pole}.md`);
  for (const dir of TYPE_DIRS) for (const kind of TYPE_TEXT_KINDS) files.push(`types/${dir}/${kind}.md`);
  for (const stability of STABILITIES) files.push(`stability/${stability}.md`);
  for (const trait of TRAITS)
    for (const variant of PAIR_VARIANTS)
      for (const section of PAIR_SECTIONS) files.push(`pairs/${trait}/${variant}/${section}.md`);
  for (const level of COMPATIBILITY_LEVEL_IDS)
    for (const kind of COMPATIBILITY_TEXT_KINDS) files.push(`compatibility/${level}/${kind}.md`);
  return files;
}

export const LIBRARY_FILES: readonly string[] = buildLibraryFiles();

export function limitFor(file: string): Limit {
  const group = file.split("/")[0];
  switch (group) {
    case "traits":
      return LIMITS.traitBlock;
    case "trait-pages":
      return LIMITS.traitPage;
    case "types":
      return file.endsWith("/short.md") ? LIMITS.typeShort : LIMITS.typeLong;
    case "stability":
      return LIMITS.stability;
    case "pairs":
      return LIMITS.pairBlock;
    case "compatibility":
      return file.endsWith("/phrase.md") ? LIMITS.compatibilityPhrase : LIMITS.compatibilityText;
    default:
      throw new Error(`Unknown library file: ${file}`);
  }
}
```

- [ ] **Step 4: Реализация `check.ts`**

`packages/content/src/check.ts`:
```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LIBRARY_FILES, limitFor } from "./keys";
import { findStopWords } from "./safety";

export const BLOCKS_DIR = fileURLToPath(new URL("../blocks", import.meta.url));

export type BlockProblem = { readonly file: string; readonly problem: string };

export function normalizeBlock(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

export function checkBlockText(file: string, text: string): BlockProblem[] {
  const { min, max } = limitFor(file);
  const lengthProblems: BlockProblem[] = [];
  if (text.length < min) lengthProblems.push({ file, problem: `too short: ${text.length} < ${min}` });
  if (text.length > max) lengthProblems.push({ file, problem: `too long: ${text.length} > ${max}` });
  const stopProblems = findStopWords(text).map((topic) => ({ file, problem: `stop word: ${topic}` }));
  return [...lengthProblems, ...stopProblems];
}

export function checkBlockFiles(blocksDir: string, prefix: string): BlockProblem[] {
  return LIBRARY_FILES.filter((file) => file.startsWith(prefix)).flatMap((file) => {
    const path = join(blocksDir, ...file.split("/"));
    if (!existsSync(path)) return [{ file, problem: "missing" }];
    return checkBlockText(file, normalizeBlock(readFileSync(path, "utf8")));
  });
}
```

- [ ] **Step 5: Реализация сборщика**

`packages/content/scripts/build-library.mjs`:
```js
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

if (import.meta.main) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const library = collectLibrary(join(root, "blocks"));
  const output = join(root, "src", "generated", "library.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(library, null, 2)}\n`, "utf8");
  console.log(`library.json written: ${output}`);
}
```

`packages/content/blocks/.gitkeep` — пустой файл (каталог для задач 4–6).

- [ ] **Step 6: Реализация `library.ts`**

`packages/content/src/library.ts`:
```ts
import { z } from "zod";
import {
  TRAITS,
  type CompatibilityLevel,
  type PairVariant,
  type Stability,
  type Trait,
  type TraitLevel,
  type TypeCode,
} from "@grani/core";
import {
  COMPATIBILITY_LEVEL_IDS,
  LIMITS,
  PAGE_POLES,
  PAIR_SECTIONS,
  PAIR_VARIANTS,
  STABILITIES,
  TRAIT_LEVELS,
  TRAIT_SECTIONS,
  TYPE_DIRS,
  typeCodeToDir,
  type Limit,
  type PagePole,
  type PairSection,
  type TraitSection,
} from "./keys";

function text(limit: Limit) {
  return z.string().min(limit.min).max(limit.max);
}

function keyed<const K extends readonly string[], V extends z.ZodType>(keys: K, value: V) {
  const shape = Object.fromEntries(keys.map((key) => [key, value])) as { [P in K[number]]: V };
  return z.strictObject(shape);
}

export const LibrarySchema = z.strictObject({
  traits: keyed(TRAITS, keyed(TRAIT_LEVELS, keyed(TRAIT_SECTIONS, text(LIMITS.traitBlock)))),
  "trait-pages": keyed(TRAITS, keyed(PAGE_POLES, text(LIMITS.traitPage))),
  types: keyed(TYPE_DIRS, z.strictObject({ short: text(LIMITS.typeShort), long: text(LIMITS.typeLong) })),
  stability: keyed(STABILITIES, text(LIMITS.stability)),
  pairs: keyed(TRAITS, keyed(PAIR_VARIANTS, keyed(PAIR_SECTIONS, text(LIMITS.pairBlock)))),
  compatibility: keyed(
    COMPATIBILITY_LEVEL_IDS,
    z.strictObject({ phrase: text(LIMITS.compatibilityPhrase), text: text(LIMITS.compatibilityText) }),
  ),
});

export type Library = z.infer<typeof LibrarySchema>;

export class LibraryError extends Error {
  override name = "LibraryError";
}

export function parseLibrary(raw: unknown): Library {
  const result = LibrarySchema.safeParse(raw);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => `${issue.path.join("/")}: ${issue.message}`).join("\n");
  throw new LibraryError(`Invalid content library:\n${details}`);
}

export function traitBlock(library: Library, trait: Trait, level: TraitLevel, section: TraitSection): string {
  return library.traits[trait][level][section];
}

export function traitPageIntro(library: Library, trait: Trait, pole: PagePole): string {
  return library["trait-pages"][trait][pole];
}

export function typeTexts(library: Library, code: TypeCode): { readonly short: string; readonly long: string } {
  const entry = library.types[typeCodeToDir(code)];
  if (entry === undefined) throw new LibraryError(`No texts for type ${code}`);
  return entry;
}

export function stabilityText(library: Library, stability: Stability): string {
  return library.stability[stability];
}

export function pairBlock(library: Library, trait: Trait, variant: PairVariant, section: PairSection): string {
  return library.pairs[trait][variant][section];
}

export function compatibilityTexts(
  library: Library,
  level: CompatibilityLevel,
): { readonly phrase: string; readonly text: string } {
  return library.compatibility[level];
}
```

Если `keyed(TYPE_DIRS, …)` даёт тип без индекса по строке и `typecheck` падает на `library.types[...]`, объявить `TYPE_DIRS` как `readonly string[]` (уже так) — тогда `K[number]` = `string` и индексирование разрешено; `noUncheckedIndexedAccess` добавляет `undefined`, что и проверяется в `typeTexts`.

`packages/content/src/index.ts`:
```ts
export * from "./items";
export * from "./safety";
export * from "./keys";
export * from "./library";
```

- [ ] **Step 7: Запуск — тесты проходят**

```bash
pnpm test && pnpm typecheck
```
Expected: все тесты зелёные, typecheck без ошибок.

- [ ] **Step 8: Коммит**

```bash
git add packages/content
git commit -m "feat(content): block library keys, file checks, JSON collector and schema"
```
