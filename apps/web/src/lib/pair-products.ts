// Два продукта «для пары» путают, потому что оба про двоих и оба стоят одинаково. Здесь единый текст о различиях
// для страниц цен, совместимости и «Вдвоём». Цены сюда не пишутся: страницы берут их из PRODUCT_PRICES и констант «Вдвоём»
export type PairProductKey = "compatibility" | "together";

export type PairProduct = {
  key: PairProductKey;
  title: string;
  href: string;
  summary: string;
  needsTest: string;
  period: string;
};

export const PAIR_PRODUCTS: Readonly<Record<PairProductKey, PairProduct>> = {
  compatibility: {
    key: "compatibility",
    title: "Разбор совместимости",
    href: "/compatibility",
    summary: "Карта вашей пары по результатам теста: восемь жизненных ситуаций, подсказки для разговора, общие договорённости и персональный PDF.",
    needsTest: "Тест нужен вам обоим.",
    period: "Разовая покупка: разбор остаётся на странице пары.",
  },
  together: {
    key: "together",
    title: "«Грани. Вдвоём»",
    href: "/together",
    summary: "Общее пространство на месяц: вопросы для разговора и идеи свиданий, на которые вы отвечаете каждый сам, а ответы открываются, когда ответили оба.",
    needsTest: "Тест не нужен, достаточно двух аккаунтов.",
    period: "Доступ на 30 дней, без автопродления.",
  },
};

export const PAIR_PRODUCTS_CHOICE = "Хотите понять, как вы сочетаетесь, выбирайте разбор совместимости. Хотите регулярно разговаривать и проводить время вместе, выбирайте «Вдвоём». Они не заменяют друг друга и покупаются отдельно.";

export const PAIR_PRODUCTS_HOW_TO_CHOOSE_TITLE = "Чем отличаются два продукта для пары";
