import { getLibrary } from "@grani/content/data";
import { describe, expect, test, vi } from "vitest";
import { generatePortrait } from "./generate-portrait";
import { portraitStubWriter, SAMPLE_SCORES, samplePortrait } from "./testing";

const CTX = { library: getLibrary(), result: SAMPLE_SCORES };

describe("generatePortrait", () => {
  test("makes one request and assembles a headline and five blocks with the editorial titles", async () => {
    const stub = portraitStubWriter();

    const result = await generatePortrait(stub, CTX);

    expect(stub.calls).toHaveLength(1);
    expect(result?.attempts).toBe(1);
    expect(result?.sections.version).toBe(1);
    expect(result?.sections.blocks).toHaveLength(5);
    expect(result?.sections.blocks[0]?.title).toBe("Как ты берёшься за дело");
  });

  test("retries a broken answer and logs the part", async () => {
    const log = vi.fn();
    const stub = portraitStubWriter(["не json"]);

    const result = await generatePortrait(stub, CTX, { log });

    expect(result?.attempts).toBe(2);
    expect(stub.calls).toHaveLength(2);
    expect(log).toHaveBeenCalledWith("chapter part rejected", expect.objectContaining({ kind: "portrait", part: "portrait", attempt: 1, reason: "not_json" }));
  });

  test("a retry carries the concrete remark about the previous answer", async () => {
    const stub = portraitStubWriter(["{}"]);

    await generatePortrait(stub, CTX);

    expect((JSON.parse(stub.calls[1]!.user) as { fix?: string }).fix).toContain("headline");
  });

  test("gives up with null after five rejected attempts", async () => {
    const stub = portraitStubWriter(["{}", "{}", "{}", "{}", "{}"]);

    expect(await generatePortrait(stub, CTX)).toBeNull();
    expect(stub.calls).toHaveLength(5);
  });

  test("the last attempt forgives a gendered form and says so in the log", async () => {
    const log = vi.fn();
    const gendered = JSON.stringify({ ...samplePortrait(), headline: "Ты открыт новому и умеешь доводить начатое до конца, если рядом есть понятный срок" });
    const stub = portraitStubWriter([gendered, gendered, gendered, gendered, gendered]);

    const result = await generatePortrait(stub, CTX, { log });

    expect(result?.attempts).toBe(5);
    expect(log).toHaveBeenCalledWith("chapter part accepted with remarks", expect.objectContaining({ kind: "portrait", attempt: 5, forgiven: expect.arrayContaining(["gendered"]) }));
  });
});
