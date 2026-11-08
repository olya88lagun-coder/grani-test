import { pickLoginContext, type LoginContext } from "../lib/login-context";
import { verifyPending, verifyShortPending } from "./auth/tokens";
import { pairReturnPath } from "./pairs-service";
import { parseAnswers } from "./results-service";
import { togetherReturnPath } from "./together-return";

export type LoginContextCookies = { pending?: string | null; pairInvite?: string | null; together?: string | null; shortPending?: string | null };

// Контекст подтверждается самим содержимым cookie, а не её наличием: подпись и полнота ответов у отложенного результата,
// формат токена у приглашения пары, перечисление у «Вдвоём»
export async function confirmPendingResult(pending: string | null | undefined, secret: string): Promise<boolean> {
  return pending ? parseAnswers(await verifyPending(pending, secret)) !== null : false;
}

export async function resolveLoginContext(cookies: LoginContextCookies, secret: string): Promise<LoginContext> {
  const pendingResult = await confirmPendingResult(cookies.pending, secret);
  const shortPending = cookies.shortPending ? await verifyShortPending(cookies.shortPending, secret) : null;
  return pickLoginContext({
    pairInvite: pairReturnPath(cookies.pairInvite) !== null,
    together: togetherReturnPath(cookies.together) !== null,
    pendingResult,
    shortResult: shortPending !== null,
    ...(shortPending?.invite ? { shortKind: "invite" as const } : shortPending?.intent === "pair" ? { shortKind: "pair" as const } : {}),
  });
}
