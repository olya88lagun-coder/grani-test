import { expect, test, vi } from "vitest";
import { createWriter } from "./ai";

test("creates the writer of the configured provider", () => {
  const fetchFn = vi.fn();

  expect(createWriter({ provider: "none" }, fetchFn)).toBeNull();
  expect(createWriter({ provider: "yandex", apiKey: "k", folderId: "f" }, fetchFn)?.name).toBe("yandexgpt");
  expect(createWriter({ provider: "gigachat", authKey: "a", scope: "s" }, fetchFn)?.name).toBe("gigachat");
});
