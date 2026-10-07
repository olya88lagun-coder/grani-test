// Оператор персональных данных — самозанятая, указана так же, как в «Мой налог»
export const OPERATOR = {
  name: "Лагутенкова Ольга Валентиновна",
  // Дательный падеж для текста согласия: «даю … Лагутенковой Ольге Валентиновне»
  nameDative: "Лагутенковой Ольге Валентиновне",
  inn: "744923234850",
  email: "lagutenkova.olga@yandex.ru",
} as const;

// Реквизиты, которых нет в коде: их вносит владелица. Пока значение null, предложение с ним на страницах не показывается
type OperatorDetails = { address: string | null; rknNumber: string | null };
export const OPERATOR_DETAILS: OperatorDetails = { address: null, rknNumber: null };

// Адрес для претензий и корреспонденции: почтового адреса у оператора нет, поэтому им служит электронная почта (так решила владелица)
export const correspondenceAddress = (details: OperatorDetails = OPERATOR_DETAILS): string => details.address ?? `электронная почта ${OPERATOR.email}`;

export const LEGAL_VERSIONS = { consent: "2026-10-v3", privacy: "2026-10-v3", offer: "2026-10-v3" } as const;
export const OFFER_VERSION = LEGAL_VERSIONS.offer;
export const LEGAL_DATE = "7 октября 2026 года";

// «Вдвоём»: срок отказа без объяснения причин и срок ответа на заявление о возврате (оферта)
export const TOGETHER_REFUND_DAYS = 7;
export const TOGETHER_REFUND_WORKING_DAYS = 10;

export const DATA_STORAGE = "на сервере в Москве (Timeweb Cloud)";

export type DataRecipient = { name: string; what: string; why: string };

// Кому и что уходит. Политика и согласие читают один список, чтобы они не расходились.
// Все получатели — российские организации: входа через Telegram нет, чтобы не было трансграничной передачи
export const DATA_RECIPIENTS: readonly DataRecipient[] = [
  { name: "ООО «Таймвэб.Клауд» (Timeweb Cloud)", what: "все данные сайта", why: "хранение на сервере в Москве по поручению оператора" },
  {
    name: "ООО НКО «ЮМани» (ЮKassa)",
    what: "сумма, назначение платежа, почта для чека; данные карты вводятся на стороне ЮKassa и сайту не передаются",
    why: "приём оплаты",
  },
  {
    name: "ООО «Яндекс.Облако» (YandexGPT) или ПАО Сбербанк (GigaChat)",
    what: "баллы по пяти чертам, их уровни и выбранные тексты — без имени, пола и идентификаторов",
    why: "подготовка текста платного разбора",
  },
  {
    name: "ООО «ВК» (ВКонтакте, VK ID)",
    what: "идентификатор VK ID и текст уведомления",
    why: "вход на сайт и уведомления через сообщения сообщества, если вы их разрешили",
  },
  {
    name: "ООО «Яндекс» (Яндекс.Метрика)",
    what: "cookie, IP-адрес, просмотренные страницы, сведения об устройстве",
    why: "статистика посещений — только если вы приняли cookie в баннере",
  },
];

// Метрика включается отдельным согласием в cookie-баннере, поэтому в согласии при входе её нет
export const LOGIN_CONSENT_RECIPIENTS = DATA_RECIPIENTS.filter((recipient) => !recipient.name.includes("Метрика"));
