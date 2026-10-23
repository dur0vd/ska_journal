import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import * as cheerio from 'cheerio';
import { sanitizePage } from './page-content.mjs';
import { GRADES, MAX_POINTS, EMPTY_JOURNAL, publicView, rowsHtml } from '../assets/journal-core.js';

const OUT = ROOT;
// Версия браузерной очистки из lockfile, без стороннего CDN.
fs.mkdirSync(path.join(ROOT, 'assets/vendor'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'node_modules/dompurify/dist/purify.es.mjs'), path.join(ROOT, 'assets/vendor/purify.es.mjs'));
// Дизайн сайта: scene — фотографии Москвы с «пролётом» (assets/scene, img/scene), classic — прежний светлый.
// Вернуть старый дизайн: SITE_DESIGN=classic npm run build (в GitHub — переменная репозитория SITE_DESIGN).
const DESIGN = process.env.SITE_DESIGN || 'scene';
if (!['scene', 'classic'].includes(DESIGN)) throw new Error('SITE_DESIGN: scene или classic');
if (DESIGN === 'scene') {
  fs.mkdirSync(path.join(ROOT, 'assets/fonts'), { recursive: true });
  for (const sub of ['cyrillic', 'latin']) for (const w of [700, 900]) {
    const f = `playfair-display-${sub}-${w}-normal.woff2`;
    fs.copyFileSync(path.join(ROOT, 'node_modules/@fontsource/playfair-display/files', f), path.join(ROOT, 'assets/fonts', f));
  }
}
// Снимки раздела (img/scene/*.jpg): здание, к которому «подлетает» камера, и помещение, куда она входит.
const SECTION_SCENE = {
  'Курс «История»': ['basil', 'inbasil'],
  'Спецкурс': ['museum', 'inmuseum'],
  'ФГУ': ['spasskaya', 'inpalata'],
  'Мехмат': ['msu', 'inmsu'],
  'Курсовые работы': ['ivan', 'inlibrary'],
};
const HOME_SCENES = ['square', 'spasskaya', 'ivan', 'basil', 'msu', 'museum', 'gum', 'kremlin'];
const sceneLayers = (keys) => '<div class="scenes" aria-hidden="true">' + keys.filter((k) => exists(`img/scene/${k}.jpg`))
  .map((k, i) => `<div class="scene"><img src="img/scene/${k}.jpg" alt=""${i ? ' loading="lazy"' : ''} decoding="async"></div>`).join('') + '</div>';
const pages = JSON.parse(fs.readFileSync(ROOT + '/data/pages.json', 'utf8'));
const assets = JSON.parse(fs.readFileSync(ROOT + '/data/assetmap.json', 'utf8'));
const WIX = 'https://solovyevka.wixsite.com/ska-ruhistory';

const SITE = 'Отечественная история';
const AUTHOR = 'К. А. Соловьёв';
const AUTHOR_GEN = 'К. А. Соловьёва';
// Адрес сервера журнала баллов (worker/README.md). Пусто — участники не могут вносить баллы сами.
const JOURNAL_API = process.env.JOURNAL_API || '';
if (JOURNAL_API && !/^(https:\/\/[a-z0-9.-]+(:\d+)?(\/[a-zA-Z0-9_./-]*)?|\/[a-zA-Z0-9_./-]*)$/.test(JOURNAL_API)) throw new Error('JOURNAL_API: нужен адрес https://… или /путь');

// ---- structure -------------------------------------------------------------
// [wixPath, slug, title]
const NAV = [
  { title: 'Курс «История»', items: [
    ['/programma', 'programma', 'Программа курса'],
    ['/metodicheskie-iaterialy', 'metodicheskie-materialy', 'Методические материалы'],
    ['/lekcii', 'lekcii', 'Лекции'],
    ['/sajty-po-istorii-rossii', 'sajty', 'Сайты по истории России'],
    ['/obyavleniya', 'obyavleniya', 'Объявления'],
  ]},
  { title: 'Спецкурс', items: [
    ['/спецкурс', 'speckurs', 'О спецкурсе'],
    ['/занятия', 'speckurs-zanyatiya', 'Занятия'],
    ['/презентации-лекций', 'speckurs-lekcii', 'Презентации лекций'],
    ['/семинары', 'speckurs-seminary', 'Семинары'],
    ['/проблематика-выступлений-на-конференции', 'speckurs-konferenciya', 'Проблематика выступлений на конференции'],
    ['/дебаты-методика', 'speckurs-debaty', 'Дебаты: методика'],
  ]},
  { title: 'ФГУ', items: [
    ['/rejtingovaya-sistema', 'fgu-rejtingovaya-sistema', 'Рейтинговая система'],
    ['/spiski-grupp', 'fgu-gruppa-107', 'Группа 107'],
    ['/zadaniya', 'fgu-zadaniya', 'Задания'],
    ['/seminary-pervogo-semestra', 'fgu-seminary-1', 'Семинары первого семестра'],
    ['/seminary-vtorogo', 'fgu-seminary-2', 'Семинары второго семестра'],
    ['/raboty-studentov', 'fgu-raboty-studentov', 'Работы студентов'],
    ['/rezultaty', 'fgu-rezultaty', 'Результаты'],
    ['/itogi-semestra', 'fgu-itogi-semestra', 'Итоги семестра'],
    ['/voprosy-k-ekzamenu', 'fgu-voprosy-k-ekzamenu', 'Вопросы к экзамену и зачёту'],
  ]},
  { title: 'Мехмат', items: [
    ['/zanyatiya-pervogo-semestra', 'mehmat-temy-seminarov', 'Тематика семинаров'],
    ['/gruppy-2015-i-207', 'mehmat-literatura', 'Литература к семинарам'],
    ['/задания', 'mehmat-zadaniya', 'Задания'],
    ['/zanyatiya-vtorogo-semestra', 'mehmat-zanyatiya-v-gruppah', 'Занятия в группах'],
    ['/esse-metodika', 'mehmat-esse-metodika', 'Эссе: методика'],
    ['/эссе-итоги', 'mehmat-esse-itogi', 'Эссе: итоги'],
    ['/rejting', 'mehmat-rejting', 'Рейтинг'],
    ['/rezultay-rabot', 'mehmat-rezultaty-dz', 'Результаты домашних заданий'],
    ['/итоги-мини-эссе', 'mehmat-itogi-mini-esse', 'Итоги мини-эссе'],
    ['/rezulaty-semestra', 'mehmat-rezultaty-semestra', 'Результаты семестра'],
    ['/voprosy-k-zachetu', 'mehmat-voprosy-k-ekzamenu', 'Вопросы к экзамену'],
  ]},
  { title: 'Курсовые работы', items: [
    ['/seminary', 'kursovye-temy', 'Тематика курсовых работ'],
    ['/metodika-podgotovki-kursovyh-rabot', 'kursovye-metodika', 'Методика подготовки'],
    ['/raspredelenie-tem-kursovyh-rabot', 'kursovye-raspredelenie', 'Распределение тем'],
    ['/indeks', 'kursovye-indeks', 'Индекс'],
  ]},
];
const CONTACT = ['/contact-me', 'kontakty', 'Контакты'];

const pathToSlug = { '/': 'index', [CONTACT[0]]: CONTACT[1] };
for (const s of NAV) for (const [p, slug] of s.items) pathToSlug[p] = slug;

// ---- helpers -----------------------------------------------------------------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const exists = (rel) => fs.existsSync(`${OUT}/${rel}`);
const sizeOf = (rel) => {
  const b = fs.statSync(`${OUT}/${rel}`).size;
  return b > 1e6 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
};
const plain = (h) => cheerio.load(`<div>${h}</div>`)('div').text().replace(/[\u200b\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();

function localHref(h) {
  if (!h) return h;
  if (h.startsWith(WIX)) {
    let p = decodeURIComponent(h.slice(WIX.length).replace(/[?#].*$/, '')) || '/';
    if (pathToSlug[p]) return pathToSlug[p] === 'index' ? 'index.html' : pathToSlug[p] + '.html';
    return null;
  }
  return h;
}

function cleanRich(html) {
  const $ = cheerio.load(`<div id="r">${html}</div>`, null, false);
  const root = $('#r');
  root.find('span').each((_, e) => { $(e).replaceWith($(e).contents()); });
  root.find('a').each((_, e) => {
    const href = localHref($(e).attr('href'));
    if (!href) { $(e).replaceWith($(e).contents()); return; }
    $(e).attr('href', href);
    if (/^https?:/.test(href)) $(e).attr({ target: '_blank', rel: 'noopener' });
  });
  root.find('h1').each((_, e) => { e.tagName = 'h2'; });
  root.find('h4,h5,h6').each((_, e) => { e.tagName = 'h3'; });
  // drop empty blocks
  for (let i = 0; i < 3; i++) root.find('p,h2,h3,li,strong,em,b,i,u').each((_, e) => {
    if (!$(e).text().replace(/[\u200b\u00a0\s]/g, '') && !$(e).find('img,a').length) $(e).remove();
  });
  root.find('ol,ul').each((_, e) => { if (!$(e).children().length) $(e).remove(); });
  root.find('li > p').each((_, e) => { $(e).replaceWith($(e).contents()); });
  // autolink bare URLs in text nodes
  const walk = (node) => {
    $(node).contents().each((_, c) => {
      if (c.type === 'text') {
        if ($(c).parents('a').length) return;
        const t = c.data;
        if (/https?:\/\/\S+/.test(t)) {
          const out = esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:)»])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
          $(c).replaceWith(out);
        }
      } else if (c.type === 'tag') walk(c);
    });
  };
  walk(root);
  return sanitizePage(root.html().replace(/\u200b/g, '').replace(/&nbsp;/g, ' ').replace(/\n\s*\n/g, '\n').trim());
}

const fileExt = (rel) => rel.split('.').pop().toUpperCase();

function fileCard(rel, label, sub) {
  return `<a class="file" href="${rel}" download>
    <span class="file-ico">${fileExt(rel)}</span>
    <span class="file-txt"><strong>${esc(label)}</strong><small>${esc(sub || fileExt(rel))} · ${sizeOf(rel)}</small></span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </a>`;
}

// generic block renderer -----------------------------------------------------
function renderGeneric(blocks) {
  let html = '';
  let prev = null;
  for (const b of blocks) {
    if (b.k === 'rt') {
      const c = cleanRich(b.h);
      if (c) html += `<div class="prose">${c}</div>\n`;
    } else if (b.k === 'img') {
      const rel = assets[b.src];
      if (rel && exists(rel) && prev !== 'file') {
        html += `<figure class="shot"><a href="${rel}" target="_blank" rel="noopener"><img src="${rel}" alt="${esc(b.alt || '')}" loading="lazy"></a></figure>\n`;
      }
    } else if (b.k === 'link') {
      const rel = assets[b.href];
      if (rel && exists(rel)) html += `<div class="files">${fileCard(rel, 'Скачать документ', fileExt(rel) === 'PDF' ? 'PDF-файл' : 'Файл')}</div>\n`;
    }
    prev = b.k === 'link' && assets[b.href] ? 'file' : b.k;
  }
  return html;
}

// data ---------------------------------------------------------------------
const readJson = (f, def) => { try { return JSON.parse(fs.readFileSync(ROOT + '/data/' + f, 'utf8')); } catch { return def; } };
const announcements = readJson('announcements.json', []);
const lectureTitles = readJson('lectures.json', {});
const dateKey = (d) => d.split('.').reverse().join('');
const sortedNews = () => [...announcements].sort((x, y) => dateKey(y.date).localeCompare(dateKey(x.date)));

// lectures -----------------------------------------------------------------
// Файлы лекций кладутся в files/ с именами: lekciya-N.pptx (ФГУ), mehmat-lekciya-N.pptx, speckurs-lekciya-N.pptx
function listLectures(prefix) {
  const re = new RegExp('^' + prefix + '(\\d+)\\.(pptx|ppt|pdf)$');
  const out = [];
  for (const f of fs.readdirSync(OUT + '/files')) {
    const m = f.match(re);
    if (m) out.push({ n: +m[1], rel: 'files/' + f, key: prefix + m[1] });
  }
  return out.sort((x, y) => x.n - y.n);
}

function lectureGrid(prefix) {
  let h = '<div class="lec-grid">';
  for (const { n, rel, key } of listLectures(prefix)) {
    const title = lectureTitles[key];
    h += `<a class="lec" href="${rel}" download><span class="lec-n">${n}</span><span class="lec-t">Лекция ${n}${title ? `<em>${esc(title)}</em>` : ''}</span><span class="lec-s">${fileExt(rel)} · ${sizeOf(rel)}</span></a>`;
  }
  return h + '</div>';
}

const lectureCount = () => listLectures('lekciya-').length + listLectures('mehmat-lekciya-').length;

function renderLectures() {
  return `
<p class="lead">Презентации лекций по истории России. Файлы скачиваются прямо с этого сайта.</p>
<h2>ФГУ: IX–XIX века</h2>
${lectureGrid('lekciya-')}
<h2>Мехмат</h2>
${lectureGrid('mehmat-lekciya-')}`;
}

function renderSpeckursLectures() {
  let h = '<p class="lead">Спецкурс «От Просвещения к постмодерну: революция и реакция в русской истории».</p><div class="files wide">';
  for (const { n, rel, key } of listLectures('speckurs-lekciya-')) h += fileCard(rel, `Лекция ${n}. ${lectureTitles[key] || ''}`.trim(), 'Презентация ' + fileExt(rel));
  return h + '</div>';
}

// announcements -----------------------------------------------------------
const newsItems = (list) => list.map((n) => `<li><time>${esc(String(n.date || ''))}</time><span>${sanitizePage(n.html)}</span></li>`).join('');
function renderAnnouncements() {
  return `<ul class="news">${newsItems(sortedNews())}</ul>`;
}

// ---- layout -------------------------------------------------------------------
const flat = [];
for (const s of NAV) for (const [p, slug, title] of s.items) flat.push({ p, slug, title, section: s.title });

function navHtml(currentSlug) {
  let h = '<nav class="nav" id="nav" aria-label="Основное меню"><ul>';
  h += `<li><a href="index.html"${currentSlug === 'index' ? ' aria-current="page"' : ''}>Главная</a></li>`;
  h += `<li><a href="zhurnal-ballov.html"${currentSlug === 'zhurnal-ballov' ? ' aria-current="page"' : ''}>Журнал баллов</a></li>`;
  for (const s of NAV) {
    const items = s.items.filter(([p]) => built.has(p));
    if (!items.length) continue;
    const active = items.some(([, slug]) => slug === currentSlug);
    h += `<li class="dd${active ? ' active' : ''}"><button type="button" aria-expanded="false">${s.title}<svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><ul>`;
    for (const [, slug, title] of items) h += `<li><a href="${slug}.html"${slug === currentSlug ? ' aria-current="page"' : ''}>${title}</a></li>`;
    h += '</ul></li>';
  }
  h += `<li><a href="kontakty.html"${currentSlug === 'kontakty' ? ' aria-current="page"' : ''}>Контакты</a></li>`;
  return h + '</ul></nav>';
}

function layout({ slug, title, body, crumb, desc, pager, connect, script, scene = ['square', 'inlibrary'] }) {
  const sc = DESIGN === 'scene';
  const t = slug === 'index' ? `${SITE} — сайт ${AUTHOR_GEN}` : `${title} — ${SITE}`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self';${connect ? ` connect-src 'self' ${connect};` : ''} object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(desc || 'Сайт для студентов МГУ имени М. В. Ломоносова, изучающих отечественную историю: лекции, семинары, задания, результаты.')}">
<meta name="theme-color" content="#7a1f2b">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/style.css">
${sc ? '<link rel="stylesheet" href="assets/scene/scene.css">\n<script src="assets/scene/boot.js"></script>\n' : ''}</head>
${sc ? (slug === 'index' ? '<body data-scene="home">' : `<body data-scene="page" data-scene-target="${scene[0]}">`) + '\n' + sceneLayers(slug === 'index' ? HOME_SCENES : scene) + '<div class="scene-grade" aria-hidden="true"></div><div class="scene-flash" aria-hidden="true"></div><canvas id="snow" aria-hidden="true"></canvas>' : '<body>'}
<a class="skip" href="#main">К содержанию</a>
<header class="top">
  <div class="top-in">
    <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">И</span><span class="brand-t"><strong>${SITE}</strong><small>Сайт ${AUTHOR_GEN}</small></span></a>
    <button class="burger" type="button" aria-controls="nav" aria-expanded="false" aria-label="Меню"><span></span><span></span><span></span></button>
    ${navHtml(slug)}
  </div>
</header>
<main id="main">
${slug === 'index' ? '' : `<div class="page-head"><div class="wrap">${crumb ? `<p class="crumb">${crumb}</p>` : ''}<h1>${esc(title)}</h1></div></div>`}
<div class="wrap content">
${body}
${pager || ''}
</div>
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <p>Сайт предназначен для студентов МГУ имени М. В. Ломоносова.<br>© ${AUTHOR}</p>
    <p><a href="kontakty.html">Связаться</a><br>Вопросы по работе сайта: <a href="https://t.me/qddwxd" target="_blank" rel="noopener">@qddwxd</a></p>
  </div>
</footer>
<script src="assets/app.js"></script>
${sc ? '<script type="module" src="assets/scene/scene.js"></script>\n' : ''}${script ? `<script type="module" src="${script}"></script>\n` : ''}</body>
</html>`;
}

// ---- build pages ------------------------------------------------------------
const built = new Set();
const results = [];
function pageBody(p) {
  const editable = ROOT + '/data/editable/' + pathToSlug[p] + '.json';
  if (exists('data/editable/' + pathToSlug[p] + '.json')) {
    const data = JSON.parse(fs.readFileSync(editable, 'utf8'));
    const content = sanitizePage(data.html);
    return '<div class="prose edited-page">' + (content.trim() || '<p>Материалы ещё не размещены.</p>') + '</div>';
  }
  const pg = pages[p];
  if (!pg) return '';
  if (p === '/lekcii') return renderLectures();
  if (p === '/презентации-лекций') return renderSpeckursLectures();
  if (p === '/obyavleniya') return renderAnnouncements();
  return renderGeneric(pg.blocks);
}
const bodies = {};
for (const it of flat) {
  const b = pageBody(it.p);
  if (b.trim()) { bodies[it.p] = b; built.add(it.p); }
}
built.add(CONTACT[0]);

for (const [idx, it] of flat.entries()) {
  if (!bodies[it.p]) { console.log('SKIP (empty):', it.p); continue; }
  const sectionItems = flat.filter((x) => x.section === it.section && bodies[x.p]);
  const i = sectionItems.indexOf(it);
  const prev = sectionItems[i - 1], next = sectionItems[i + 1];
  const pager = (prev || next) ? `<nav class="pager" aria-label="Соседние страницы">${prev ? `<a class="prev" href="${prev.slug}.html"><small>Назад</small>${prev.title}</a>` : '<span></span>'}${next ? `<a class="next" href="${next.slug}.html"><small>Далее</small>${next.title}</a>` : '<span></span>'}</nav>` : '';
  fs.writeFileSync(`${OUT}/${it.slug}.html`, layout({ slug: it.slug, title: it.title, body: bodies[it.p], crumb: `<a href="index.html">Главная</a> / ${it.section}`, pager, scene: SECTION_SCENE[it.section] }));
  results.push(it.slug);
}

// contacts
{
  const pg = pages['/contact-me'];
  let body = `<div class="card contact">
  <img class="portrait" src="img/portrait.jpg" alt="Соловьёв К. А." width="220" height="198">
  <div><h2>Соловьёв Константин Анатольевич</h2>
  <dl>
    <dt>Электронная почта</dt><dd><a href="mailto:solovyevka@gmail.com">solovyevka@gmail.com</a></dd>
    <dt>Телефон</dt><dd><a href="tel:+79166082789">+7 (916) 608-27-89</a></dd>
  </dl></div>
</div>
<div class="card contact tech">
  <div><h2>Вопросы по работе сайта</h2>
  <p>Не открывается страница, не скачивается файл, что-то отображается неправильно? Напишите в Telegram: <a href="https://t.me/qddwxd" target="_blank" rel="noopener">@qddwxd</a>.</p></div>
</div>`;
  // Фотографии фона распространяются по свободным лицензиям: указываем авторов.
  const credits = DESIGN === 'scene' ? readJson('../img/scene/credits.json', []) : [];
  if (credits.length) body += `<div class="card contact tech" id="foto"><div><h2>Фотографии на сайте</h2><p>Фон сайта — фотографии с Викисклада:</p><ul class="credits">${credits.map((c) =>
    `<li><a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''))}</a> — ${esc(c.artist || 'автор не указан')}, ${esc(c.license)}</li>`).join('')}</ul></div></div>`;
  fs.writeFileSync(`${OUT}/kontakty.html`, layout({ slug: 'kontakty', title: 'Контакты', body, crumb: '<a href="index.html">Главная</a>', scene: ['kremlin', 'inlibrary'] }));
}

// журнал баллов
{
  const view = publicView(readJson('journal.json', EMPTY_JOURNAL));
  const legend = GRADES.map((g, i) => `<li class="g${g.mark}"><span class="badge">${g.badge}</span>${i === 0 ? g.min + '+' : g.min > 0 ? g.min + '–' + (GRADES[i - 1].min - 1) : 'меньше ' + GRADES[i - 1].min} баллов</li>`).join('');
  const options = view.participants.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  const selfForm = JOURNAL_API ? `<section class="card jr-self" aria-labelledby="jr-self-h">
  <h2 id="jr-self-h">Внести свои баллы</h2>
  <p>Код выдаёт преподаватель. Можно вписать сразу несколько чисел через пробел, например <code>5 3 2</code>: они сложатся.</p>
  <form id="jr-form">
    <div class="jr-who">
      <div><label for="jr-id">Фамилия</label><select id="jr-id" required><option value="">— выберите себя —</option>${options}</select></div>
      <div><label for="jr-code">Код</label><input id="jr-code" type="password" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="ABCDE-FGHJK" required></div>
    </div>
    <label class="jr-remember"><input id="jr-remember" type="checkbox"> Запомнить фамилию и код на этом устройстве</label>
    <div class="jr-add"><label for="jr-points">Баллы</label><input id="jr-points" type="text" inputmode="decimal" autocomplete="off" placeholder="Например: 5" required><button class="btn" type="submit">ОК</button></div>
  </form>
  <p id="jr-status" class="jr-status" role="status" aria-live="polite" hidden></p>
</section>` : '';
  const body = `<p class="lead">Максимум за семестр — <strong>${MAX_POINTS} баллов</strong>. Сумма считается автоматически.</p>
<ul class="jr-legend" aria-label="Оценки">${legend}</ul>
<div class="jr-wrap" id="jr-table" data-api="${esc(JOURNAL_API)}"><table class="jr">
<thead><tr><th scope="col" class="num">№</th><th scope="col">Фамилия</th><th scope="col">Баллы</th><th scope="col" class="mark">Оценка</th></tr></thead>
<tbody>${rowsHtml(view)}</tbody></table></div>
${selfForm}`;
  fs.writeFileSync(`${OUT}/zhurnal-ballov.html`, layout({ slug: 'zhurnal-ballov', title: 'Журнал баллов', body, crumb: '<a href="index.html">Главная</a>', desc: 'Баллы участников: общая сумма и оценка.', connect: /^https:/.test(JOURNAL_API) ? new URL(JOURNAL_API).origin : '', script: 'assets/journal.js', scene: ['gum', 'ingum'] }));
}

// Главная: каждый экран — фотография здания Москвы и раздел сайта; прокрутка «пролетает» от снимка к снимку.
function sceneHome(intro, news) {
  const links = (list) => `<p class="chips">${list.map(([href, t]) => `<a class="chip" href="${href}">${t}</a>`).join('')}</p>`;
  const slide = (shot, title, text, extra) => `<section class="slide" id="s-${shot}" data-shot="${shot}">
  <div class="slide-in"><h2 class="rise">${title}</h2>${text ? `<p class="slide-text rise">${text}</p>` : ''}${extra ? `<div class="rise">${extra}</div>` : ''}</div>
</section>`;
  const slides = [
    `<section class="slide cover" id="s-start" data-shot="square">
  <div class="slide-in"><p class="kicker rise">МГУ имени М. В. Ломоносова</p><h1 class="rise">Отечественная история</h1>
  <p class="slide-text rise">Сайт для студентов, изучающих отечественную историю: программа курса, лекции, семинары, задания и результаты.</p>
  <p class="hero-cta rise"><a class="btn" href="lekcii.html">Презентации лекций</a><a class="btn ghost" href="zhurnal-ballov.html">Журнал баллов</a></p>
  <p class="scroll-hint rise" aria-hidden="true"><i></i>Листайте</p></div>
</section>`,
    slide('spasskaya', 'ФГУ', 'Рейтинговая система, задания, семинары, результаты проверки и итоги семестра.',
      links([['fgu-rejtingovaya-sistema.html', 'Рейтинговая система'], ['fgu-gruppa-107.html', 'Группа 107'], ['fgu-zadaniya.html', 'Задания'], ['fgu-rezultaty.html', 'Результаты'], ['fgu-voprosy-k-ekzamenu.html', 'Вопросы к экзамену']])),
    slide('ivan', 'Курсовые работы', 'Темы, методика подготовки, распределение тем и индекс.',
      links([['kursovye-temy.html', 'Тематика'], ['kursovye-metodika.html', 'Методика'], ['kursovye-raspredelenie.html', 'Распределение тем'], ['kursovye-indeks.html', 'Индекс']])),
    slide('basil', 'Курс «История»', `Программа курса, ${lectureCount() ? lectureCount() + ' презентаций лекций' : 'презентации лекций'} и методические материалы.`,
      links([['programma.html', 'Программа'], ['lekcii.html', 'Лекции'], ['metodicheskie-materialy.html', 'Методические материалы'], ['sajty.html', 'Сайты по истории России']])),
    slide('msu', 'Мехмат', 'Тематика семинаров, литература, эссе, рейтинг и вопросы к экзамену.',
      links([['mehmat-temy-seminarov.html', 'Семинары'], ['mehmat-literatura.html', 'Литература'], ['mehmat-zadaniya.html', 'Задания'], ['mehmat-rejting.html', 'Рейтинг'], ['mehmat-voprosy-k-ekzamenu.html', 'Вопросы к экзамену']])),
    slide('museum', 'Спецкурс', '«От Просвещения к постмодерну: революция и реакция в русской истории».',
      links([['speckurs.html', 'О спецкурсе'], ['speckurs-lekcii.html', 'Презентации лекций'], ['speckurs-seminary.html', 'Семинары'], ['speckurs-debaty.html', 'Дебаты']])),
    slide('gum', 'Журнал баллов и объявления', '',
      `<ul class="news">${news}</ul>${links([['zhurnal-ballov.html', 'Журнал баллов'], ['obyavleniya.html', 'Все объявления']])}`),
    slide('kremlin', 'О сайте', '',
      `<div class="prose">${cleanRich(intro.h)}</div>${links([['kontakty.html', 'Контакты'], ['zhurnal-ballov.html', 'Журнал баллов']])}`),
  ];
  const line = `<nav class="era-line" aria-label="Разделы">${[['start', 'Начало'], ['spasskaya', 'ФГУ'], ['ivan', 'Курсовые'], ['basil', 'Курс'], ['msu', 'Мехмат'], ['museum', 'Спецкурс'], ['gum', 'Журнал'], ['kremlin', 'О сайте']].map(([id, t]) => `<a href="#s-${id}">${t}</a>`).join('')}</nav>`;
  return `<div class="slides">${slides.join('\n')}</div>\n${line}`;
}

// home
{
  const intro = pages['/'].blocks.find((b) => b.k === 'rt');
  const news = newsItems(sortedNews().slice(0, 3));
  const tile = (href, t, d, n) => `<a class="tile" href="${href}"><span class="tile-n">${n}</span><strong>${t}</strong><small>${d}</small></a>`;
  const body = `
<section class="hero">
  <p class="eyebrow">МГУ имени М. В. Ломоносова</p>
  <h1>Отечественная история</h1>
  <p class="hero-p">Сайт для студентов, изучающих отечественную историю. Программа курса, лекции, семинары, задания и результаты проверки работ.</p>
  <div class="hero-cta"><a class="btn" href="lekcii.html">Презентации лекций</a><a class="btn ghost" href="zhurnal-ballov.html">Журнал баллов</a><a class="btn ghost" href="programma.html">Программа курса</a></div>
</section>
<section class="tiles" aria-label="Разделы">
  ${tile('lekcii.html', 'Лекции', `${lectureCount()} презентаций для ФГУ и мехмата`, '01')}
  ${tile('metodicheskie-materialy.html', 'Методические материалы', 'Учебник, кейсы, диспуты', '02')}
  ${tile('fgu-rejtingovaya-sistema.html', 'ФГУ', 'Рейтинг, задания, результаты', '03')}
  ${tile('mehmat-temy-seminarov.html', 'Мехмат', 'Семинары, эссе, экзамен', '04')}
  ${tile('speckurs.html', 'Спецкурс', 'Революция и реакция в русской истории', '05')}
  ${tile('kursovye-temy.html', 'Курсовые работы', 'Темы, методика, индекс', '06')}
</section>
<div class="two">
  <section class="prose card"><h2>О сайте</h2>${cleanRich(intro.h).replace(/«методические материалы»|"методические материалы"/, '«<a href="metodicheskie-materialy.html">методические материалы</a>»').replace(/"Лекции"/, '«<a href="lekcii.html">Лекции</a>»').replace(/"объявления"/, '«<a href="obyavleniya.html">объявления</a>»')}</section>
  <section class="card"><h2>Объявления</h2><ul class="news">${news}</ul><p class="more"><a href="obyavleniya.html">Все объявления →</a></p></section>
</div>`;
  fs.writeFileSync(`${OUT}/index.html`, layout({ slug: 'index', title: SITE, body: DESIGN === 'scene' ? sceneHome(intro, news) : body }));
}

console.log('built:', results.length + 3, 'pages');
