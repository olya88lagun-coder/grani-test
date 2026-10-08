import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_TYPE_CODES } from "@grani/core";
import { typeCodeToDir } from "@grani/content";
import { GEM_ASSET_DIRS, gemAssetDir, gemAssetPath } from "./gem-assets";
import { TYPE_VISUALS } from "./type-visuals";

function webpInfo(buffer: Buffer) {
  expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
  expect(buffer.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1, alpha: Boolean(buffer[20]! & 16) };
  if (chunk === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff, alpha: false };
  if (chunk === "VP8L") { const bits = buffer.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, alpha: Boolean(bits & (1 << 28)) }; }
  throw new Error(`Unknown WebP header: ${chunk}`);
}

describe("production gemstone assets", () => {
  it("covers the 16 existing type directories and the approved shape table", () => {
    const dirs = ALL_TYPE_CODES.map(typeCodeToDir).sort();
    expect([...GEM_ASSET_DIRS].sort()).toEqual(dirs);
    expect(readdirSync(new URL("../../public/gems/", import.meta.url)).filter((file) => file.endsWith(".webp")).sort()).toEqual(dirs.map((dir) => `${dir}.webp`));
    const direction = readFileSync(new URL("../../../../docs/design/visual-direction.md", import.meta.url), "utf8");
    for (const dir of GEM_ASSET_DIRS) {
      const row = direction.split("\n").find((line) => line.startsWith(`| \`${dir}\` |`))!;
      expect(row.trim().split("|")[3]!.trim()).toBe(TYPE_VISUALS[dir]!.shape);
    }
  });

  it("keeps every gemstone transparent, 640 square and under 100 KB", () => {
    for (const dir of GEM_ASSET_DIRS) {
      const path = new URL(`../../public${gemAssetPath(dir)}`, import.meta.url);
      expect(statSync(path).size, dir).toBeLessThanOrEqual(100_000);
      expect(webpInfo(readFileSync(path)), dir).toEqual({ width: 640, height: 640, alpha: true });
    }
  });

  it("ships separate responsive backgrounds at the requested sizes and under 250 KB", () => {
    for (const [file, width, height] of [["types-night-desktop.webp", 2400, 1200], ["types-night-mobile.webp", 900, 1400]] as const) {
      const path = new URL(`../../public/home/${file}`, import.meta.url);
      expect(statSync(path).size, file).toBeLessThanOrEqual(250_000);
      const info = webpInfo(readFileSync(path));
      expect([info.width, info.height], file).toEqual([width, height]);
    }
  });

  it("maps every type code directory to an asset and fails loudly on an unknown one", () => {
    for (const code of ALL_TYPE_CODES) expect(gemAssetDir(typeCodeToDir(code))).toBe(typeCodeToDir(code));
    expect(() => gemAssetDir("xxxx")).toThrow("Unknown gem asset directory: xxxx");
  });
});
