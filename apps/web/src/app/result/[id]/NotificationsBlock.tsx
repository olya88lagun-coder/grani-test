import { listIdentityNotices } from "@grani/db";
import { VkAllowMessages } from "@/components/VkAllowMessages";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";

export async function NotificationsBlock({ userId }: { userId: string }) {
  const community = getEnv().vkCommunity;
  if (!community) return null;
  const identities = await listIdentityNotices(getDb(), userId);
  const needsVkPermission = identities.some((identity) => identity.provider === "vk" && !identity.canNotify);
  if (!needsVkPermission) return null;

  return (
    <section className="card card--paper stack" aria-labelledby="notifications">
      <p className="eyebrow">Уведомления</p>
      <h2 id="notifications">Сообщать ВКонтакте о новых ответах друзей и паре</h2>
      <p className="muted">Без разрешения всё будет видно здесь, на сайте. Отключить сообщения можно в любой момент в диалоге с сообществом.</p>
      <VkAllowMessages groupId={community.groupId} />
    </section>
  );
}
