import type { ReportWriter } from "../generate";

export const YANDEX_COMPLETION_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
const DEFAULT_MODEL = "yandexgpt/latest";

type CompletionBody = { result?: { alternatives?: { message?: { text?: unknown } }[] } };

export function createYandexWriter(p: { apiKey: string; folderId: string; fetchFn: typeof fetch; model?: string }): ReportWriter {
  return {
    name: "yandexgpt",
    async complete(prompt, signal) {
      const response = await p.fetchFn(YANDEX_COMPLETION_URL, {
        method: "POST",
        signal,
        headers: { authorization: `Api-Key ${p.apiKey}`, "x-folder-id": p.folderId, "content-type": "application/json" },
        body: JSON.stringify({
          modelUri: `gpt://${p.folderId}/${p.model ?? DEFAULT_MODEL}`,
          completionOptions: { stream: false, temperature: 0.3, maxTokens: "6000" },
          messages: [
            { role: "system", text: prompt.system },
            { role: "user", text: prompt.user },
          ],
          jsonObject: true,
        }),
      });
      if (!response.ok) throw new Error(`YandexGPT responded ${response.status}`);
      const body = (await response.json()) as CompletionBody;
      const text = body.result?.alternatives?.[0]?.message?.text;
      if (typeof text !== "string") throw new Error("YandexGPT answer has no text");
      return text;
    },
  };
}
