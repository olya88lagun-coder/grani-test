import type { Metadata } from "next";
import { Cormorant_Garamond, Golos_Text } from "next/font/google";
import type { ReactNode } from "react";
import { Analytics } from "@/components/Analytics";
import { Footer } from "@/components/Footer";
import { YANDEX_VERIFICATION } from "@/lib/analytics";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["300"], variable: "--font-cormorant" });
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "600"], variable: "--font-golos" });

// Абсолютные адреса для превью ссылок; при сборке образа переменных окружения ещё нет
const PUBLIC_URL = process.env.APP_URL ?? "https://grani-test.ru";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_URL),
  title: { default: "Грани — тест личности", template: "%s — Грани" },
  description: "Узнай свой тип личности и как тебя видят другие. 10 минут, бесплатно.",
  // По умолчанию страницы закрыты от поиска: результаты, разборы и ссылки-приглашения личные.
  // Публичные страницы включают индексацию через publicMetadata
  robots: { index: false, follow: false },
  verification: { yandex: YANDEX_VERIFICATION },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
