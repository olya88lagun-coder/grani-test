import type { Metadata } from "next";
import { Cormorant_Garamond, Golos_Text } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["300"], variable: "--font-cormorant" });
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "600"], variable: "--font-golos" });

// Абсолютные адреса для превью ссылок; при сборке образа переменных окружения ещё нет
const PUBLIC_URL = process.env.APP_URL ?? "https://grani-test.ru";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_URL),
  title: { default: "Грани — тест личности", template: "%s — Грани" },
  description: "Узнай свой тип личности и как тебя видят другие. 10 минут, бесплатно.",
  // Индексация включается в плане 6, когда будут документы и страницы под поиск
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
