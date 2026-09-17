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
