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
  // Ночные виды для тёмной темы (дневные и интерьеры уже выбраны в choice.json)
  'square-night': ['Red Square Moscow at night', 'Red Square night illumination'],
  'spasskaya-night': ['Spasskaya Tower at night'],
  'basil-night': ["Saint Basil's Cathedral at night"],
  'ivan-night': ['Ivan the Great Bell Tower night', 'Moscow Kremlin cathedrals night'],
  'msu-night': ['Moscow State University main building night'],
  'museum-night': ['State Historical Museum Moscow night'],
  'gum-night': ['GUM Moscow night illumination', 'GUM Red Square evening lights'],
};

async function candidates() {
  fs.mkdirSync(path.join(OUT, 'candidates'), { recursive: true });
  const list = [];
  for (const [key, queries] of Object.entries(PLACES)) {
    let n = 0;
    for (const query of queries) {
      for (const extra of [' incategory:"Quality_images"', '']) {
        if (n >= 5) break;
        const found = (await info({ generator: 'search', gsrsearch: query + extra + ' filetype:bitmap', gsrnamespace: '6', gsrlimit: '12' }, 1280))
          .sort((a, b) => a.index - b.index)
          .filter((x) => FREE.test(x.license) && x.width >= 1600 && x.width > x.height * 1.2 && !list.some((y) => y.title === x.title));
        for (const x of found.slice(0, 5 - n)) {
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
    fs.writeFileSync(path.join(OUT, key + '.jpg'), await get(x.thumb, true));
    credits.push({ key, title: x.title, artist: x.artist, license: x.license, page: x.page });
    await sleep(300);
  }
  fs.writeFileSync(path.join(OUT, 'credits.json'), JSON.stringify(credits, null, 2) + '\n');
  console.log('final:', credits.length);
}

await (process.argv[2] === 'final' ? final() : candidates());
