// Журнал баллов: общие правила для сайта, управления, сервера баллов и сборки.
export const MAX_POINTS = 138;
// Оценка по сумме баллов. Ниже 50 — незачёт.
export const GRADES = [
  { min: 90, mark: 5, badge: '5', label: 'отлично' },
  { min: 75, mark: 4, badge: '4', label: 'хорошо' },
  { min: 50, mark: 3, badge: '3', label: 'удовлетворительно' },
  { min: -Infinity, mark: 2, badge: 'незачёт', label: 'незачёт' },
];
export const MAX_ENTRIES_AT_ONCE = 20;
export const EMPTY_JOURNAL = { participants: [] };
// Ошибка ввода: текст показывается пользователю.
export class InputError extends Error {}

export function grade(total) {
  return GRADES.find((g) => total >= g.min);
}

const round = (n) => Math.round(n * 100) / 100;
export function total(p) {
  return round((p.entries || []).reduce((s, e) => s + e.points, 0));
}
export function formatPoints(n) {
  return String(round(n)).replace('.', ',');
}

// «5», «5 3 2», «5+3», «2,5; 4» → [5, 3, 2]. Каждое число становится отдельной записью.
export function parsePoints(text) {
  const parts = String(text || '').replace(/\s*([+-])\s*(?=\d)/g, ' $1').trim().split(/[\s;]+/).filter((s) => s && s !== '+');
  if (!parts.length) throw new InputError('Впишите число баллов.');
  if (parts.length > MAX_ENTRIES_AT_ONCE) throw new InputError('Не больше ' + MAX_ENTRIES_AT_ONCE + ' чисел за один раз.');
  return parts.map((s) => {
    if (!/^[+-]?\d{1,3}([.,]\d{1,2})?$/.test(s)) throw new InputError('Не понял число «' + s + '». Пример: 5 или 2,5.');
    const n = Number(s.replace(',', '.'));
    if (!n) throw new InputError('Ноль баллов вносить не нужно.');
    if (Math.abs(n) > MAX_POINTS) throw new InputError('Больше ' + MAX_POINTS + ' баллов внести нельзя.');
    return n;
  });
}

// Проверяет записи и добавляет их участнику. by: 'admin' или 'self'.
export function addEntries(p, points, by, now = new Date()) {
  if (by === 'self' && points.some((n) => n < 0)) throw new InputError('Снять баллы может только преподаватель.');
  const sum = round(total(p) + points.reduce((s, n) => s + n, 0));
  if (sum > MAX_POINTS) throw new InputError(p.name + ': сумма будет ' + formatPoints(sum) + ', а максимум — ' + MAX_POINTS + '.');
  if (sum < 0) throw new InputError(p.name + ': сумма не может быть меньше нуля.');
  p.entries = p.entries || [];
  points.forEach((n, i) => p.entries.push({ id: 'e' + now.getTime().toString(36) + i + randomId(4), points: n, at: now.toISOString(), by }));
  return sum;
}

// Публичные данные: без кодов и истории записей.
export function publicView(journal) {
  return {
    participants: (journal.participants || [])
      .map((p) => ({ id: p.id, name: p.name, total: total(p) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
  };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function rowsHtml(view) {
  if (!view.participants.length) return '<tr><td colspan="4" class="empty">Участники ещё не добавлены.</td></tr>';
  return view.participants.map((p, i) => {
    const g = grade(p.total);
    return `<tr class="g${g.mark}" data-id="${esc(p.id)}"><td class="num">${i + 1}</td><th scope="row">${esc(p.name)}</th>` +
      `<td class="pts"><strong>${formatPoints(p.total)}</strong><small> / ${MAX_POINTS}</small><progress max="${MAX_POINTS}" value="${p.total}"></progress></td>` +
      `<td class="mark"><span class="badge">${g.badge}</span></td></tr>`;
  }).join('');
}

// ---------- коды участников ----------
// 32 символа без похожих I/O/0/1: 10 символов ≈ 50 бит, перебором не подобрать.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ITERATIONS = 10000;
function randomId(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join('').toLowerCase();
}
export function newId() { return 'p' + randomId(10); }
export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const s = Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
  return s.slice(0, 5) + '-' + s.slice(5);
}
// Похожие русские буквы, если код набран в русской раскладке.
const CYR = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X' };
export function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[АВЕКМНРСТУХ]/g, (c) => CYR[c]).replace(/[^A-Z0-9]/g, '');
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function derive(code, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalizeCode(code)), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
}
// В файле журнала хранится только соль и хэш: сам код знает участник и тот, кто его выдал.
export async function hashCode(code) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await derive(code, salt)) };
}
export async function checkCode(code, stored) {
  if (!stored || !stored.salt || !stored.hash || normalizeCode(code).length !== 10) return false;
  const a = new Uint8Array(await derive(code, unb64(stored.salt))), b = unb64(stored.hash);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ (b[i] || 0);
  return diff === 0;
}
