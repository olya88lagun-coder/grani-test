import type { NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { handleVkCallback } from "@/server/vk-callback";

export async function POST(request: NextRequest) {
  const config = getEnv().vkCommunity;
  if (!config) return new Response("not found", { status: 404 });
  const payload: unknown = await request.json().catch(() => null);
  const reply = await handleVkCallback(getDb(), config, payload);
  return new Response(reply.body, { status: reply.status, headers: { "content-type": "text/plain; charset=utf-8" } });
}
