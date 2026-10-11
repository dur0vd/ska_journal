// Журнал баллов: общая логика для сборки сайта (Node) и для редактора (браузер).
// На сайт попадают только случайные коды и баллы. Фамилий в данных нет.

export const LIMITS = { title: 120, columns: 60, columnTitle: 60, group: 40, students: 400, maxPoints: 1000 };
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без I, O, 0, 1: их путают
const CODE_RE = /^[A-Z0-9]{4,8}$/;
const COLUMN_ID_RE = /^c[0-9a-z]{1,8}$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const round2 = (n) => Math.round(n * 100) / 100;
export const formatPoints = (n) => String(round2(n)).replace('.', ',');

// Число баллов из строки или числа. Пусто и мусор дают null, отрицательные не допускаются.
export function toPoints(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(Math.min(n, LIMITS.maxPoints));
}

function randomIndex(max) {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % max;
}

// Код из 5 знаков: его нельзя подобрать по алфавиту фамилий или порядку в списке.
export function randomCode(taken = new Set()) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomIndex(CODE_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
  throw new Error('Не удалось подобрать свободный код');
}

export function newColumnId(taken = new Set()) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let attempt = 0; attempt < 1000; attempt++) {
    let id = 'c';
    for (let i = 0; i < 4; i++) id += chars[randomIndex(chars.length)];
    if (!taken.has(id)) return id;
  }
  throw new Error('Не удалось подобрать идентификатор столбца');
}

// Приводит любые данные к безопасному виду: лишнее отбрасывается, числа ограничиваются.
export function normalizeJournal(raw) {
  const j = raw && typeof raw === 'object' ? raw : {};
  const columns = [];
  const ids = new Set();
  for (const c of (Array.isArray(j.columns) ? j.columns : []).slice(0, LIMITS.columns)) {
    const id = String((c && c.id) || '').toLowerCase();
    if (!COLUMN_ID_RE.test(id) || ids.has(id)) continue;
    ids.add(id);
    columns.push({
      id,
      title: text(c.title, LIMITS.columnTitle) || 'Без названия',
      group: text(c.group, LIMITS.group),
      max: toPoints(c.max) ?? 0
    });
  }
  const students = [];
  const codes = new Set();
  for (const s of (Array.isArray(j.students) ? j.students : []).slice(0, LIMITS.students)) {
    const code = String((s && s.code) || '').toUpperCase();
    if (!CODE_RE.test(code) || codes.has(code)) continue;
    codes.add(code);
    const scores = {};
    for (const col of columns) {
      const v = toPoints(s.scores && s.scores[col.id]);
      if (v !== null) scores[col.id] = v;
    }
    students.push({ code, scores });
  }
  return {
    title: text(j.title, LIMITS.title) || 'Журнал',
    threshold: toPoints(j.threshold) ?? 0,
    columns,
    students
  };
}

export function totalOf(student, columns) {
  let sum = 0;
  for (const c of columns) sum += Number(student.scores && student.scores[c.id]) || 0;
  return round2(sum);
}
export const maxTotal = (columns) => round2(columns.reduce((a, c) => a + (c.max || 0), 0));
// 'pass' | 'fail' | 'none' (порог не задан)
export const statusOf = (total, threshold) => (threshold > 0 ? (total >= threshold ? 'pass' : 'fail') : 'none');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Разметка одного журнала для публичной страницы. Все значения экранируются.
export function renderJournal(slug, journalRaw) {
  const j = normalizeJournal(journalRaw);
  const students = [...j.students].sort((a, b) => a.code.localeCompare(b.code));
  const max = maxTotal(j.columns);
  let html = `<section class="journal" id="j-${esc(slug)}" data-threshold="${j.threshold}" data-max="${max}">\n`;
  html += `<h2>${esc(j.title)}</h2>\n`;
  if (!students.length || !j.columns.length) {
    return html + '<p class="hint">Баллы пока не внесены.</p>\n</section>';
  }
  html += '<form class="j-find"><label>Ваш личный код <input class="j-code" type="text" maxlength="8" autocomplete="off" spellcheck="false" placeholder="например, K7P4Q"></label></form>\n';
  html += '<div class="j-result card" aria-live="polite" hidden></div>\n';
  if (j.threshold > 0) html += `<p class="hint">Для зачёта нужно набрать ${formatPoints(j.threshold)} из ${formatPoints(max)} баллов.</p>\n`;

  // строка групп: подряд идущие столбцы с одинаковой группой объединяются
  const spans = [];
  for (const c of j.columns) {
    const last = spans[spans.length - 1];
    if (last && last.group === c.group) last.n++;
    else spans.push({ group: c.group, n: 1 });
  }
  const hasGroups = spans.some((s) => s.group);
  const sumHead = (rowspan) => `<th${rowspan ? ' rowspan="2"' : ''} scope="col">Сумма</th>` + (j.threshold > 0 ? `<th${rowspan ? ' rowspan="2"' : ''} scope="col">Зачёт</th>` : '');
  html += '<div class="j-wrap"><table class="j-table">\n<thead>\n';
  if (hasGroups) {
    html += '<tr><th rowspan="2" class="j-code-h" scope="col">Код</th>' +
      spans.map((s) => `<th colspan="${s.n}" scope="colgroup" class="j-group">${esc(s.group)}</th>`).join('') +
      sumHead(true) + '</tr>\n<tr>';
  } else {
    html += '<tr><th class="j-code-h" scope="col">Код</th>';
  }
  html += j.columns.map((c) => `<th scope="col">${esc(c.title)}${c.max ? `<small>из ${formatPoints(c.max)}</small>` : ''}</th>`).join('');
  if (!hasGroups) html += sumHead(false);
  html += '</tr>\n</thead>\n<tbody>\n';
  for (const s of students) {
    const total = totalOf(s, j.columns);
    const st = statusOf(total, j.threshold);
    html += `<tr data-code="${esc(s.code)}" data-total="${total}"><th scope="row" class="j-code-h">${esc(s.code)}</th>`;
    html += j.columns.map((c) => {
      const v = s.scores[c.id];
      return `<td>${v === undefined ? '<span class="j-empty">–</span>' : formatPoints(v)}</td>`;
    }).join('');
    html += `<td class="j-total">${formatPoints(total)}</td>`;
    if (j.threshold > 0) html += `<td class="j-status j-${st}">${st === 'pass' ? 'зачёт' : '—'}</td>`;
    html += '</tr>\n';
  }
  return html + '</tbody>\n</table></div>\n</section>';
}
