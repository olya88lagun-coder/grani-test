import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { YEAR_FAQ } from "@/lib/new-year-faq";
import { faqJsonLd, publicMetadata, webPageJsonLd } from "@/lib/seo";
import { YearExperience } from "./YearExperience";

const PATH = "/new-year-2027";
const TITLE = "Итоги года и личная карта на 2027";
const DESCRIPTION = "Итоги года за шесть коротких вопросов: слово года, опора, что оставить в 2026, первый шаг и план «если — то». Бесплатно, ответы остаются в твоём браузере.";

export const metadata: Metadata = publicMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function NewYearPage() {
  return <>
    <JsonLd data={webPageJsonLd({ title: TITLE, description: DESCRIPTION, path: PATH })} />
    <JsonLd data={faqJsonLd(YEAR_FAQ)} />
    <YearExperience />
  </>;
}
