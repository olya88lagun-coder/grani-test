# Задача 7 — Выкладка на VPS: compose, Caddy, база, `deploy.yml`

**Files:**
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile.grani`
- Create: `deploy/create-db.sql`
- Create: `deploy/env.example` (список переменных без значений)
- Create: `deploy/server-setup.md`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: образы из задачи 6; переменные окружения `apps/web/src/server/env.ts` и `apps/worker/src/env.ts`.
- Produces: каталог `/opt/grani` на сервере, контейнеры `grani-web-1`, `grani-worker-1` в сети `food-tracker-bot_default` (алиас `grani-web`), база и роль `grani` в Postgres трекера, блок `grani-test.ru` в Caddy трекера. Workflow `deploy` после каждого мержа в `master`: ждёт образы с тегом коммита, делает копию базы, применяет миграции, перезапускает `web` и `worker` и проверяет сайт снаружи.

## Зачем

Спецификация 5.4: VPS Timeweb (Москва), тот же, что у wishlist и трекера питания. Отдельная база и роль в существующем Postgres, отдельный Docker Compose для `web` и `worker`, отдельный блок в Caddy для `grani-test.ru`. DNS уже указывает на сервер: `grani-test.ru → 200.169.178.231`, проверено 2026-09-22.

Правила общего сервера (из `C:\dev\wishlist\deploy\server-setup.md`):
- `Caddyfile` трекера только дописывается через `>>`, перед этим делается копия;
- `caddy validate` выполняется до `reload`;
- у Caddy трекера бывает «старый inode» — способ применить изменения без перезапуска трекера описан там же.

Эти правила переносятся в `deploy/server-setup.md` Граней дословно.

## Шаги

- [ ] **Шаг 1. `deploy/docker-compose.yml`.**

```yaml
name: grani

services:
  web:
    image: ghcr.io/${GHCR_OWNER}/grani-web:latest
    env_file: .env
    restart: unless-stopped
    mem_limit: 350m
    networks:
      shared:
        aliases: [grani-web]

  worker:
    image: ghcr.io/${GHCR_OWNER}/grani-worker:latest
    env_file: .env
    restart: unless-stopped
    mem_limit: 250m
    stop_grace_period: 30s
    # Корневой сертификат Минцифры для GigaChat (NODE_EXTRA_CA_CERTS=/certs/russian_trusted_root_ca.pem); без GigaChat каталог пустой
    volumes:
      - ./certs:/certs:ro
    networks: [shared]

  migrate:
    image: ghcr.io/${GHCR_OWNER}/grani-migrate:latest
    env_file: .env
    profiles: ["tools"]
    mem_limit: 200m
    networks: [shared]

networks:
  shared:
    external: true
    name: food-tracker-bot_default
```

- [ ] **Шаг 2. `Caddyfile.grani`.**

```
grani-test.ru {
	encode gzip
	reverse_proxy grani-web:3000
}

www.grani-test.ru {
	redir https://grani-test.ru{uri} permanent
}
```

Блок `www` добавляется, только если у домена есть запись `www` (шаг 7 проверяет `nslookup www.grani-test.ru`). Без записи Caddy не получит сертификат и будет повторять попытки в логе.

`X-Forwarded-For`: Caddy по умолчанию не доверяет входящему заголовку от клиента и ставит свой. На этом держится проверка IP ЮKassa (план 5, задача 5). Проверка — шаг 8.

- [ ] **Шаг 3. `create-db.sql`** — копия wishlist с заменой `wishlist` на `grani`:

```sql
SELECT format('CREATE ROLE grani LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grani') \gexec

SELECT 'CREATE DATABASE grani OWNER grani'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'grani') \gexec

SELECT datname FROM pg_database WHERE datname = 'grani';
```

- [ ] **Шаг 4. `env.example`.** Все переменные без значений, с комментарием, кто их вписывает:

```
# Вписывает сервер-setup (шаг «.env»)
APP_URL=https://grani-test.ru
DATABASE_URL=postgres://grani:<пароль из .db_password>@db:5432/grani
SESSION_SECRET=<openssl rand -hex 32>
GHCR_OWNER=olya88lagun-coder
NODE_ENV=production

# Вписывает владелица (секреты — агенту не присылать)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
VK_CLIENT_ID=
VK_GROUP_ID=
VK_CALLBACK_SECRET=
VK_CONFIRMATION_CODE=
VK_GROUP_TOKEN=
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# ИИ: none | yandex | gigachat
AI_PROVIDER=none
YANDEX_API_KEY=
YANDEX_FOLDER_ID=
GIGACHAT_AUTH_KEY=
GIGACHAT_SCOPE=GIGACHAT_API_PERS
NODE_EXTRA_CA_CERTS=
```

Сверить список с `envSchema` сайта и `schema` воркера: каждая переменная, которую они читают, есть в файле, и лишних нет. Пустые строки — проблема: zod-схемы с `.optional()` не принимают `""` как «нет значения». Поэтому в `server-setup.md` написать: **незаполненные переменные удалить из `.env` или закомментировать**, а не оставлять пустыми. Отдельно проверить: `readEnv({... YOOKASSA_SHOP_ID: "" })` должен падать с понятной ошибкой, а не молча выключать оплату. Если сейчас это не так, в задаче ничего не менять — достаточно правила в инструкции.

- [ ] **Шаг 5. `server-setup.md`.** Разделы по образцу wishlist:
  1. Что общее с трекером и что трогаем; правила Caddy — дословно из wishlist.
  2. Память: проверить `free -h` (после увеличения до 4 ГБ) и `docker stats --no-stream`; swap из wishlist уже есть.
  3. База: `mkdir -p /opt/grani/{certs,backups} && chmod 700 /opt/grani`, `scp deploy/create-db.sql deploy/docker-compose.yml`, пароль в `.db_password`, `docker exec -i food-tracker-bot-db-1 psql -U food_tracker -d postgres -v ON_ERROR_STOP=1 -v pw="$(cat .db_password)" -At < create-db.sql` → последняя строка `grani`.
  4. `.env`: создать из шаблона с генерацией `SESSION_SECRET` и `DATABASE_URL` через heredoc (как в wishlist), `chmod 600`. Секреты владелица вписывает сама через `nano /opt/grani/.env`. Правило про пустые переменные.
  5. Доступ к образам: пакеты GHCR у публичного репозитория по умолчанию приватные. Либо сделать пакеты `grani-*` публичными (GitHub → Packages → Package settings → Change visibility), либо `docker login ghcr.io` с PAT `read:packages`, как у wishlist. На сервере уже есть логин wishlist под тем же владельцем — проверить `docker pull ghcr.io/olya88lagun-coder/grani-web:latest`.
  6. Первый запуск: `docker compose --profile tools pull && docker compose run --rm migrate && docker compose up -d web worker && docker compose ps`.
  7. Caddy: дописать блок из `Caddyfile.grani`, `validate` → `reload`, `curl -fsS https://grani-test.ru/api/health`, проверить, что `trackermeal.ru` и `my-wish-list.online` отвечают 200.
  8. GigaChat (если выбран): скачать корневой сертификат Минцифры с `https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt` в `/opt/grani/certs/russian_trusted_root_ca.pem`, вписать `NODE_EXTRA_CA_CERTS=/certs/russian_trusted_root_ca.pem`, `docker compose up -d worker`. Проверку TLS не отключать никогда.
  9. VK Callback API (план 4, overview, п. 3): адрес `https://grani-test.ru/api/vk/callback`, строка подтверждения → `VK_CONFIRMATION_CODE`, секрет → `VK_CALLBACK_SECRET`, `docker compose up -d web`, затем «Подтвердить» в настройках сообщества.
  10. ЮKassa: уведомления на `https://grani-test.ru/api/yookassa/notification`, события `payment.succeeded` и `payment.canceled`. Сначала ключи тестового магазина, после проверки — боевого.
  11. Обновление: делает `deploy.yml`. Вручную: `cd /opt/grani && docker compose --profile tools pull && docker compose run --rm migrate && docker compose up -d web worker`.
  12. Логи: `docker logs --since 30m grani-web-1`, `grani-worker-1`; строка `worker started` показывает, какие каналы уведомлений и какой ИИ включены.
  13. Откат: `docker tag ghcr.io/…/grani-web:sha-<предыдущий> …:latest && docker compose up -d web` (то же для `worker`). Миграции не откатываются, поэтому перед каждой миграцией `deploy.yml` делает копию базы в `/opt/grani/backups`. Восстановление: `gunzip -c <файл> | docker exec -i food-tracker-bot-db-1 psql -U food_tracker -d grani`, в пустую базу, при остановленных `web` и `worker`.
  14. Только один процесс опрашивает очередь уведомлений с боевыми токенами: локальный воркер запускать с `NOTIFICATIONS_DRY_RUN=1`.

- [ ] **Шаг 6. `deploy.yml`.** Основа — `C:\dev\wishlist\.github\workflows\deploy.yml` (проверка секретов, SSH, удалённый скрипт через heredoc). Изменения:
  - каталог `/opt/grani`, имена `grani-web`, `grani-worker`, `grani-migrate`, контейнер `grani-web-1`;
  - ожидание образов: для всех трёх образов `docker pull <repo>:sha-XXXXXXX`, до 60 попыток с паузой 10 с (сборка трёх образов дольше, чем одного у wishlist). После — `docker tag … :latest`;
  - копия базы до миграций:

    ```bash
    mkdir -p /opt/grani/backups
    docker exec food-tracker-bot-db-1 pg_dump -U food_tracker -d grani --no-owner | gzip > "/opt/grani/backups/pre-$EXPECTED_TAG.sql.gz"
    ls -1t /opt/grani/backups/pre-*.sql.gz | tail -n +6 | xargs -r rm -f
    ```

  - `docker compose run --rm migrate`, затем `docker compose up -d --force-recreate web worker`;
  - ожидание `healthy` у `grani-web-1`, как в wishlist;
  - проверки снаружи через `curl -fsS` и `assert_contains` (функция из wishlist):
    - `/` — `<title>Грани — тест личности: 16 типов и как тебя видят другие</title>`, `rel="canonical" href="https://grani-test.ru"`, `name="yandex-verification"`;
    - `/types/iskra` — `rel="canonical" href="https://grani-test.ru/types/iskra"`, `"@type":"BreadcrumbList"`;
    - `/compatibility`, `/contacts` (ИНН), `/offer`, `/privacy` — заголовки;
    - `/sitemap.xml` — `https://grani-test.ru/types/nablyudatel` и `https://grani-test.ru/articles`;
    - `/robots.txt` — `Sitemap: https://grani-test.ru/sitemap.xml` и `Disallow: /result/`;
    - `/test` — `noindex`;
    - `curl -s -o /dev/null -w "%{http_code}" -X POST https://grani-test.ru/api/yookassa/notification -d '{}'` → `403` (запрос не с IP ЮKassa) или `404` (ЮKassa ещё не настроена); `200` — ошибка;
    - `curl -s -o /dev/null -w "%{http_code}" https://grani-test.ru/dev/pay/x` → `404`: поддельной оплаты в production нет;
    - `curl -s -o /dev/null -w "%{http_code}" https://grani-test.ru/api/dev/login` → `404`;
    - `docker logs --since 2m grani-worker-1 | grep '"worker started"'`;
  - уборка старых образов: блок из wishlist (текущий тег и один предыдущий), для каждого из трёх репозиториев;
  - `concurrency: group: grani-deploy`.

  Точные строки `title` сверить с тем, что отдают страницы после задач 1–5: снять `curl` с локальной production-сборки (задача 6, шаг 4) и скопировать.

- [ ] **Шаг 7. Настройка сервера — с пользователем.** Показать пользователю разделы 2–7 `server-setup.md` и спросить, как их выполнить:
  - (а) пользователь сам выполняет команды и присылает вывод без секретов;
  - (б) агент выполняет по SSH команды без секретов — каждую группу команд после отдельного «да». `.env` с секретами пользователь в любом случае заполняет сам.

  Перед этим пользователь выполняет предварительные действия 4, 5, 10 из обзора. Пока образов нет (они появятся после мержа, задача 8), можно сделать разделы 2–5 и Caddy. Caddy до запуска `web` будет отвечать 502 на `grani-test.ru` — это не мешает трекеру и wishlist.

- [ ] **Шаг 8. Проверка `X-Forwarded-For`** — когда в `.env` появятся ключи ЮKassa (до этого маршрут отвечает 404 на всё), вместе с пользователем:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://grani-test.ru/api/yookassa/notification -H "X-Forwarded-For: 185.71.76.1" -d '{}'
```

Ожидается `403`: подделанный заголовок не должен сделать запрос «пришедшим от ЮKassa». Если пришло не 403, остановить выкладку и разобраться с `trusted_proxies` в Caddy до включения оплаты.

- [ ] **Шаг 9. Коммит.**

```bash
git add deploy .github/workflows/deploy.yml
git commit -m "ci(deploy): compose, Caddy block, database and server guide, deploy workflow with smoke tests"
```
