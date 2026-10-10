import { Document, Image, Page, StyleSheet, Text, View, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import { PAIR_AGREEMENT_TITLES, PAIR_MAP_QUESTIONS } from "@grani/core";
import { PAIR_CONVERSATION_STEPS } from "@/lib/pair-conversation";
import type { PairPerson } from "@/lib/pair-view";
import glyphRanges from "../../../assets/pdf/glyph-ranges.json";
import type { PairPdfSource } from "./source";
import { pairPdfGem } from "./gems";

const fonts = ["PairGolos", "PairEmoji"];
const titleFonts = ["PairCormorant", "PairGolos", "PairEmoji"];
const styles = StyleSheet.create({
  page: { backgroundColor: "#FAF8F2", color: "#193329", padding: 44, paddingBottom: 56, fontFamily: fonts, fontSize: 10.5, lineHeight: 1.55 },
  cover: { backgroundColor: "#061B14", color: "#EEE4D4", padding: 48, fontFamily: fonts },
  brand: { fontSize: 12, letterSpacing: 3, color: "#D9C18B", marginBottom: 36 },
  coverTitle: { fontFamily: titleFonts, fontSize: 49, lineHeight: 1.05, marginBottom: 18 },
  coverIntro: { fontSize: 12, lineHeight: 1.6, width: 360, color: "#B5C5BC" },
  duo: { flexDirection: "row", alignItems: "center", marginTop: 36, marginBottom: 26 },
  person: { width: "35%", alignItems: "center" },
  gem: { width: 120, height: 120, objectFit: "contain", marginBottom: 12 },
  name: { fontSize: 12, marginBottom: 6, textAlign: "center" },
  type: { fontFamily: titleFonts, fontSize: 23, textAlign: "center", lineHeight: 1.05 },
  index: { width: "30%", alignItems: "center", borderWidth: 1, borderColor: "#7D7250", borderRadius: 12, padding: 12 },
  score: { fontFamily: titleFonts, fontSize: 62, color: "#EDD2AD" },
  indexLabel: { fontSize: 9, textAlign: "center", lineHeight: 1.5, color: "#D9C18B" },
  coverNote: { fontSize: 10, lineHeight: 1.6, color: "#B5C5BC", marginTop: 20 },
  kicker: { fontSize: 8, letterSpacing: 1.3, textTransform: "uppercase", color: "#81713D", marginBottom: 10 },
  h1: { fontFamily: titleFonts, fontSize: 32, lineHeight: 1.12, marginBottom: 18 },
  h2: { fontFamily: titleFonts, fontSize: 23, lineHeight: 1.18, marginBottom: 10 },
  h3: { fontWeight: 600, fontSize: 11, marginBottom: 5 },
  paragraph: { marginBottom: 12 },
  note: { fontSize: 9, color: "#55695D", lineHeight: 1.5, marginBottom: 12 },
  box: { backgroundColor: "#EEECE1", borderRadius: 9, padding: 16, marginBottom: 18 },
  quote: { backgroundColor: "#EFDDCB", borderRadius: 8, padding: 14, marginTop: 8, marginBottom: 14 },
  pair: { flexDirection: "row", gap: 22, marginBottom: 12 },
  column: { width: "47%" },
  barTrack: { height: 6, backgroundColor: "#DADFCF", borderRadius: 3, marginTop: 4, marginBottom: 14 },
  barYou: { height: 6, backgroundColor: "#A98859", borderRadius: 3 },
  barPartner: { height: 6, backgroundColor: "#2D6651", borderRadius: 3 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 24, fontSize: 8, color: "#778578", borderTopWidth: 1, borderTopColor: "#DADFCF", paddingTop: 8 },
});
// Preserve unsupported characters as reversible code points instead of invisible .notdef boxes.
export function pairPdfText(value: string): string {
  return Array.from(value).map(char => {
    const code = char.codePointAt(0)!;
    return code === 10 || code === 9 || [0x200D, 0xFE0E, 0xFE0F].includes(code) || glyphRanges.some(([a, b]) => code >= a! && code <= b!) ? char : `[U+${code.toString(16).toUpperCase()}]`;
  }).join("");
}
const P = ({ children }: { children: string }) => <Text style={styles.paragraph}>{pairPdfText(children)}</Text>;
function Sheet({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return <Page size="A4" style={styles.page}><Text style={styles.kicker}>{kicker}</Text><Text style={styles.h1}>{pairPdfText(title)}</Text>{children}<View fixed style={[styles.footer,{height:30}]}><Text>Грани · Карта вашей пары — инструкция друг к другу</Text><Text style={{position:"absolute",right:0,top:8}} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View></Page>;
}
function CoverPerson({ person }: { person: PairPerson }) {
  return <View style={styles.person}><Image src={pairPdfGem(person.dir)} style={styles.gem} /><Text style={styles.name}>{pairPdfText(person.firstName)}</Text><Text style={styles.type}>{pairPdfText(person.typeName)}</Text></View>;
}
export function buildPairPdfDocument(source: PairPdfSource): ReactElement<DocumentProps> {
  const { view, guides } = source; const guide = guides[0]!;
  const generated = new Date(source.generatedAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  return <Document title="Карта вашей пары — инструкция друг к другу" author="Грани" language="ru-RU">
    <Page size="A4" style={styles.cover}><Text style={styles.brand}>ГРАНИ</Text><Text style={{fontSize:12,marginBottom:16,color:"#D9C18B"}}>Карта вашей пары</Text><Text style={styles.coverTitle}>Инструкция{"\n"}друг к другу</Text><Text style={styles.coverIntro}>Поймите, в чём вы похожи, где смотрите на мир по-разному и о чём стоит поговорить.</Text><View style={styles.duo}><CoverPerson person={view.you} /><View style={styles.index}><Text style={styles.score}>{view.score}%</Text><Text style={styles.indexLabel}>Индекс сочетания{"\n"}профилей</Text></View><CoverPerson person={view.partner} /></View><Text style={styles.coverNote}>Это не прогноз отношений: число описывает сочетание профилей, а не вероятность успеха пары. Гипотезы по Big Five стоит проверять в разговоре друг с другом.</Text><Text style={styles.coverNote}>Сохранённый снимок на {generated}. Общие данные после этого могут измениться. Файл содержит личные данные; делитесь им по взаимному согласию.</Text></Page>
    <Sheet kicker="01 / Главное о вашей паре" title="Ваш способ быть вместе"><P>{view.phrase}</P><P>{view.text}</P><View style={styles.box}><Text style={styles.h3}>Ваша общая грань</Text><P>{`Ближе всего ответы по шкале «${guide.common.label}»: разница ${Math.abs(guide.common.you - guide.common.partner)} из 100. Обсудите, в чём вы это узнаёте.`}</P><Text style={styles.h3}>Главное различие</Text><P>{`«${guide.difference.label}»: разница ${Math.abs(guide.difference.you - guide.difference.partner)} из 100. Это повод уточнить удобный для каждого подход.`}</P></View><Text style={styles.h2}>Как использовать карту</Text><P>Выберите одну ситуацию. Каждый читает свою перспективу, затем рассказывает, что узнаёт в ней, а что не подходит. Подсказка помогает задать вопрос, но не объясняет мотивы за другого человека.</P><Text style={styles.note}>Материалы для самопознания, не психологическая и не медицинская диагностика. Индекс не измеряет любовь и не предсказывает успех пары.</Text></Sheet>
    <Sheet kicker="02 / Ваши профили" title="Где вы похожи и где разные"><View style={styles.pair}>{[view.you,view.partner].map((person,i)=><View key={i} style={styles.column}><Text style={styles.h2}>{pairPdfText(person.firstName)}</Text><P>{person.typeName}</P>{view.rows.map(row=><View key={row.trait}><Text style={styles.h3}>{row.label}</Text><Text>{i===0?row.you:row.partner} из 100</Text><View style={styles.barTrack}><View style={[i===0?styles.barYou:styles.barPartner,{width:`${i===0?row.you:row.partner}%`}]} /></View></View>)}</View>)}</View><Text style={styles.note}>Показатели получены из ваших реальных ответов на тест. Опрос пары не меняет эти шкалы. Более высокий балл не означает «лучше».</Text></Sheet>
    {[0,1,2,3].map(page=><Sheet key={page} kicker="03 / Жизненные ситуации" title="Как различия могут проявляться">{guide.situations.slice(page*2,page*2+2).map(s=><View key={s.id} style={styles.box} wrap={false}><Text style={styles.h2}>{s.title}</Text><Text style={styles.note}>{s.subtitle} · {s.label}: {s.score} и {s.otherScore} из 100</Text><P>{`${view.you.firstName}: возможно, важны ${s.need}.`}</P><P>{`${view.partner.firstName}: возможно, важны ${s.partnerNeed}.`}</P><Text style={styles.h3}>Что попробовать</Text><P>{s.action}</P><Text style={styles.h3}>Вопрос друг другу</Text><P>{s.question}</P>{s.caution&&<Text style={styles.note}>{s.caution}</Text>}</View>)}</Sheet>)}
    {[0,1].map(page=><Sheet key={`translator-${page}`} kicker="04 / Переводчик друг друга" title="Переводчик друг друга">{guide.situations.slice(page*4,page*4+4).map(s=><View key={s.id} style={{marginBottom:18}} wrap={false}><Text style={styles.h2}>{s.title}</Text><Text>{pairPdfText(`${view.you.firstName}: ${s.need}. ${view.partner.firstName}: ${s.partnerNeed}.`)}</Text><Text style={styles.quote}>{pairPdfText(s.phrase)}</Text></View>)}<Text style={styles.note}>Это возможные потребности по профилям, не чтение мыслей. Спросите партнёра, подходят ли эти формулировки.</Text></Sheet>)}
    <Sheet kicker="05 / Карта сложного разговора" title="Разговор без взаимных обвинений">{PAIR_CONVERSATION_STEPS.map((s,i)=><View key={s.title} wrap={false}><Text style={styles.h2}>{`0${i+1} · ${s.title}`}</Text><P>{s.text}</P><Text style={styles.quote}>{s.phrase}</Text></View>)}</Sheet>
    <Sheet kicker="06 / Наши договорённости" title="То, что вы подтвердили вдвоём">{source.confirmedAgreements.length ? source.confirmedAgreements.map(a=><View key={a.slot} style={styles.box}><Text style={styles.h2} minPresenceAhead={32}>{PAIR_AGREEMENT_TITLES[a.slot]}</Text><P>{a.text}</P><Text style={styles.note}>Версия {a.revision} · подтверждено обоими на момент скачивания</Text></View>) : <P>Пока нет договорённостей, подтверждённых обоими. Личные черновики и неподтверждённые предложения не включены. Обсудите один маленький шаг на странице карты.</P>}<Text style={styles.h2}>Вам не нужно становиться одинаковыми.</Text><P>Выберите то, что подходит обоим, попробуйте в обычной жизни и вернитесь к разговору через неделю. Не превращайте тест в аргумент против партнёра.</P><Text style={styles.note}>{source.sharedAnswers ? "Раскрытые ответы добавлены далее по вашему выбору." : "Личные ответы не включены в этот файл. На странице их можно добавить только после публикации обоими и отдельного выбора при скачивании."}</Text><Text style={styles.note}>Редкие символы, которых нет в локальных шрифтах, показаны как [U+код]. Исходный символ можно восстановить по этому коду.</Text></Sheet>
    {source.sharedAnswers && <Sheet kicker="Ваши опубликованные ответы" title="То, чем вы поделились друг с другом">{PAIR_MAP_QUESTIONS.map(q=><View key={q.id} style={{marginBottom:20}}><Text style={styles.h2} minPresenceAhead={70}>{q.title}</Text><Text style={styles.note}>{q.question}</Text>{(["mine","partner"] as const).map((side,i)=><View key={side}><Text style={styles.h3} minPresenceAhead={32}>{pairPdfText(`${i===0?view.you.firstName:view.partner.firstName} · версия ${source.sharedAnswers![side].revision}`)}</Text><P>{source.sharedAnswers![side].answers[q.id].skipped ? "Вопрос пропущен" : source.sharedAnswers![side].answers[q.id].text}</P></View>)}</View>)}</Sheet>}
    <Sheet kicker="Дополнительные главы" title="Ещё о вашем сочетании">{source.extras.state==="ready" ? source.extras.sections.map(section=><View key={section.key}><Text style={styles.h2}>{section.title}</Text><P>{section.text}</P></View>) : <P>Дополнительный текстовый разбор ещё готовится. Все базовые разделы карты уже включены. Скачайте новый файл, когда главы появятся на странице.</P>}</Sheet>
  </Document>;
}
