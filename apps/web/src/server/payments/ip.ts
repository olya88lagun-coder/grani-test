import { BlockList, isIP } from "node:net";

// Адреса, с которых ЮKassa присылает уведомления (документация «Входящие уведомления»)
export const YOOKASSA_NETWORKS: readonly string[] = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
  "2a02:5180::/32",
];

const allowed = new BlockList();
for (const network of YOOKASSA_NETWORKS) {
  const [address, prefix] = network.split("/") as [string, string];
  allowed.addSubnet(address, Number(prefix), isIP(address) === 6 ? "ipv6" : "ipv4");
}

const MAPPED_IPV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export function isYooKassaIp(ip: string | null): boolean {
  if (!ip) return false;
  const address = ip.match(MAPPED_IPV4)?.[1] ?? ip;
  const family = isIP(address);
  if (family === 0) return false;
  return allowed.check(address, family === 6 ? "ipv6" : "ipv4");
}

// Caddy заменяет X-Forwarded-For, пришедший от клиента, поэтому первый адрес — настоящий
export function requestIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
