// Скачивает фотографии для фона сайта с Викисклада (только свободные лицензии) и пишет авторов в img/scene/credits.json.
// Режимы: node tools/fetch-photos.mjs candidates — по несколько вариантов на каждое место, чтобы выбрать лучшие;
//         node tools/fetch-photos.mjs final — файлы из img/scene/choice.json в полном размере.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'img/scene');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'SkaHistSite/1.0 (https://github.com/dur0vd/ska_hist)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, binary) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
    await sleep(2000 * (i + 1));
  }
  throw new Error('Не удалось загрузить ' + url);
}
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const FREE = /^(CC0|CC BY(-SA)? [\d.]+|Public domain|PD)/i;

async function info(params, width) {
  const q = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: String(width), ...params });
  const res = await get(API + '?' + q);
  return Object.values(res.query?.pages || {}).filter((p) => p.imageinfo).map((p) => {
    const ii = p.imageinfo[0], m = ii.extmetadata || {};
    return { title: p.title, index: p.index ?? 0, width: ii.width, height: ii.height, thumb: ii.thumburl, page: ii.descriptionurl,
      license: strip(m.LicenseShortName?.value), artist: strip(m.Artist?.value) };
  });
}

const PLACES = {
  'p-vladimir': ['Vladimir I of Kiev', 'Vladimir Sviatoslavich Tsarsky titulyarnik', 'Saint Vladimir Equal-to-the-Apostles painting'],
  'p-andrey': ['Andrei Bogolyubsky', 'Andrei Bogoliubsky Tsarsky titulyarnik'],
  'peterhof-night': ['Peterhof Grand Palace night', 'Peterhof fountains illuminated'],
  'novsophia-night': ['Veliky Novgorod Kremlin night', 'Detinets Veliky Novgorod night'],
};

async function candidates() {
  fs.mkdirSync(path.join(OUT, 'candidates'), { recursive: true });
  const list = [];
  for (const [key, queries] of Object.entries(PLACES)) {
    let n = 0;
    for (const query of queries) {
      for (const extra of [' incategory:"Quality_images"', '']) {
        if (n >= 4) break;
        const found = (await info({ generator: 'search', gsrsearch: query + extra + ' filetype:bitmap', gsrnamespace: '6', gsrlimit: '12' }, 1024))
          .sort((a, b) => a.index - b.index)
          .filter((x) => FREE.test(x.license) && (key.startsWith('p-') || key === 'tithes' ? x.width >= 600 : x.width >= 1600 && x.width > x.height * 1.2) && !list.some((y) => y.title === x.title));
        for (const x of found.slice(0, 4 - n)) {
          const file = `candidates/${key}-${++n}.jpg`;
          fs.writeFileSync(path.join(OUT, file), await get(x.thumb, true));
          list.push({ key, file, ...x });
          await sleep(300);
        }
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'candidates.json'), JSON.stringify(list, null, 2) + '\n');
  console.log('candidates:', list.length);
}

async function final() {
  const choice = JSON.parse(fs.readFileSync(path.join(OUT, 'choice.json'), 'utf8'));
  const credits = [];
  for (const [key, title] of Object.entries(choice)) {
    const [x] = await info({ titles: title }, 2200);
    if (!x || !FREE.test(x.license)) throw new Error('Нет свободной лицензии: ' + title);
    // уже скачанные (и сжатые) снимки и вырезанные фигуры не перекачиваем — меняются только подписи
    const have = [key + '.jpg', 'fig/' + key + '.webp'].some((f) => fs.existsSync(path.join(OUT, f)));
    if (!have) fs.writeFileSync(path.join(OUT, key + '.jpg'), await get(x.thumb, true));
    credits.push({ key, title: x.title, artist: x.artist, license: x.license, page: x.page });
    await sleep(300);
  }
  fs.writeFileSync(path.join(OUT, 'credits.json'), JSON.stringify(credits, null, 2) + '\n');
  console.log('final:', credits.length);
}

await (process.argv[2] === 'final' ? final() : candidates());
