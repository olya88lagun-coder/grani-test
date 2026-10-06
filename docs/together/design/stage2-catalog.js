/* Editorial fixtures from stage 2 catalog, not a server catalog replacement. */
window.stage2Catalog = [
  {
    "id": "intro-01",
    "semanticKey": "intro.notice_good.1",
    "version": 1,
    "title": "Замечать хорошее",
    "estimatedMinutes": 5,
    "prompt": "Какой небольшой поступок партнёра недавно сделал ваш день приятнее?",
    "hint": "Вспомните конкретный момент. Одного-двух предложений достаточно.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какой небольшой поступок партнёра недавно сделал ваш день приятнее?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Прочитайте ответы и поблагодарите друг друга за эти моменты.",
    "skipAllowed": true,
    "kind": "intro"
  },
  {
    "id": "intro-02",
    "semanticKey": "intro.care_language.2",
    "version": 1,
    "title": "Забота на вашем языке",
    "estimatedMinutes": 7,
    "prompt": "Какое маленькое действие поможет вам почувствовать заботу на этой неделе?",
    "hint": "Выберите что-то простое и посильное: прогулку, сообщение, помощь или время вместе.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какое маленькое действие поможет вам почувствовать заботу на этой неделе?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Выберите по одному действию из ответов и договоритесь, когда попробуете их.",
    "skipAllowed": true,
    "kind": "intro"
  },
  {
    "id": "intro-03",
    "semanticKey": "intro.our_story.3",
    "version": 1,
    "title": "Момент из нашей истории",
    "estimatedMinutes": 10,
    "prompt": "Какой момент из начала ваших отношений хочется сохранить?",
    "hint": "Можно вспомнить встречу, разговор или небольшой смешной эпизод. Любой вопрос можно пропустить.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какой момент из начала ваших отношений хочется сохранить?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Поделитесь воспоминаниями. Каждый может выбрать свой ответ для черновика книги.",
    "skipAllowed": true,
    "kind": "intro"
  },
  {
    "id": "m01-d01",
    "semanticKey": "month01.context_question.1",
    "version": 1,
    "kind": "main",
    "order": 1,
    "week": 1,
    "title": "Как встречать друг друга вечером",
    "format": "context_question",
    "estimatedMinutes": 5,
    "prompt": "Как вам удобнее переходить от дел дня к общению с партнёром?",
    "hint": "Можно выбрать несколько минут тишины, короткий разговор или простое приветствие. Опишите свой вариант.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Как вам удобнее переходить от дел дня к общению с партнёром?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Какое конкретное действие партнёра вам подойдёт при встрече?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "В какой момент это уместно?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Сегодня попробуйте выбранный каждым способ встречи. Если сейчас неудобно, договоритесь о другом дне.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "attention",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "everyday_rhythm",
      "requiresExplicitSelection": true
    },
    "purpose": "Узнать контекст: когда и в какой форме внимание уместно."
  },
  {
    "id": "m01-d02",
    "semanticKey": "month01.choice_then_text.2",
    "version": 1,
    "kind": "main",
    "order": 2,
    "week": 1,
    "title": "Сначала выслушать или помочь?",
    "format": "choice_then_text",
    "estimatedMinutes": 5,
    "prompt": "Когда вы рассказываете о небольшом затруднении, чего чаще хочется сначала: чтобы вас выслушали, предложили идеи или спросили?",
    "hint": "Отвечайте про обычные повседневные ситуации. Можно написать свой вариант.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Когда вы рассказываете о небольшом затруднении, чего чаще хочется сначала: чтобы вас выслушали, предложили идеи или спросили?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Какая короткая фраза поможет понять, что вам сейчас нужно?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "Когда её лучше произнести?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "По очереди расскажите о небольшой задаче. Перед ответом спросите: «Тебя послушать или вместе подумать?»",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "attention",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "care_preferences",
      "requiresExplicitSelection": true
    },
    "purpose": "Узнать контекст: когда и в какой форме внимание уместно."
  },
  {
    "id": "m01-d03",
    "semanticKey": "month01.message_design.3",
    "version": 1,
    "kind": "main",
    "order": 3,
    "week": 1,
    "title": "Сообщение, которому приятно обрадоваться",
    "format": "message_design",
    "estimatedMinutes": 5,
    "prompt": "Какое короткое сообщение от партнёра было бы приятно получить в обычный день?",
    "hint": "Придумайте пример без требования отвечать сразу. Это может быть приглашение, смешная деталь или просто тёплая фраза.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какое короткое сообщение от партнёра было бы приятно получить в обычный день?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Если обоим подходит, отправьте друг другу такие сообщения в удобное время. Быстрый ответ не обязателен.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "small_gestures",
      "requiresExplicitSelection": true
    },
    "purpose": "Узнать контекст: когда и в какой форме внимание уместно."
  },
  {
    "id": "m01-d04",
    "semanticKey": "month01.observation.4",
    "version": 1,
    "kind": "main",
    "order": 4,
    "week": 1,
    "title": "Одна хорошая деталь дня",
    "format": "observation",
    "estimatedMinutes": 5,
    "prompt": "Что сегодня оказалось приятным вне ваших отношений?",
    "hint": "Это может быть свет в окне, музыка, удачная задача или вкусный чай. Выберите один конкретный момент.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Что сегодня оказалось приятным вне ваших отношений?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Расскажите об этой детали друг другу и задайте по одному любопытному вопросу.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "everyday_memories",
      "requiresExplicitSelection": true
    },
    "purpose": "Узнать контекст: когда и в какой форме внимание уместно."
  },
  {
    "id": "m01-d05",
    "semanticKey": "month01.context_question.5",
    "version": 1,
    "kind": "main",
    "order": 5,
    "week": 1,
    "title": "Когда мало сил",
    "format": "context_question",
    "estimatedMinutes": 5,
    "prompt": "Что из простых вещей делает ваш обычный уставший вечер немного легче?",
    "hint": "Выберите посильный вариант. Можно честно попросить время для себя.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Что из простых вещей делает ваш обычный уставший вечер немного легче?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Какое небольшое действие партнёра действительно облегчило бы такой вечер?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "Как понять, что предложение уместно?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Сегодня предложите помощь в выбранной форме. Второй человек может принять её или перенести.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "ease",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "care_preferences",
      "requiresExplicitSelection": true
    },
    "purpose": "Узнать контекст: когда и в какой форме внимание уместно."
  },
  {
    "id": "m01-d06",
    "semanticKey": "month01.environment_choice.6",
    "version": 1,
    "kind": "main",
    "order": 6,
    "week": 1,
    "title": "Удобное место рядом",
    "format": "environment_choice",
    "estimatedMinutes": 5,
    "prompt": "Где и в какой обстановке вам приятнее спокойно разговаривать вдвоём?",
    "hint": "Подумайте о свете, шуме, месте и положении: за столом, на прогулке или рядом на диване.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Где и в какой обстановке вам приятнее спокойно разговаривать вдвоём?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Выберите доступное обоим место и проведите там пять минут без специальной темы.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "everyday_rhythm",
      "requiresExplicitSelection": true
    },
    "purpose": "Узнать контекст: когда и в какой форме внимание уместно."
  },
  {
    "id": "m01-d07",
    "semanticKey": "month01.small_experiment.7",
    "version": 1,
    "kind": "main",
    "order": 7,
    "week": 1,
    "title": "Попробовать один способ",
    "format": "small_experiment",
    "estimatedMinutes": 5,
    "prompt": "Какой из предложенных вами на этой неделе способов внимания хочется попробовать один раз?",
    "hint": "Выберите один конкретный вариант из сохранённых ответов. Можно взять другой, если прежние не подходят.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какой из предложенных вами на этой неделе способов внимания хочется попробовать один раз?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Назовите выбранный способ и удобное время. После попытки скажите только, подошёл ли он; оценивать старания партнёра не нужно.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "care_preferences",
      "requiresExplicitSelection": true
    },
    "purpose": "Узнать контекст: когда и в какой форме внимание уместно."
  },
  {
    "id": "m01-d08",
    "semanticKey": "month01.invitation_design.8",
    "version": 1,
    "kind": "main",
    "order": 8,
    "week": 2,
    "title": "Приглашение без угадывания",
    "format": "invitation_design",
    "estimatedMinutes": 5,
    "prompt": "Как вам приятнее получать предложение провести время вместе: заранее, спонтанно или с выбором вариантов?",
    "hint": "Можно уточнить: «В будни заранее, в выходные по настроению».",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Как вам приятнее получать предложение провести время вместе: заранее, спонтанно или с выбором вариантов?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Как должно звучать удобное для вас приглашение?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "Для каких случаев этот вариант подходит?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Составьте короткое приглашение в подходящей партнёру форме. Он может выбрать время или предложить своё.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "attention",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "small_gestures",
      "requiresExplicitSelection": true
    },
    "purpose": "Пробовать слова, приглашения и посильные действия."
  },
  {
    "id": "m01-d09",
    "semanticKey": "month01.recognition.9",
    "version": 1,
    "kind": "main",
    "order": 9,
    "week": 2,
    "title": "Замечать усилие",
    "format": "recognition",
    "estimatedMinutes": 5,
    "prompt": "Какое ваше небольшое повседневное усилие вам было бы приятно сделать заметным?",
    "hint": "Можно назвать работу, учёбу, заботу о доме или личную задачу. Ответ не обязывает партнёра хвалить.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какое ваше небольшое повседневное усилие вам было бы приятно сделать заметным?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Прочитайте ответы. Если хочется, скажите одну конкретную добрую фразу об этом усилии.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "words_about_each_other",
      "requiresExplicitSelection": true
    },
    "purpose": "Пробовать слова, приглашения и посильные действия."
  },
  {
    "id": "m01-d10",
    "semanticKey": "month01.practical_question.10",
    "version": 1,
    "kind": "main",
    "order": 10,
    "week": 2,
    "title": "Помощь, которую удобно принять",
    "format": "practical_question",
    "estimatedMinutes": 5,
    "prompt": "С какой небольшой бытовой задачей вам было бы удобно принять помощь на этой неделе?",
    "hint": "Выберите понятную задачу с небольшим объёмом. Можно ответить, что сейчас помощь не нужна.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "С какой небольшой бытовой задачей вам было бы удобно принять помощь на этой неделе?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Какую конкретную помощь вам удобно принять?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "Когда и в каком объёме?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Тот, кто может помочь, уточняет объём и время. Договорённость появляется только при согласии обоих.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "ease",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "small_agreements",
      "requiresExplicitSelection": true
    },
    "purpose": "Пробовать слова, приглашения и посильные действия."
  },
  {
    "id": "m01-d11",
    "semanticKey": "month01.quiet_activity.11",
    "version": 1,
    "kind": "main",
    "order": 11,
    "week": 2,
    "title": "Вместе без разговора",
    "format": "quiet_activity",
    "estimatedMinutes": 5,
    "prompt": "Какое спокойное занятие вам было бы приятно делать рядом, даже если разговаривать не хочется?",
    "hint": "Например, каждый читает своё, вы готовите или рисуете. Можно предложить другой формат.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какое спокойное занятие вам было бы приятно делать рядом, даже если разговаривать не хочется?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Попробуйте десять минут такого соседства. Занятие и молчание не обязательны.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "shared_activities",
      "requiresExplicitSelection": true
    },
    "purpose": "Пробовать слова, приглашения и посильные действия."
  },
  {
    "id": "m01-d12",
    "semanticKey": "month01.ritual_design.12",
    "version": 1,
    "kind": "main",
    "order": 12,
    "week": 2,
    "title": "Маленькое приветствие",
    "format": "ritual_design",
    "estimatedMinutes": 5,
    "prompt": "Какой небольшой способ здороваться или прощаться вам нравится?",
    "hint": "Выберите слова, жест или короткое действие, комфортное обоим. Прикосновения всегда по желанию.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какой небольшой способ здороваться или прощаться вам нравится?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Какой способ приветствия вам подходит?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "Когда вы хотели бы его использовать?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Спросите, подходит ли предложенное действие партнёру, и попробуйте его в ближайший удобный момент.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "attention",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "small_gestures",
      "requiresExplicitSelection": true
    },
    "purpose": "Пробовать слова, приглашения и посильные действия."
  },
  {
    "id": "m01-d13",
    "semanticKey": "month01.language_choice.13",
    "version": 1,
    "kind": "main",
    "order": 13,
    "week": 2,
    "title": "Как звучит благодарность",
    "format": "language_choice",
    "estimatedMinutes": 5,
    "prompt": "В какой форме вам приятнее слышать благодарность: коротко, с подробностью или через небольшое действие?",
    "hint": "Можно написать пример. Это предпочтение, а не требование постоянной благодарности.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "В какой форме вам приятнее слышать благодарность: коротко, с подробностью или через небольшое действие?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Если есть повод, поблагодарите друг друга в выбранной форме.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "words_about_each_other",
      "requiresExplicitSelection": true
    },
    "purpose": "Пробовать слова, приглашения и посильные действия."
  },
  {
    "id": "m01-d14",
    "semanticKey": "month01.creative_action.14",
    "version": 1,
    "kind": "main",
    "order": 14,
    "week": 2,
    "title": "Жест в своём стиле",
    "format": "creative_action",
    "estimatedMinutes": 5,
    "prompt": "Какой небольшой знак внимания вы сами хотели бы предложить партнёру?",
    "hint": "Выберите действие, которое вам приятно и посильно сделать. Сначала уточните, подходит ли оно второму.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какой небольшой знак внимания вы сами хотели бы предложить партнёру?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Предложите свой жест. Каждый может согласиться, выбрать другой вариант или отложить.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "small_gestures",
      "requiresExplicitSelection": true
    },
    "purpose": "Пробовать слова, приглашения и посильные действия."
  },
  {
    "id": "m01-d15",
    "semanticKey": "month01.context_question.15",
    "version": 1,
    "kind": "main",
    "order": 15,
    "week": 3,
    "title": "Утро чуть легче",
    "format": "context_question",
    "estimatedMinutes": 5,
    "prompt": "Что помогает вам спокойно начать обычное утро?",
    "hint": "Подумайте о времени, разговоре, завтраке или подготовке вещей. Не нужно менять весь распорядок.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Что помогает вам спокойно начать обычное утро?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Какое маленькое действие партнёра облегчило бы вам утро?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "Когда оно действительно полезно?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Выберите один посильный способ не мешать или помочь партнёру утром.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "ease",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "everyday_rhythm",
      "requiresExplicitSelection": true
    },
    "purpose": "Найти удобный ритм и простой совместный ритуал."
  },
  {
    "id": "m01-d16",
    "semanticKey": "month01.shared_choice.16",
    "version": 1,
    "kind": "main",
    "order": 16,
    "week": 3,
    "title": "Небольшая пауза за едой",
    "format": "shared_choice",
    "estimatedMinutes": 5,
    "prompt": "Какой простой совместный завтрак, обед или перекус вам хотелось бы устроить?",
    "hint": "Выбирайте привычный доступный вариант. Можно обойтись чаем или водой; готовить специально не требуется.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какой простой совместный завтрак, обед или перекус вам хотелось бы устроить?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Найдите удобное короткое время и попробуйте выбранный формат.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "shared_activities",
      "requiresExplicitSelection": true
    },
    "purpose": "Найти удобный ритм и простой совместный ритуал."
  },
  {
    "id": "m01-d17",
    "semanticKey": "month01.environment_experiment.17",
    "version": 1,
    "kind": "main",
    "order": 17,
    "week": 3,
    "title": "Одна деталь обстановки",
    "format": "environment_experiment",
    "estimatedMinutes": 5,
    "prompt": "Какую небольшую деталь дома или места встречи вам хотелось бы сделать удобнее?",
    "hint": "Например, убрать одну вещь со стола, изменить свет или выбрать более тихое место.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какую небольшую деталь дома или места встречи вам хотелось бы сделать удобнее?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Выберите одно изменение, с которым согласны оба, и попробуйте его. Покупки не требуются.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "small_agreements",
      "requiresExplicitSelection": true
    },
    "purpose": "Найти удобный ритм и простой совместный ритуал."
  },
  {
    "id": "m01-d18",
    "semanticKey": "month01.personal_space.18",
    "version": 1,
    "kind": "main",
    "order": 18,
    "week": 3,
    "title": "Время переключиться",
    "format": "personal_space",
    "estimatedMinutes": 5,
    "prompt": "Как вам удобнее обозначить, что нужно немного времени для себя, а потом хочется вернуться к общению?",
    "hint": "Можно подобрать короткую фразу и примерное время возвращения. Отвечайте без объяснения личных причин.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Как вам удобнее обозначить, что нужно немного времени для себя, а потом хочется вернуться к общению?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Какая фраза и какое действие партнёра помогут вам переключиться?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "Как вы сами сообщите, что снова готовы общаться?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Обменяйтесь фразами. Каждый уточняет, правильно ли понял предпочтение второго.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "ease",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "everyday_rhythm",
      "requiresExplicitSelection": true
    },
    "purpose": "Найти удобный ритм и простой совместный ритуал."
  },
  {
    "id": "m01-d19",
    "semanticKey": "month01.time_choice.19",
    "version": 1,
    "kind": "main",
    "order": 19,
    "week": 3,
    "title": "Короткое окно для двоих",
    "format": "time_choice",
    "estimatedMinutes": 5,
    "prompt": "Какой небольшой промежуток на этой неделе вы оба могли бы посвятить друг другу?",
    "hint": "Можно выбрать пять минут. Если кому-то нужно оставаться на связи, это учитывается.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какой небольшой промежуток на этой неделе вы оба могли бы посвятить друг другу?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Назовите подходящее время и занятие. Уберите только те отвлечения, от которых оба готовы отказаться.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "small_agreements",
      "requiresExplicitSelection": true
    },
    "purpose": "Найти удобный ритм и простой совместный ритуал."
  },
  {
    "id": "m01-d20",
    "semanticKey": "month01.ritual_proposal.20",
    "version": 1,
    "kind": "main",
    "order": 20,
    "week": 3,
    "title": "Ритуал из обычного",
    "format": "ritual_proposal",
    "estimatedMinutes": 5,
    "prompt": "Какое простое совместное действие хочется иногда повторять?",
    "hint": "Пусть оно легко помещается в жизнь: чай, прогулка, музыка или короткий разговор. Ежедневность не обязательна.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какое простое совместное действие хочется иногда повторять?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      },
      {
        "id": "care_action",
        "type": "short_text",
        "label": "Как называется предложенный вами ритуал?",
        "required": false,
        "maxLength": 180
      },
      {
        "id": "care_context",
        "type": "short_text",
        "label": "Когда и сколько времени вам удобно ему уделять?",
        "required": false,
        "maxLength": 100
      },
      {
        "id": "allow_care_reward",
        "type": "boolean",
        "label": "Предлагаю этот пункт для итоговой карточки",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Предложите по одному варианту и попробуйте тот, который подходит обоим.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": {
      "type": "ritual",
      "actionField": "care_action",
      "contextField": "care_context",
      "consentField": "allow_care_reward"
    },
    "bookBinding": {
      "section": "shared_rituals",
      "requiresExplicitSelection": true
    },
    "purpose": "Найти удобный ритм и простой совместный ритуал."
  },
  {
    "id": "m01-d21",
    "semanticKey": "month01.creative_selection.21",
    "version": 1,
    "kind": "main",
    "order": 21,
    "week": 3,
    "title": "Музыка для общего вечера",
    "format": "creative_selection",
    "estimatedMinutes": 5,
    "prompt": "Назовите до трёх музыкальных произведений или звуков, подходящих для приятного совместного вечера.",
    "hint": "Можно выбрать тишину, знакомый альбом или звуки прогулки. Вкусы не обязаны совпадать.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Назовите до трёх музыкальных произведений или звуков, подходящих для приятного совместного вечера.",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "По очереди покажите один свой выбор и вместе решите, хочется ли его сохранить.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "shared_activities",
      "requiresExplicitSelection": true
    },
    "purpose": "Найти удобный ритм и простой совместный ритуал."
  },
  {
    "id": "m01-d22",
    "semanticKey": "month01.joint_decision.22",
    "version": 1,
    "kind": "main",
    "order": 22,
    "week": 4,
    "title": "Выбирать из двух хороших вариантов",
    "format": "joint_decision",
    "estimatedMinutes": 5,
    "prompt": "Предложите два простых способа провести ближайший свободный получас вместе.",
    "hint": "Оба варианта должны быть посильными. Можно написать «сейчас не знаю» и выбрать позже.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Предложите два простых способа провести ближайший свободный получас вместе.",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Каждый отмечает подходящие варианты. Совпавший выбираете вместе; при несовпадении придумываете третий.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "small_agreements",
      "requiresExplicitSelection": true
    },
    "purpose": "Отредактировать личные предпочтения и общий ритуал."
  },
  {
    "id": "m01-d23",
    "semanticKey": "month01.language_design.23",
    "version": 1,
    "kind": "main",
    "order": 23,
    "week": 4,
    "title": "Приглашение можно перенести",
    "format": "language_design",
    "estimatedMinutes": 5,
    "prompt": "Как вам удобно ответить на приглашение, если сейчас не получается, но хочется встретиться позже?",
    "hint": "Напишите короткую фразу и, если возможно, предложите другое время. Объяснять причину не обязательно.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Как вам удобно ответить на приглашение, если сейчас не получается, но хочется встретиться позже?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Потренируйтесь на вымышленном приглашении и уточните, понятна ли фраза второму.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "small_agreements",
      "requiresExplicitSelection": true
    },
    "purpose": "Отредактировать личные предпочтения и общий ритуал."
  },
  {
    "id": "m01-d24",
    "semanticKey": "month01.schedule_question.24",
    "version": 1,
    "kind": "main",
    "order": 24,
    "week": 4,
    "title": "Время, которое подходит обоим",
    "format": "schedule_question",
    "estimatedMinutes": 5,
    "prompt": "В какой части дня вам проще уделять немного внимания друг другу?",
    "hint": "Учитывайте разные графики. Можно выбрать разные варианты для будней и выходных.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "В какой части дня вам проще уделять немного внимания друг другу?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Найдите одно пересечение или договоритесь каждый раз уточнять время.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "everyday_rhythm",
      "requiresExplicitSelection": true
    },
    "purpose": "Отредактировать личные предпочтения и общий ритуал."
  },
  {
    "id": "m01-d25",
    "semanticKey": "month01.practical_offer.25",
    "version": 1,
    "kind": "main",
    "order": 25,
    "week": 4,
    "title": "Могу предложить вот это",
    "format": "practical_offer",
    "estimatedMinutes": 5,
    "prompt": "Какую небольшую помощь вы сами готовы иногда предлагать партнёру?",
    "hint": "Назовите посильное действие и его границы. Это добровольное предложение, а не постоянная обязанность.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какую небольшую помощь вы сами готовы иногда предлагать партнёру?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Партнёр говорит, подходит ли помощь и как удобнее о ней договариваться.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "small_agreements",
      "requiresExplicitSelection": true
    },
    "purpose": "Отредактировать личные предпочтения и общий ритуал."
  },
  {
    "id": "m01-d26",
    "semanticKey": "month01.reflection.26",
    "version": 1,
    "kind": "main",
    "order": 26,
    "week": 4,
    "title": "Что из попробованного подошло",
    "format": "reflection",
    "estimatedMinutes": 5,
    "prompt": "Какой опыт этого месяца вам хочется сохранить, а какой лучше изменить?",
    "hint": "Выберите один конкретный опыт. Можно сказать, что пока ничего не выбрали.",
    "fields": [
      {
        "id": "answer",
        "type": "short_text",
        "label": "Какой опыт этого месяца вам хочется сохранить, а какой лучше изменить?",
        "required": true,
        "maxLength": 1200
      },
      {
        "id": "share_in_book",
        "type": "boolean",
        "label": "Хочу выбрать свой ответ для будущей книги",
        "required": false,
        "default": false,
        "availableAt": "after_reveal"
      }
    ],
    "revealPolicy": "after_both_submit",
    "jointAction": "Каждый предлагает небольшую корректировку одного действия. Сохраняйте только то, что подходит обоим.",
    "completion": "shared_ack_after_reveal",
    "skipAllowed": true,
    "comfort": "ordinary_daily_life",
    "rewardBinding": null,
    "bookBinding": {
      "section": "care_preferences",
      "requiresExplicitSelection": true
    },
    "purpose": "Отредактировать личные предпочтения и общий ритуал."
  }
];
