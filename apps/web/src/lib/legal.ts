// Оператор персональных данных — самозанятая, указана так же, как в «Мой налог»
export const OPERATOR = { name: "Лагутенкова Ольга Валентиновна", inn: "744923234850", email: "lagutenkova.olga@yandex.ru" } as const;

export const LEGAL_VERSIONS = { consent: "2026-09-v2", privacy: "2026-09-v1", offer: "2026-09-v2" } as const;
export const OFFER_VERSION = LEGAL_VERSIONS.offer;
export const LEGAL_DATE = "22 сентября 2026 года";

export const DATA_STORAGE = "на сервере в Москве (Timeweb Cloud)";

export type DataRecipient = { name: string; what: string; why: string };

// Кому и что уходит. Политика и согласие читают один список, чтобы они не расходились.
// Все получатели — российские сервисы: вход через Telegram в первой версии выключен, чтобы не было трансграничной передачи
export const DATA_RECIPIENTS: readonly DataRecipient[] = [
  {
    name: "ЮKassa",
    what: "сумма и назначение платежа; данные карты вводятся на стороне ЮKassa и сайту не передаются",
    why: "приём оплаты и отправка чека",
  },
  {
    name: "YandexGPT или GigaChat",
    what: "баллы по пяти чертам, их уровни и выбранные тексты — без имени, пола и идентификаторов",
    why: "подготовка текста платного разбора",
  },
  { name: "ВКонтакте", what: "текст уведомления", why: "уведомления через сообщения сообщества, если вы разрешили сообщения" },
  {
    name: "Яндекс.Метрика",
    what: "обезличенные данные о посещении: cookie, просмотренные страницы, устройство",
    why: "статистика посещений — только если вы приняли cookie",
  },
];

// Метрика включается отдельным согласием в cookie-баннере, поэтому в согласии при входе её нет
export const LOGIN_CONSENT_RECIPIENTS = DATA_RECIPIENTS.filter((recipient) => recipient.name !== "Яндекс.Метрика");
