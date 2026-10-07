import { isInviteToken } from "@grani/db";

const INVITE_PREFIX = "invite:";

// В cookie «Вдвоём» лежит не адрес, а перечисление: «space» или «invite:<токен>». Адрес собирается только здесь,
// поэтому подменённая cookie не превращается в переход на чужой сайт
export function togetherEntryValue(entry: string | null, token: string | null): string | null {
  if (entry === "space") return "space";
  if (entry === "invite" && token !== null && isInviteToken(token)) return `${INVITE_PREFIX}${token}`;
  return null;
}

export function togetherReturnPath(value: string | null | undefined): string | null {
  if (value === "space") return "/together/start";
  if (value?.startsWith(INVITE_PREFIX)) {
    const token = value.slice(INVITE_PREFIX.length);
    return isInviteToken(token) ? `/together/invite/${token}` : null;
  }
  return null;
}
