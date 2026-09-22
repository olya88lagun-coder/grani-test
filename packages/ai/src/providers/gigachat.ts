import { randomUUID } from "node:crypto";
import type { ReportWriter } from "../generate";

export const GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
export const GIGACHAT_CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions";
const DEFAULT_MODEL = "GigaChat";
const REFRESH_MARGIN_MS = 60_000;
const UNAUTHORIZED = 401;

type Token = { value: string; expiresAt: number };
type ChatBody = { choices?: { message?: { content?: unknown } }[] };

export function createGigaChatWriter(p: {
  authKey: string;
  scope: string;
  fetchFn: typeof fetch;
  now?: () => number;
  requestId?: () => string;
  model?: string;
}): ReportWriter {
  const now = p.now ?? Date.now;
  let token: Token | null = null;

  async function accessToken(signal: AbortSignal): Promise<string> {
    if (token && now() < token.expiresAt - REFRESH_MARGIN_MS) return token.value;
    const response = await p.fetchFn(GIGACHAT_OAUTH_URL, {
      method: "POST",
      signal,
      headers: {
        authorization: `Basic ${p.authKey}`,
        rquid: (p.requestId ?? randomUUID)(),
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: `scope=${encodeURIComponent(p.scope)}`,
    });
    if (!response.ok) throw new Error(`GigaChat OAuth responded ${response.status}`);
    const body = (await response.json()) as { access_token?: unknown; expires_at?: unknown };
    if (typeof body.access_token !== "string" || typeof body.expires_at !== "number") throw new Error("GigaChat OAuth answer has no token");
    token = { value: body.access_token, expiresAt: body.expires_at };
    return token.value;
  }

  return {
    name: "gigachat",
    async complete(prompt, signal) {
      const response = await p.fetchFn(GIGACHAT_CHAT_URL, {
        method: "POST",
        signal,
        headers: { authorization: `Bearer ${await accessToken(signal)}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          model: p.model ?? DEFAULT_MODEL,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0.3,
          max_tokens: 6000,
        }),
      });
      // Отозванный или просроченный токен: следующая попытка получит новый
      if (response.status === UNAUTHORIZED) token = null;
      if (!response.ok) throw new Error(`GigaChat responded ${response.status}`);
      const body = (await response.json()) as ChatBody;
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("GigaChat answer has no content");
      return content;
    },
  };
}
