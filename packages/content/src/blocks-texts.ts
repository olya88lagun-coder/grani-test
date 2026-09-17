import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOCKS_DIR, normalizeBlock } from "./check";

const BRAND_PATTERN = /mbti|майерс|бриггс|16personalities|соционик/iu;
const BRACKET_GENDER_PATTERN = /\((?:а|ая|ой|на|ла)\)|[а-яё]\/(?:а|ая|ой)(?![а-яё])/iu;

export function readBlock(file: string): string {
  return normalizeBlock(readFileSync(join(BLOCKS_DIR, ...file.split("/")), "utf8"));
}

export function styleProblems(file: string, text: string): string[] {
  const problems: string[] = [];
  if (BRAND_PATTERN.test(text)) problems.push(`${file}: brand mention`);
  if (BRACKET_GENDER_PATTERN.test(text)) problems.push(`${file}: bracketed gender ending`);
  const hasHeadings = /^## /m.test(text);
  const headingsAllowed = /^types\/[pm]{4}\/long\.md$/.test(file);
  if (hasHeadings && !headingsAllowed) problems.push(`${file}: headings are allowed only in types/*/long.md`);
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) problems.push(`${file}: emoji`);
  return problems;
}
