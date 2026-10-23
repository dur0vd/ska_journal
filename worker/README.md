# Сервер журнала баллов

Сайт статический, поэтому участникам, которые вносят себе баллы по коду, нужен маленький сервер.
Он проверяет код и записывает баллы в `data/journal.json` репозитория сайта через GitHub API
(как это делает `admin.html`). Код участника на сервере не хранится: в журнале лежит только соль
и хэш PBKDF2. Преподаватель работает через `admin.html` и сервер не использует.

Пока сервер не подключён, журнал на сайте виден всем, баллы вносит только преподаватель,
а формы «Внести свои баллы» на странице нет.

## Запуск на Cloudflare Workers (бесплатно)

1. Fine-grained токен GitHub: только репозиторий сайта, право **Contents: Read and write**.
2. В этой папке:
   ```bash
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN   # вставить токен
   npx wrangler deploy
   ```
   Проверьте в `wrangler.toml` репозиторий (`GITHUB_REPO`) и адрес сайта (`ALLOWED_ORIGINS`, через запятую).
3. Wrangler напечатает адрес вида `https://ska-journal.<имя>.workers.dev`.
   Задайте его переменной репозитория сайта `JOURNAL_API` (Settings → Secrets and variables → Actions → Variables).
   Сборка (`.github/workflows/build.yml`) передаёт её в `npm run build`, и на странице журнала появится форма.

Обработчик (`tools/journal-api.mjs`) написан на стандартных `Request`/`Response`,
его можно перенести на другую площадку (Deno Deploy, Yandex Cloud Functions), если workers.dev недоступен.

## Локальная проверка

```bash
JOURNAL_API=/api/journal npm run build
npm run serve
```
Локальный сервер отвечает на `/api/journal` и пишет в `data/journal.json` рабочей копии.
Перед коммитом пересоберите без `JOURNAL_API` (или с боевым адресом).
