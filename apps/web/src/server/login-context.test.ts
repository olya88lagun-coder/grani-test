import { describe, expect, test } from "vitest";
import { signPending } from "./auth/tokens";
import { resolveLoginContext } from "./login-context";

const SECRET = "s".repeat(40);
const TOKEN = "AbC123xyz_-AbC123xyz_-AB";
const answers = (value = 3) => Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`ipip-${String(index + 1).padStart(2, "0")}`, value]));

describe("resolveLoginContext", () => {
  test("is the plain entrance without cookies", async () => {
    expect(await resolveLoginContext({}, SECRET)).toBe("default");
  });

  test("a signed pending result with complete answers is confirmed", async () => {
    const pending = await signPending(answers() as never, SECRET);

    expect(await resolveLoginContext({ pending }, SECRET)).toBe("result");
  });

  test("a forged, foreign-secret or incomplete pending result is not a context", async () => {
    const foreign = await signPending(answers() as never, "x".repeat(40));
    const incomplete = await signPending({ "ipip-01": 3 } as never, SECRET);

    expect(await resolveLoginContext({ pending: "not-a-token" }, SECRET)).toBe("default");
    expect(await resolveLoginContext({ pending: foreign }, SECRET)).toBe("default");
    expect(await resolveLoginContext({ pending: incomplete }, SECRET)).toBe("default");
  });

  test("a well-formed Together entry and a well-formed pair invite are confirmed, tampered ones are not", async () => {
    expect(await resolveLoginContext({ together: "space" }, SECRET)).toBe("together");
    expect(await resolveLoginContext({ together: `invite:${TOKEN}` }, SECRET)).toBe("together");
    expect(await resolveLoginContext({ pairInvite: TOKEN }, SECRET)).toBe("pair");
    expect(await resolveLoginContext({ together: "https://evil.example", pairInvite: "../x" }, SECRET)).toBe("default");
  });

  test("keeps the priority of the return path when several contexts are present", async () => {
    const pending = await signPending(answers() as never, SECRET);

    expect(await resolveLoginContext({ pending, together: "space" }, SECRET)).toBe("together");
    expect(await resolveLoginContext({ pending, together: "space", pairInvite: TOKEN }, SECRET)).toBe("pair");
  });
});
