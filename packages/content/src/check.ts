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
