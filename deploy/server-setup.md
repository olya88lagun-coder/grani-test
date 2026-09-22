# Грани — выкладка на общий VPS

Сервер `root@200.169.178.231` (Timeweb, Москва) общий с трекером питания (`/opt/food-tracker-bot`) и wishlist (`/opt/wishlist`). У трекера трогаем только две вещи: создаём БД и роль `grani` в его Postgres и **дописываем** блок в его `Caddyfile`. Каталог Граней — `/opt/grani`.

Секреты (токен бота, ключи ВК, ЮKassa и ИИ) вписывает владелица сама прямо на сервере. Их не присылают в чат, не коммитят и не выводят в лог.

## 1. Память

Перед первым запуском память сервера увеличена до 4 ГБ (панель Timeweb → сервер → конфигурация). Swap на 2 ГБ уже настроен для wishlist.

```bash
free -h
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"
```

Лимиты Граней: `web` 350 МБ, `worker` 250 МБ.

## 2. Каталог и база данных

С машины разработчика:

```bash
ssh root@200.169.178.231 'mkdir -p /opt/grani/certs /opt/grani/backups && chmod 700 /opt/grani'
scp deploy/create-db.sql deploy/docker-compose.yml root@200.169.178.231:/opt/grani/
```

На сервере:

```bash
cd /opt/grani
[ -f .db_password ] || { openssl rand -hex 24 > .db_password; chmod 600 .db_password; }
docker exec -i food-tracker-bot-db-1 psql -U food_tracker -d postgres -v ON_ERROR_STOP=1 -v pw="$(cat .db_password)" -At < create-db.sql
```

Последняя строка вывода — `grani`. Скрипт можно запускать повторно.

## 3. `.env`

```bash
cd /opt/grani
[ -f .env ] || cat > .env <<EOF
APP_URL=https://grani-test.ru
DATABASE_URL=postgres://grani:$(cat .db_password)@db:5432/grani
SESSION_SECRET=$(openssl rand -hex 32)
GHCR_OWNER=olya88lagun-coder
NODE_ENV=production
AI_PROVIDER=none
TELEGRAM_BOT_USERNAME=PASTE_BOT_USERNAME
VK_CLIENT_ID=PASTE_VK_CLIENT_ID
TELEGRAM_BOT_TOKEN=PASTE_TOKEN_HERE
EOF
chmod 600 .env
```

Затем владелица открывает `nano /opt/grani/.env` и вписывает значения вместо `PASTE_…`. Остальные переменные с пояснениями перечислены в `deploy/env.example`.

**Пустых переменных быть не должно.** Строка `YOOKASSA_SHOP_ID=` без значения — ошибка настройки, и сайт не запустится. Незаполненное удалить или закомментировать через `#`.

Токен бота из старой переписки скомпрометирован: перед вписыванием получить новый в @BotFather (`/revoke`). Там же `/setdomain` → `grani-test.ru`, иначе виджет входа не работает.

Одновременно токен бота может опрашивать только один процесс: локальный воркер на машине разработчика запускать с `NOTIFICATIONS_DRY_RUN=1`.

## 4. Доступ к образам

Образы `ghcr.io/olya88lagun-coder/grani-{web,worker,migrate}` публикует workflow `images` после каждого мержа в `master`. У пакетов GHCR видимость по умолчанию закрытая, даже у публичного репозитория. Выбрать одно:

- сделать пакеты публичными: GitHub → профиль → Packages → `grani-web` (и `grani-worker`, `grani-migrate`) → Package settings → Change visibility → Public;
- или оставить закрытыми: на сервере уже есть `docker login ghcr.io` для wishlist под тем же владельцем. Проверить командой `docker pull ghcr.io/olya88lagun-coder/grani-web:latest`.

## 5. Первый запуск

После первой публикации образов:

```bash
cd /opt/grani
docker compose --profile tools pull
docker compose run --rm migrate
docker compose up -d web worker
docker compose ps
docker logs --since 5m grani-worker-1 2>&1 | grep '"worker started"'
```

Строка `worker started` показывает, какие каналы уведомлений (`telegram`, `vk`) и какой ИИ (`ai`) включены.

## 6. Caddy

`Caddyfile` трекера смонтирован как отдельный файл: **только дописывать (`>>`)**, не редактировать через `sed -i` или редакторы, которые меняют inode.

```bash
cd /opt/food-tracker-bot
cp Caddyfile Caddyfile.bak-$(date +%Y%m%d%H%M%S)
grep -q "grani-web:3000" Caddyfile || printf "\ngrani-test.ru {\n\tencode gzip\n\treverse_proxy grani-web:3000\n}\n" >> Caddyfile
docker exec food-tracker-bot-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
  && docker exec food-tracker-bot-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
curl -fsS https://grani-test.ru/api/health
curl -fsS -o /dev/null -w "trackermeal %{http_code}\n" https://trackermeal.ru
curl -fsS -o /dev/null -w "wishlist %{http_code}\n" https://my-wish-list.online
```

Если `validate` падает — не перезагружать, восстановить `Caddyfile` из `Caddyfile.bak-*`.

Контейнер Caddy может видеть **старую версию** `Caddyfile`, если файл на хосте когда-то заменили новым (bind-mount одного файла держится за старый inode). Признак: `caddy reload` пишет `config is unchanged`. Применение без перезапуска трекера:

```bash
docker exec -i food-tracker-bot-caddy-1 sh -c "cat > /tmp/Caddyfile" < /opt/food-tracker-bot/Caddyfile
docker exec food-tracker-bot-caddy-1 caddy validate --config /tmp/Caddyfile --adapter caddyfile \
  && docker exec food-tracker-bot-caddy-1 caddy reload --config /tmp/Caddyfile --adapter caddyfile
```

Сертификат для `grani-test.ru` Caddy получает сам при первом запросе. Запись `www.grani-test.ru` не заведена, поэтому блока для `www` нет.

## 7. Автоматическая выкладка

Workflow `deploy` запускается после мержа в `master`. Ему нужны секреты репозитория (GitHub → Settings → Secrets and variables → Actions), такие же, как у wishlist:

- `DEPLOY_HOST` — `200.169.178.231`;
- `DEPLOY_USER` — `root`;
- `DEPLOY_SSH_KEY` — закрытый ключ, открытая часть которого лежит в `~/.ssh/authorized_keys` на сервере;
- `DEPLOY_KNOWN_HOSTS` — вывод `ssh-keyscan 200.169.178.231`.

Без секретов workflow пропускает выкладку и пишет об этом в лог. Выложить вручную:

```bash
cd /opt/grani && docker compose --profile tools pull && docker compose run --rm migrate && docker compose up -d web worker
```

Перед миграциями workflow сохраняет копию базы в `/opt/grani/backups/pre-<тег>.sql.gz` и хранит пять последних.

## 8. VK: вход и сообщество

- **VK ID:** в настройках приложения добавить доверенный Redirect URL `https://grani-test.ru/api/auth/vk/callback` и базовый домен `grani-test.ru`.
- **Callback API сообщества** (vk.ru/club241664000 → Управление → Работа с API → Callback API): версия API 5.199, адрес `https://grani-test.ru/api/vk/callback`, секретный ключ — придумать и вписать в `VK_CALLBACK_SECRET`. Во вкладке «Типы событий» включить «Разрешение на получение сообщений», «Запрет на получение сообщений» и «Входящее сообщение». Строку, которую должен вернуть сервер, вписать в `VK_CONFIRMATION_CODE`, `VK_GROUP_ID=241664000`, ключ доступа сообщества с правом «Сообщения» — в `VK_GROUP_TOKEN`. Затем `docker compose up -d web worker` и «Подтвердить» на странице Callback API.

## 9. ЮKassa

В личном кабинете магазина → Интеграция → HTTP-уведомления: адрес `https://grani-test.ru/api/yookassa/notification`, события `payment.succeeded` и `payment.canceled`. В `.env` — `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`, сначала **тестового** магазина, после проверки — боевого. Затем `docker compose up -d web`.

После включения ключей проверить, что подделанный заголовок не выдаёт запрос за уведомление ЮKassa:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://grani-test.ru/api/yookassa/notification -H "X-Forwarded-For: 185.71.76.1" -d '{}'
```

Ожидается `403`. Если ответ другой — не включать боевые ключи, пока не разберёмся с заголовками в Caddy.

## 10. ИИ

- **YandexGPT:** `AI_PROVIDER=yandex`, `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`.
- **GigaChat:** `AI_PROVIDER=gigachat`, `GIGACHAT_AUTH_KEY`, при необходимости `GIGACHAT_SCOPE`. GigaChat работает с корневым сертификатом Минцифры:

  ```bash
  curl -fsS -o /opt/grani/certs/russian_trusted_root_ca.pem https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt
  ```

  В `.env` — `NODE_EXTRA_CA_CERTS=/certs/russian_trusted_root_ca.pem`. Проверку сертификатов не отключать никогда.

Затем `docker compose up -d worker`. Проверка — строка `worker started` с нужным `ai`.

## 11. Логи и откат

```bash
docker logs --since 30m grani-web-1
docker logs --since 30m grani-worker-1
```

Откат на предыдущий образ:

```bash
cd /opt/grani
docker images ghcr.io/olya88lagun-coder/grani-web --format '{{.Tag}} {{.CreatedAt}}'
docker tag ghcr.io/olya88lagun-coder/grani-web:sha-<предыдущий> ghcr.io/olya88lagun-coder/grani-web:latest
docker tag ghcr.io/olya88lagun-coder/grani-worker:sha-<предыдущий> ghcr.io/olya88lagun-coder/grani-worker:latest
docker compose up -d web worker
```

Миграции не откатываются. Если нужно вернуть базу, её восстанавливают из копии в пустую базу при остановленных `web` и `worker`:

```bash
cd /opt/grani
docker compose stop web worker
docker exec -i food-tracker-bot-db-1 psql -U food_tracker -d postgres -c "DROP DATABASE grani" -c "CREATE DATABASE grani OWNER grani"
gunzip -c backups/pre-<тег>.sql.gz | docker exec -i food-tracker-bot-db-1 psql -U grani -d grani -v ON_ERROR_STOP=1
docker compose up -d web worker
```
