import type { CardView, HistoryItem, Progress } from "@/lib/together-cards-view";
import type { SpaceView } from "@/lib/together-view";

export type ApiResult<T = Record<string, unknown>> = { ok: boolean; status: number; body: T & { ok?: boolean; error?: string } };

// Тонкая обёртка над fetch: сервер всегда отвечает JSON-конвертом { ok, error? }; сеть или разбор не удались — status 0
export async function callApi<T = Record<string, unknown>>(url: string, init?: { body?: unknown; method?: "POST" | "PUT" | "DELETE" }): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: init ? (init.method ?? "POST") : "GET",
      headers: init ? { "content-type": "application/json" } : undefined,
      body: init ? JSON.stringify(init.body ?? {}) : undefined,
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as ApiResult<T>["body"];
    return { ok: response.ok && body.ok !== false, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: "network" } as ApiResult<T>["body"] };
  }
}

export async function readSpace(): Promise<{ ok: true; space: SpaceView | null } | { ok: false; status: number }> {
  const result = await callApi<{ space: SpaceView | null }>("/api/together/space");
  return result.ok ? { ok: true, space: result.body.space ?? null } : { ok: false, status: result.status };
}

export const LOGIN_AGAIN_URL = "/api/together/enter?next=space";

export type CurrentCard = { card: CardView | null; progress: Progress };

export const readCurrentCard = () => callApi<CurrentCard>("/api/together/cards/current");
export const readHistory = (before?: number) => callApi<{ items: HistoryItem[]; next: number | null }>(`/api/together/history${before === undefined ? "" : `?before=${before}`}`);
