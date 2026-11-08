import { expect, test } from "vitest";
import robots from "./robots";

test("saved short test results are kept out of search", () => {
  const [rule] = robots().rules as { disallow: string[] }[];
  expect(rule!.disallow).toContain("/short/");
});

test("short test pair invites and pair pages are kept out of search", () => {
  const [rule] = robots().rules as { disallow: string[] }[];
  expect(rule!.disallow).toEqual(expect.arrayContaining(["/sp/", "/short-pair/"]));
});
