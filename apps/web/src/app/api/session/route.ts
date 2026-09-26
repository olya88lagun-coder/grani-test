import { currentUser } from "@/server/viewer";

export const dynamic = "force-dynamic";

// Шапка статических страниц узнаёт здесь, вошёл ли человек: сами страницы от сессии не зависят и собираются заранее
export async function GET() {
  const user = await currentUser();
  return Response.json({ signedIn: user !== null }, { headers: { "cache-control": "private, no-store" } });
}
