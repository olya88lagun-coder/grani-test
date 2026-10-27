import type { Metadata } from "next";
import { YearExperience } from "./YearExperience";

export const metadata: Metadata = {
  title: "Мои грани — 2027",
  description: "Шесть коротких вопросов о прошедшем годе и личная карта следующего: опоры, первый шаг и план, если что-то помешает.",
  robots: { index: false, follow: false },
};

export default function NewYearPage() {
  return <YearExperience />;
}
