import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOGIN_INTRO } from "@/lib/login-context";
import { loginErrorMessage } from "@/lib/login-errors";
import { getEnv } from "@/server/env";
import { PAIR_COOKIE, PENDING_COOKIE, TOGETHER_COOKIE } from "@/server/http";
import { confirmPendingResult, resolveLoginContext } from "@/server/login-context";
import { currentUser } from "@/server/viewer";
import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";
import { GemPortrait } from "@/components/GemPortrait";
import { gemAssetDir } from "@/lib/gem-assets";
import { typeCodeToDir } from "@grani/content";
import { LoginPanel } from "./LoginPanel";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, user, store] = await Promise.all([searchParams, currentUser(), cookies()]);
  if (user) redirect("/me");
  const message = loginErrorMessage(error ?? null);
  // Вступление зависит от подтверждённого контекста (подписанный результат, корректное приглашение), а не от наличия cookie
  const cookieValues = { pending: store.get(PENDING_COOKIE)?.value ?? null, pairInvite: store.get(PAIR_COOKIE)?.value ?? null, together: store.get(TOGETHER_COOKIE)?.value ?? null };
  const secret = getEnv().SESSION_SECRET;
  const [context, hasPendingResult] = await Promise.all([resolveLoginContext(cookieValues, secret), confirmPendingResult(cookieValues.pending, secret)]);
  const intro = LOGIN_INTRO[context];
  return (
    <main className={`inner-page ${styles.page}`} data-night-entry data-band="night">
      <div className={styles.container}>
        <InAppBrowserNotice place="login" hasPendingResult={hasPendingResult} />
        <section className={styles.panel} aria-labelledby="login-title">
          <div className={styles.gem} aria-hidden="true"><GemPortrait dir={gemAssetDir(typeCodeToDir("+-++"))} size={132} priority /></div>
          <h1 className={styles.title} id="login-title">{intro.title}</h1>
          {message && (
            <p className={`error ${styles.error}`} role="alert">
              {message}
            </p>
          )}
          <LoginPanel lead={intro.lead} />
        </section>
        <InAppBrowserNotice place="login-fallback" hasPendingResult={hasPendingResult} />
      </div>
    </main>
  );
}
