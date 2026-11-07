import { ShortTestPage, shortTestPageMetadata } from "@/components/short-tests/ShortTestPage";

export const metadata = shortTestPageMetadata("attachment");

const RELATED = [
  { href: "/big-five-test", label: "Тест Big Five", text: "Покажет пять черт личности и объяснит, откуда берутся ваши реакции." },
  { href: "/compatibility", label: "Тест на совместимость пары", text: "Сравнит вас с партнёром по тем же чертам." },
  { href: "/temperament", label: "Тест на темперамент", text: "Холерик, сангвиник, флегматик или меланхолик — за 4 минуты." },
];

export default function AttachmentTestPage() {
  return <ShortTestPage slug="attachment" facts="30 утверждений · около 5 минут · бесплатно · без регистрации" related={RELATED} palette="pair" />;
}
