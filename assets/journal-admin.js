// Вкладка «Журнал» в админке. Данные хранятся в data/journals/<имя>.json (только коды и баллы).
// Фамилии живут только в localStorage этого браузера и в репозиторий не попадают.
import { normalizeJournal, toPoints, totalOf, randomCode, newColumnId, formatPoints, LIMITS, SLUG_RE } from './journal-core.js';

const DIR = 'data/journals';
const NAMES_KEY = (slug) => 'ska_journal_names_' + slug;
const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };

export function slugFromTitle(title) {
  const s = String(title).toLowerCase().split('').map((c) => (TR[c] !== undefined ? TR[c] : c)).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return SLUG_RE.test(s) ? s : 'zhurnal';
}

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c) node.append(c);
  return node;
}

export function initJournalAdmin(api) {
  const root = document.getElementById('j-root');
  let slugs = [];
  let titles = {};          // slug -> название для списка
  let cur = null;           // { slug, sha, data, dirty }
  let names = {};           // код -> фамилия (только в этом браузере)
  let loaded = false;

  // ---------- локальные фамилии ----------
  function loadNames(slug) {
    try { names = JSON.parse(localStorage.getItem(NAMES_KEY(slug)) || '{}') || {}; } catch (e) { names = {}; }
  }
  function saveNames() {
    try { localStorage.setItem(NAMES_KEY(cur.slug), JSON.stringify(names)); } catch (e) { /* хранилище недоступно */ }
  }

  // ---------- загрузка и сохранение ----------
  function loadList() {
    return api.gh(DIR).then((list) => {
      slugs = (list || []).map((f) => f.name).filter((n) => /^[a-z0-9-]+\.json$/.test(n)).map((n) => n.replace(/\.json$/, '')).sort();
    }).then(() => Promise.all(slugs.map((s) => api.readJson(DIR + '/' + s + '.json', null)
      .then((r) => { titles[s] = (r.data && r.data.title) || s; }))));
  }

  function open() {
    if (loaded) return;
    loaded = true;
    root.textContent = 'Загружаю…';
    loadList().then(() => (slugs.length ? select(slugs[0]) : null)).then(render)
      .catch((err) => { loaded = false; root.textContent = ''; api.status('err', err.message); });
  }

  function select(slug) {
    return api.readJson(DIR + '/' + slug + '.json', null).then((r) => {
      if (!r.data) throw new Error('Журнал не найден.');
      cur = { slug, sha: r.sha, data: normalizeJournal(r.data), dirty: false };
      loadNames(slug);
    });
  }

  function save() {
    const data = normalizeJournal(cur.data);
    const path = DIR + '/' + cur.slug + '.json';
    api.status('busy', 'Сохраняю журнал…');
    return api.writeJson(path, data, cur.sha, 'Журнал: ' + data.title).then((res) => {
      if (res && res.content && res.content.sha) return res.content.sha;
      return api.readJson(path, null).then((r) => r.sha);
    }).then((sha) => {
      cur.sha = sha; cur.data = data; cur.dirty = false; titles[cur.slug] = data.title;
      api.status('ok', 'Журнал сохранён. На сайте баллы появятся через 1–5 минут.');
      updateSaveState();
    });
  }

  function create(title, threshold) {
    const base = slugFromTitle(title);
    let slug = base, n = 2;
    while (slugs.includes(slug)) slug = base + '-' + n++;
    const data = normalizeJournal({ title, threshold, columns: [], students: [] });
    api.status('busy', 'Создаю журнал…');
    return api.writeJson(DIR + '/' + slug + '.json', data, null, 'Новый журнал: ' + data.title)
      .then(loadList).then(() => select(slug)).then(() => {
        api.status('ok', 'Журнал создан. Добавьте столбцы и студентов.');
        render();
      });
  }

  function remove() {
    if (!confirm('Удалить журнал «' + cur.data.title + '» со всеми баллами? Это нельзя отменить.')) return;
    api.status('busy', 'Удаляю…');
    api.delFile(DIR + '/' + cur.slug + '.json', cur.sha, 'Удалён журнал ' + cur.slug)
      .then(() => { try { localStorage.removeItem(NAMES_KEY(cur.slug)); } catch (e) { /* ничего */ } cur = null; return loadList(); })
      .then(() => (slugs.length ? select(slugs[0]) : null))
      .then(() => { api.status('ok', 'Журнал удалён.'); render(); })
      .catch((err) => api.status('err', err.message));
  }

  function guardDirty() {
    return !cur || !cur.dirty || confirm('Есть несохранённые изменения. Перейти без сохранения?');
  }
  window.addEventListener('beforeunload', (e) => { if (cur && cur.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- отрисовка ----------
  let saveBtn, saveHint;
  function updateSaveState() {
    if (!saveBtn) return;
    saveBtn.disabled = !cur || !cur.dirty;
    saveHint.textContent = cur && cur.dirty ? 'Есть несохранённые изменения.' : 'Все изменения сохранены.';
  }
  function touch() { cur.dirty = true; updateSaveState(); }

  function render() {
    root.replaceChildren();
    root.append(topCard());
    if (cur) root.append(settingsCard(), studentsCard(), gridCard(), saveBar());
    updateSaveState();
  }

  function topCard() {
    const select_ = el('select', { id: 'j-select', 'aria-label': 'Журнал' },
      slugs.map((s) => el('option', { value: s, text: titles[s] || s, selected: cur && cur.slug === s })));
    select_.addEventListener('change', () => {
      if (!guardDirty()) { select_.value = cur.slug; return; }
      select(select_.value).then(render).catch((err) => api.status('err', err.message));
    });
    const newForm = el('form', { class: 'j-new', hidden: true },
      el('label', { for: 'j-new-title', text: 'Название журнала' }),
      el('input', { id: 'j-new-title', type: 'text', maxlength: LIMITS.title, required: true, placeholder: 'Например: ФГУ, группа 107, осень 2026' }),
      el('label', { for: 'j-new-th', text: 'Порог зачёта, баллов (0, если не нужен)' }),
      el('input', { id: 'j-new-th', type: 'number', min: 0, max: LIMITS.maxPoints, step: 0.5, value: 55 }),
      el('button', { class: 'btn', type: 'submit', text: 'Создать журнал' }));
    newForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!guardDirty()) return;
      api.busy(newForm, true);
      create(newForm.querySelector('#j-new-title').value, newForm.querySelector('#j-new-th').value)
        .catch((err) => api.status('err', err.message)).then(() => api.busy(newForm, false));
    });
    const toggle = el('button', { class: 'del', type: 'button', text: 'Новый журнал', onclick: () => { newForm.hidden = !newForm.hidden; } });
    return el('div', { class: 'card' },
      el('h2', { text: 'Журнал баллов' }),
      el('p', { class: 'hint', text: 'Студенты видят на сайте только случайные коды и баллы. Фамилии хранятся в этом браузере и на сайт не попадают. Не вписывайте фамилии в названия журналов и столбцов.' }),
      slugs.length ? el('div', { class: 'row' }, el('div', {}, el('label', { for: 'j-select', text: 'Журнал' }), select_), el('div', { class: 'j-actions' }, toggle))
        : el('div', {}, el('p', { text: 'Журналов пока нет. Создайте первый.' }), toggle),
      newForm);
  }

  function settingsCard() {
    const title = el('input', { id: 'j-title', type: 'text', maxlength: LIMITS.title, value: cur.data.title });
    title.addEventListener('input', () => { cur.data.title = title.value; touch(); });
    const th = el('input', { id: 'j-th', type: 'number', min: 0, max: LIMITS.maxPoints, step: 0.5, value: cur.data.threshold });
    th.addEventListener('input', () => { cur.data.threshold = toPoints(th.value) ?? 0; touch(); });
    return el('div', { class: 'card' },
      el('h2', { text: 'Настройки' }),
      el('div', { class: 'row' },
        el('div', {}, el('label', { for: 'j-title', text: 'Название' }), title),
        el('div', {}, el('label', { for: 'j-th', text: 'Порог зачёта, баллов (0 — без порога)' }), th)),
      el('div', { class: 'j-actions' }, el('button', { class: 'del', type: 'button', text: 'Удалить журнал', onclick: remove })));
  }

  function studentsCard() {
    const count = el('input', { id: 'j-count', type: 'number', min: 1, max: 100, value: 5, 'aria-label': 'Сколько студентов добавить' });
    const addN = el('button', { class: 'del', type: 'button', text: 'Добавить', onclick: () => {
      const n = Math.max(1, Math.min(100, parseInt(count.value, 10) || 0));
      if (cur.data.students.length + n > LIMITS.students) { api.status('err', 'В журнале не больше ' + LIMITS.students + ' студентов.'); return; }
      const taken = new Set(cur.data.students.map((s) => s.code));
      for (let i = 0; i < n; i++) { const code = randomCode(taken); taken.add(code); cur.data.students.push({ code, scores: {} }); }
      touch(); renderGrid();
    } });
    const list = el('textarea', { id: 'j-list', rows: 5, placeholder: 'Иванов Иван\nПетрова Мария\n…' });
    const addList = el('button', { class: 'del', type: 'button', text: 'Добавить списком', onclick: () => {
      const lines = list.value.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (!lines.length) return;
      if (cur.data.students.length + lines.length > LIMITS.students) { api.status('err', 'В журнале не больше ' + LIMITS.students + ' студентов.'); return; }
      const taken = new Set(cur.data.students.map((s) => s.code));
      for (const line of lines) {
        const code = randomCode(taken); taken.add(code);
        cur.data.students.push({ code, scores: {} });
        names[code] = line.slice(0, 80);
      }
      saveNames(); list.value = ''; touch(); renderGrid();
      api.status('ok', 'Добавлено студентов: ' + lines.length + '. Скачайте список кодов и раздайте студентам.');
    } });
    const csv = el('button', { class: 'del', type: 'button', text: 'Скачать список кодов (CSV)', onclick: downloadCodes });
    return el('div', { class: 'card' },
      el('h2', { text: 'Студенты' }),
      el('div', { class: 'row' },
        el('div', {}, el('label', { for: 'j-count', text: 'Добавить пустые строки' }), count, el('div', { class: 'j-actions' }, addN)),
        el('div', {}, el('label', { for: 'j-list', text: 'Или список фамилий (по одной в строке)' }), list, el('div', { class: 'j-actions' }, addList))),
      el('p', { class: 'hint', text: 'Каждому студенту выдаётся случайный код. Список «фамилия — код» нужен вам, чтобы раздать коды: сохраните его у себя, на сайте его нет.' }),
      el('div', { class: 'j-actions' }, csv));
  }

  function downloadCodes() {
    const rows = [...cur.data.students].sort(byName).map((s) => `"${(names[s.code] || '').replace(/"/g, '""')}";${s.code}`);
    const blob = new Blob(['﻿Фамилия;Код\r\n' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'kody-' + cur.slug + '.csv' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const byName = (a, b) => {
    const na = names[a.code], nb = names[b.code];
    if (na && nb) return na.localeCompare(nb, 'ru');
    if (na) return -1;
    if (nb) return 1;
    return a.code.localeCompare(b.code);
  };

  // ---------- таблица баллов ----------
  let gridHost;
  function gridCard() {
    gridHost = el('div', { class: 'j-grid-wrap' });
    const card = el('div', { class: 'card' },
      el('h2', { text: 'Баллы' }),
      el('div', { class: 'j-actions' }, el('button', { class: 'del', type: 'button', text: '+ Столбец', onclick: () => {
        if (cur.data.columns.length >= LIMITS.columns) { api.status('err', 'Не больше ' + LIMITS.columns + ' столбцов.'); return; }
        cur.data.columns.push({ id: newColumnId(new Set(cur.data.columns.map((c) => c.id))), title: 'Новое задание', group: '', max: 10 });
        touch(); renderGrid();
      } })),
      gridHost);
    renderGrid();
    return card;
  }

  function renderGrid() {
    if (!gridHost) return;
    const cols = cur.data.columns;
    if (!cols.length && !cur.data.students.length) {
      gridHost.replaceChildren(el('p', { class: 'hint', text: 'Добавьте столбцы (задания, семинары, посещаемость) и студентов.' }));
      return;
    }
    const sums = new Map();

    const head = el('tr', {}, el('th', { text: 'Фамилия (видно только вам)' }), el('th', { text: 'Код' }),
      cols.map((c, i) => {
        const title = el('input', { type: 'text', maxlength: LIMITS.columnTitle, value: c.title, 'aria-label': 'Название столбца ' + (i + 1) });
        title.addEventListener('input', () => { c.title = title.value; touch(); });
        const group = el('input', { type: 'text', maxlength: LIMITS.group, value: c.group, placeholder: 'Группа', 'aria-label': 'Группа столбца ' + (i + 1) });
        group.addEventListener('input', () => { c.group = group.value; touch(); });
        const max = el('input', { type: 'number', min: 0, max: LIMITS.maxPoints, step: 0.5, value: c.max, 'aria-label': 'Максимум баллов, столбец ' + (i + 1) });
        max.addEventListener('input', () => { c.max = toPoints(max.value) ?? 0; touch(); markOver(); });
        const del = el('button', { class: 'del small', type: 'button', text: 'Удалить столбец', onclick: () => {
          if (!confirm('Удалить столбец «' + c.title + '» вместе с баллами?')) return;
          cur.data.columns = cols.filter((x) => x !== c);
          for (const s of cur.data.students) delete s.scores[c.id];
          touch(); renderGrid();
        } });
        return el('th', { class: 'j-col' }, title, group, el('label', { class: 'j-max' }, 'из ', max), del);
      }),
      el('th', { text: 'Сумма' }), el('th', { text: '' }));

    const body = [...cur.data.students].sort(byName).map((s) => {
      const nameInput = el('input', { type: 'text', maxlength: 80, value: names[s.code] || '', placeholder: 'фамилия', 'aria-label': 'Фамилия, код ' + s.code });
      nameInput.addEventListener('input', () => { if (nameInput.value.trim()) names[s.code] = nameInput.value.trim(); else delete names[s.code]; saveNames(); });
      const sumCell = el('td', { class: 'j-sum', text: formatPoints(totalOf(s, cols)) });
      sums.set(s, sumCell);
      return el('tr', {}, el('td', {}, nameInput), el('td', { class: 'j-code-cell', text: s.code }),
        cols.map((c) => {
          const v = s.scores[c.id];
          const inp = el('input', { type: 'number', min: 0, max: LIMITS.maxPoints, step: 0.5, value: v === undefined ? '' : v, 'data-col': c.id, 'aria-label': c.title + ', код ' + s.code });
          inp.addEventListener('input', () => {
            const n = toPoints(inp.value);
            if (n === null) delete s.scores[c.id]; else s.scores[c.id] = n;
            sumCell.textContent = formatPoints(totalOf(s, cols));
            touch(); markOver();
          });
          return el('td', {}, inp);
        }),
        sumCell,
        el('td', {}, el('button', { class: 'del small', type: 'button', text: 'Удалить', onclick: () => {
          if (!confirm('Удалить студента ' + (names[s.code] || s.code) + ' вместе с баллами?')) return;
          cur.data.students = cur.data.students.filter((x) => x !== s);
          delete names[s.code]; saveNames(); touch(); renderGrid();
        } })));
    });

    const table = el('table', { class: 'j-edit' }, el('thead', {}, head), el('tbody', {}, body));
    gridHost.replaceChildren(el('div', { class: 'j-scroll' }, table));
    markOver();

    // подсвечиваем оценки выше максимума столбца
    function markOver() {
      for (const inp of gridHost.querySelectorAll('input[data-col]')) {
        const col = cols.find((c) => c.id === inp.dataset.col);
        const n = toPoints(inp.value);
        inp.classList.toggle('over', !!col && col.max > 0 && n !== null && n > col.max);
      }
    }
  }

  function saveBar() {
    saveBtn = el('button', { class: 'btn', type: 'button', text: 'Сохранить журнал', onclick: () => {
      saveBtn.disabled = true;
      save().catch((err) => { api.status('err', err.message + ' Ваши правки остались на экране.'); updateSaveState(); });
    } });
    saveHint = el('span', { class: 'hint', 'aria-live': 'polite' });
    return el('div', { class: 'editor-actions' }, saveBtn, saveHint);
  }

  function reset() { loaded = false; cur = null; slugs = []; names = {}; root.replaceChildren(); }

  return { open, reset };
}
