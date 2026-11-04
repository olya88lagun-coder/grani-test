import { isFunnelStep } from "@grani/core";
import { countFunnelStep } from "@grani/db";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

// Тело — только название шага, без cookie и адреса: в таблицу попадает число за день, а не человек.
// shortcut: без ограничения частоты накрутить счётчик может любой, при заметном трафике добавить лимит по IP в Caddy
export async function POST(request: Request) {
  const step = (await request.text()).trim();
  if (!isFunnelStep(step)) return new Response(null, { status: 400 });
  await countFunnelStep(getDb(), step, new Date());
  return new Response(null, { status: 204 });
}
