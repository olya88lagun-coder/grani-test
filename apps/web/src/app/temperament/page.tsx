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
      lead="Узнайте, как быстро вы загораетесь, сколько вам нужно общения и насколько сильно вы переживаете. В результате вы увидите свой темперамент на карте двух осей."
      facts="24 утверждения · около 4 минут · бесплатно · без регистрации"
      related={RELATED}
    />
  );
}
