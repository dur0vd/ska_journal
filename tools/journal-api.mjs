// Сервер журнала баллов: участник по своему коду добавляет себе баллы.
// Обработчик на стандартных Request/Response: работает в Cloudflare Workers (worker/) и в локальном npm run serve.
import { EMPTY_JOURNAL, InputError, addEntries, checkCode, parsePoints, publicView } from '../assets/journal-core.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

// store: { read() -> {data, version}, write(data, version, message) }; write бросает ошибку с conflict: true,
// если файл изменился после чтения.
export async function handleJournal(request, { store, origins = [] }) {
  const origin = request.headers.get('Origin');
  const cors = origin && origins.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : {};
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...cors } });

  if (origin && !cors['Access-Control-Allow-Origin']) return reply(403, { error: 'Запрос с чужого сайта.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  try {
    if (request.method === 'GET') return reply(200, publicView((await store.read()).data));
    if (request.method !== 'POST') return reply(405, { error: 'Метод не поддерживается.' });

    let body;
    try { body = await request.json(); } catch { return reply(400, { error: 'Неверный запрос.' }); }
    const points = parsePoints(body && body.points);
    for (let attempt = 0; ; attempt++) {
      const { data, version } = await store.read();
      const p = (data.participants || []).find((x) => x.id === body.id);
      // Одинаковый ответ на неизвестного участника и неверный код.
      if (!p || !(await checkCode(body.code, p.code))) return reply(403, { error: 'Код не подходит. Проверьте фамилию и код.' });
      const sum = addEntries(p, points, 'self');
      try {
        await store.write(data, version, p.name + ': +' + points.join(', ') + ' (сам)');
        return reply(200, { total: sum, ...publicView(data) });
      } catch (err) {
        if (!err.conflict || attempt >= 3) throw err;
      }
    }
  } catch (err) {
    if (err instanceof InputError) return reply(400, { error: err.message });
    console.error(err);
    return reply(500, { error: 'Не удалось сохранить. Попробуйте ещё раз через минуту.' });
  }
}

// Файл data/journal.json в репозитории сайта через GitHub API.
export function githubStore({ token, repo, branch = 'main', path = 'data/journal.json' }) {
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + path;
  const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ska-journal' };
  const decode = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  const encode = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  return {
    async read() {
      const r = await fetch(url + '?ref=' + encodeURIComponent(branch), { headers, cache: 'no-store' });
      if (r.status === 404) return { data: structuredClone(EMPTY_JOURNAL), version: null };
      if (!r.ok) throw new Error('GitHub: ' + r.status);
      const f = await r.json();
      return { data: JSON.parse(decode(f.content)), version: f.sha };
    },
    async write(data, version, message) {
      const body = { message: 'Журнал баллов: ' + message, content: encode(JSON.stringify(data, null, 2) + '\n'), branch };
      if (version) body.sha = version;
      const r = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 409 || r.status === 422) throw Object.assign(new Error('Конфликт версий'), { conflict: true });
      if (!r.ok) throw new Error('GitHub: ' + r.status);
    },
  };
}
