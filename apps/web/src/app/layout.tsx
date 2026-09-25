import type { Metadata } from "next";
import { Cormorant_Garamond, Golos_Text } from "next/font/google";
import type { ReactNode } from "react";
import { Analytics } from "@/components/Analytics";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { YANDEX_VERIFICATION } from "@/lib/analytics";
import { OG_IMAGE, SITE_NAME } from "@/lib/seo";
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
  // Обложка и для личных ссылок, которые пересылают в мессенджерах: приглашение в пару, анкета для друга
  openGraph: { type: "website", locale: "ru_RU", siteName: SITE_NAME, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
