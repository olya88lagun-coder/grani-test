# Задача 6 — Docker-образы и их сборка в GitHub Actions

**Files:**
- Create: `Dockerfile` (в корне: образы собираются из всего монорепо)
- Create: `.dockerignore`
- Create: `.github/workflows/images.yml`
- Modify: `apps/web/next.config.ts` (если сборка standalone потребует `serverExternalPackages`)

**Interfaces:**
- Produces: образы `ghcr.io/olya88lagun-coder/grani-{web,worker,migrate}` с тегами `latest` и `sha-<7 символов>`. Контейнер `web` слушает `3000` и отвечает `GET /api/health` → `{ ok: true }`; `worker` запускает `node apps/worker/dist/main.mjs`; `migrate` — `node packages/db/scripts/migrate.mjs`.

## Зачем

Спецификация 5.4: отдельный Docker Compose для `web` и `worker` на VPS wishlist. Образец — `C:\dev\wishlist\apps\web\Dockerfile` и `.github/workflows/images.yml`. Отличия Граней:
- `@grani/content` содержит сгенерированный `library.json` в git, поэтому сборка библиотеки в образе не нужна;
- воркер собирается esbuild в один файл, но `grammy` внешний (см. `apps/worker/scripts/build.mjs`), поэтому в образ воркера копируется `node_modules`;
- `pg_dump` в образе воркера не нужен: бэкапов в этой версии нет.

## Шаги

- [ ] **Шаг 1. `.dockerignore`.**

```
node_modules
**/node_modules
.next
**/.next
.git
.env
**/.env*
!**/.env.example
.dev-db
coverage
docs
e2e
**/dist
**/test-results
**/playwright-report
```

`.env.development.local` не должен попасть в образ ни при каких условиях: там локальные ключи. Проверка на шаге 5.

- [ ] **Шаг 2. `Dockerfile`.**

```dockerfile
ARG NODE_VERSION=24-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
RUN corepack enable
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @grani/web build

FROM deps AS build-worker
RUN pnpm --filter @grani/worker build

# pnpm держит зависимости пакета симлинками в корневой node_modules/.pnpm, поэтому копируются оба каталога
FROM node:${NODE_VERSION} AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/db ./packages/db
USER node
CMD ["node", "packages/db/scripts/migrate.mjs"]

FROM node:${NODE_VERSION} AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build-worker /repo/node_modules ./node_modules
COPY --from=build-worker /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build-worker /repo/apps/worker/dist ./apps/worker/dist
USER node
CMD ["node", "apps/worker/dist/main.mjs"]

FROM node:${NODE_VERSION} AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
```

Папки `apps/web/public` в Гранях сейчас нет (шрифты в `apps/web/assets`, иконки генерируются). Если к моменту выполнения `public/` появится, добавить `COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public`. Шрифты карточек из `apps/web/assets/fonts` читаются в рантайме через `fs`. Проверить (шаг 5), что standalone-трассировка их скопировала. Если нет, добавить `COPY --from=build --chown=node:node /repo/apps/web/assets ./apps/web/assets` и проверить путь, по которому `card.tsx` их читает.

Сборке сайта не нужны переменные окружения: `layout.tsx` берёт `APP_URL ?? "https://grani-test.ru"`, а `getEnv()` вызывается только в рантайме. Если `next build` падает из-за `getEnv()` на статической странице, значит страница случайно стала читать окружение при сборке. Исправлять страницу, а не подставлять переменные в Dockerfile.

- [ ] **Шаг 3. `images.yml`.** Скопировать `C:\dev\wishlist\.github\workflows\images.yml`, заменить `file: apps/web/Dockerfile` на `file: Dockerfile` и имя образа `wishlist-` на `grani-`. Добавить `needs`-зависимость от проверок нельзя (это разные workflow). Вместо этого `images.yml` запускается на `push` в `master`, как в wishlist: в `master` попадает только то, что прошло CI в PR.

- [ ] **Шаг 4. Локальная сборка, если есть Docker.** `docker --version`. Если Docker есть:

```bash
docker build --target web -t grani-web:local .
docker build --target worker -t grani-worker:local .
docker build --target migrate -t grani-migrate:local .
```

Если Docker нет, проверить standalone-сборку без него:

```bash
pnpm --filter @grani/web build
ls apps/web/.next/standalone/apps/web/server.js
```

Запустить `node apps/web/.next/standalone/apps/web/server.js` с `PORT=3100` и переменными из `.env.development.local` (кроме `DEV_LOGIN` и `PAYMENTS_FAKE`: в production они запрещены), `NODE_ENV=production`. Затем `curl localhost:3100/api/health` и `curl -o /dev/null -w "%{http_code}" localhost:3100/cards/<dir>` для карточки «мой тип»: так проверяются шрифты. Остановить сервер.

- [ ] **Шаг 5. Проверка содержимого.** Если образ собран:
  - `docker run --rm grani-web:local sh -c 'ls -a /app /app/apps/web; find / -name ".env*" -not -path "/proc/*" 2>/dev/null'` — никаких `.env*`;
  - `docker run --rm grani-worker:local node -e "import('grammy').then(()=>console.log('ok'))"` → `ok`;
  - размеры `docker images | grep grani` — ориентир web < 300 МБ.

  Без Docker первую сборку делает `images.yml` после мержа (задача 8). Тогда в задаче 8 после первой публикации образов выполнить те же проверки на сервере.

- [ ] **Шаг 6. Коммит.**

```bash
git add Dockerfile .dockerignore .github/workflows/images.yml apps/web/next.config.ts
git commit -m "ci(images): web, worker and migrate images published to GHCR"
```
