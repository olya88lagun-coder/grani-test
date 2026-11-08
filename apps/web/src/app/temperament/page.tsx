import { ShortTestPage, shortTestPageMetadata } from "@/components/short-tests/ShortTestPage";

export const metadata = shortTestPageMetadata("temperament");

const RELATED = [
  { href: "/big-five-test", label: "Тест Big Five", text: "Две оси темперамента — часть пяти черт Big Five. Основной тест покажет все пять." },
  { href: "/privyazannost", label: "Тест на тип привязанности", text: "Как вы ведёте себя в близких отношениях: надёжный, тревожный или избегающий тип." },
  { href: "/articles/temperament", label: "Статья о четырёх темпераментах", text: "История теории, примеры и связь со шкалами Big Five." },
];

export default function TemperamentTestPage() {
  return (
    <ShortTestPage
      slug="temperament"
      lead="Сангвиник, холерик, флегматик или меланхолик? Узнайте, где вы на карте экстраверсии и эмоциональности."
      facts="24 утверждения · около 4 минут · бесплатно · без регистрации"
      related={RELATED}
      heroImage={{ desktop: "/temperament/hero-desktop.webp", mobile: "/temperament/hero-mobile.webp", width: 1600, height: 800 }}
      showContents
    />
  );
}
