import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import { fallbackSections } from "./fallback";
import { generateReport, type ReportWriter } from "./generate";
import { buildPersonalInput } from "./input";

const RESULT = { scores: { openness: 80, conscientiousness: 40, extraversion: 70, agreeableness: 65, stability: 50 }, typeCode: "+-++", stability: "calm" } as const;
const INPUT = buildPersonalInput(getLibrary(), "full", RESULT);
const GOOD = JSON.stringify(fallbackSections(INPUT));

function writer(...answers: (string | Error | "hang")[]): ReportWriter & { complete: ReturnType<typeof vi.fn> } {
  const complete = vi.fn();
  for (const answer of answers) {
    if (answer === "hang") complete.mockImplementationOnce(() => new Promise(() => {}));
    else if (answer instanceof Error) complete.mockRejectedValueOnce(answer);
    else complete.mockResolvedValueOnce(answer);
  }
  return { name: "stub", complete };
}

describe("generateReport", () => {
  test("uses the first valid answer of the model", async () => {
    const stub = writer(GOOD);

    const report = await generateReport(stub, INPUT);

    expect(report).toMatchObject({ source: "ai", attempts: 1 });
    expect(stub.complete.mock.calls[0]![0].system).toContain("на «ты»");
  });

  test("retries after a broken answer, an error and a timeout, then succeeds", async () => {
    const log = vi.fn();
    const stub = writer("не json", "hang", GOOD);

    const report = await generateReport(stub, INPUT, { timeoutMs: 20, log });

    expect(report).toMatchObject({ source: "ai", attempts: 3 });
    expect(log.mock.calls.map((call) => call[1].reason)).toEqual(["not_json", "timeout"]);
  });

  test("falls back to the library after three failed attempts", async () => {
    const stub = writer(new Error("503"), "{}", JSON.stringify({ portrait: "депрессия" }));

    const report = await generateReport(stub, INPUT);

    expect(report).toEqual({ sections: fallbackSections(INPUT), source: "fallback", attempts: 3 });
  });

  test("without a writer the report is built from the library right away", async () => {
    expect(await generateReport(null, INPUT)).toEqual({ sections: fallbackSections(INPUT), source: "fallback", attempts: 0 });
  });
});
