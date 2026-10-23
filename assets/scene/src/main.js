// Фон сайта: настоящие фотографии, превращённые в 3D. По карте глубины (img/scene/depth) каждый снимок
// становится рельефной сценой, камера в ней движется по-настоящему: здания, купола и деревья
// смещаются друг относительно друга, а пролёт «внутрь» здания — это движение камеры в глубину снимка.
// На главной прокрутка летит от здания к зданию; на страницах раздела камера подлетает и входит внутрь,
// где стоит историческая личность (вырезанный из портрета объёмный силуэт).
// Здания, для которых собран каркас (models/), — настоящие 3D-модели: снимок наклеен на каркас
// с точки фотографа, вокруг — та же местность; камера облетает их и подлетает к ним.
import * as THREE from 'three';
import { modelScene } from './modelScene.js';
import { MODELS } from './models/index.js';

const root = document.documentElement;
const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const flash = document.querySelector('.scene-flash');
const done = () => root.classList.remove('scene-intro');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isNight = () => (root.dataset.theme || (darkMQ.matches ? 'dark' : 'light')) === 'dark';

let fellBack = false;
function fallback(why) {
  if (fellBack || root.classList.contains('scene-3d')) return;
  fellBack = true;
  if (why) console.warn('3D-фон недоступен:', why);
  document.querySelector('.scene-gl')?.remove();
  root.classList.add('scene-fallback');
  done();
  const p = './scene.js';
  import(p);
}

// ---------- снимки страницы ----------
const layers = [...document.querySelectorAll('.scene')].map((el) => {
  const img = el.querySelector('img'), src = el.querySelector('source');
  return {
    day: img.getAttribute('src'), night: src ? src.getAttribute('srcset') : null,
    dayDepth: el.dataset.depth, nightDepth: el.dataset.depthNight, model: MODELS[el.dataset.model] ? el.dataset.model : null,
    figure: el.dataset.figure ? { src: el.dataset.figure, depth: el.dataset.figureDepth } : null,
  };
});
const pick = (l) => (isNight() && l.night ? { color: l.night, depth: l.nightDepth || l.dayDepth } : { color: l.day, depth: l.dayDepth });

const loadImage = (url) => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error(url)); im.src = url; });
function pixels(im, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

const FOV = 58; // предполагаемый угол обзора снимка по горизонтали
const NEAR = 10; // расстояние до самого близкого (белого на карте глубины)
// Рельеф: вершина сетки уходит по лучу камеры на расстояние, зависящее от глубины.
// Самое дальнее (небо) — в 7 раз дальше ближнего; сетка цельная, поэтому за зданиями нет пустоты.
function relief(colorImg, depthImg, cols, { near = NEAR, range = 0.86, alphaMap = null } = {}) {
  const aspect = colorImg.naturalWidth / colorImg.naturalHeight;
  const rows = Math.max(2, Math.round(cols / aspect));
  const D = pixels(depthImg, cols + 1, rows + 1);
  const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  const tx = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), ty = tx / aspect;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const px = Math.round(u * cols), py = Math.round((1 - v) * rows);
    const d = D[(py * (cols + 1) + px) * 4] / 255;
    const dist = near / (1 - range + range * d);
    p.setXYZ(i, (u * 2 - 1) * tx * dist, (v * 2 - 1) * ty * dist, -dist);
  }
  geo.computeBoundingSphere();
  const tex = new THREE.Texture(colorImg); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: true, alphaTest: alphaMap ? 0.5 : 0 });
  return { mesh: new THREE.Mesh(geo, mat), aspect, tx, ty };
}

// Фигура: рельеф высотой 1 и шириной по пропорциям портрета, выпуклость — по карте глубины
function figureMesh(colorImg, depthImg, rows) {
  const aspect = colorImg.naturalWidth / colorImg.naturalHeight, cols = Math.max(2, Math.round(rows * aspect));
  const D = pixels(depthImg, cols + 1, rows + 1);
  const geo = new THREE.PlaneGeometry(aspect, 1, cols, rows);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const px = Math.round(uv.getX(i) * cols), py = Math.round((1 - uv.getY(i)) * rows);
    p.setZ(i, (D[(py * (cols + 1) + px) * 4] / 255) * 0.16 * aspect);
  }
  const tex = new THREE.Texture(colorImg); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
  m.userData.aspect = aspect;
  return m;
}

async function start() {
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-gl';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { fallback(e); return; }
  const small = innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
  const COLS = small ? 160 : 260;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.5));
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); location.reload(); });
  document.querySelector('.scenes').appendChild(canvas);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  // Слой с прозрачностью (наплыв следующей сцены) рисуется в текстуру и накладывается поверх
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  const blitMat = new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, depthTest: false, depthWrite: false });
  const blit = new THREE.Scene(); blit.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));
  const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // Сцена каждого снимка строится по запросу и хранится; ночь и день — отдельные сцены.
  // Модель здания одна на день и ночь: ночью темнеет окружение и включается подсветка.
  const cache = new Map();
  async function scene(i) {
    const l = layers[i]; if (!l) return null;
    const p = pick(l), key = l.model ? 'model:' + l.model : p.color;
    if (cache.has(key)) return cache.get(key);
    const job = (async () => {
      if (l.model) {
        try {
          const m = await modelScene(renderer, l.model, MODELS[l.model], `img/scene/${l.model}.jpg`, { small });
          if (renderer.compileAsync) await renderer.compileAsync(m.scene, camera);
          return { model: m, night: null };
        } catch (e) { console.warn('модель', l.model, e); cache.delete(key); l.model = null; return scene(i); }
      }
      const [c, d] = await Promise.all([loadImage(p.color), loadImage(p.depth)]);
      const s = new THREE.Scene();
      const r = relief(c, d, COLS);
      s.add(r.mesh);
      const out = { scene: s, mat: r.mesh.material, aspect: r.aspect, tx: r.tx, ty: r.ty, figure: null };
      if (l.figure) {
        // Историческая личность: вырезанный портрет с рельефом; ставится в кадре в frameFor
        const [fc, fd] = await Promise.all([loadImage(l.figure.src), loadImage(l.figure.depth)]);
        out.figure = figureMesh(fc, fd, small ? 90 : 150);
        s.add(out.figure);
      }
      return out;
    })();
    cache.set(key, job);
    return job;
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); rt.setSize(sz.x, sz.y);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // Камера в сцене снимка: fwd — пролёт вглубь (0 — точка съёмки), sway — покачивание от мыши/наклона
  const sway = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { sway.tx = (e.clientX / innerWidth) * 2 - 1; sway.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  addEventListener('deviceorientation', (e) => { if (e.gamma != null) { sway.tx = clamp(e.gamma / 25, -1, 1); sway.ty = clamp((e.beta - 45) / 25, -1, 1); } }, { passive: true });
  // Камера у модели: начинает с точки фотографа, при прокрутке облетает здание и подлетает к нему
  function frameModel(m, fwd) {
    camera.near = 0.5; camera.far = 6000; camera.aspect = innerWidth / innerHeight;
    m.fit(camera);
    const t = clamp(fwd, -0.4, 1.6), r = m.range;
    const daz = clamp(r * (sway.x * 0.3 + (t - 0.25) * 1.1), -r, r);
    const k = 1 - Math.max(0, t) * 0.42 + Math.max(0, -t) * 0.9;
    m.place(camera, daz, Math.max(0.35, k), -sway.y * 0.025 + Math.max(0, t) * 0.05);
  }
  function frameFor(s, fwd) {
    camera.near = 0.1; camera.far = 500;
    // кадр как у фотоаппарата: снимок заполняет экран без полей при любом соотношении сторон
    const screen = camera.aspect, photo = s.aspect;
    const ty = screen > photo ? s.tx / screen : s.ty;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(ty * 0.9));
    camera.updateProjectionMatrix();
    camera.position.set(sway.x * 0.55, -sway.y * 0.3, -fwd * NEAR);
    camera.lookAt(sway.x * 0.2, -sway.y * 0.1, -NEAR * 3);
    if (s.figure) {
      const dist = NEAR * 1.1, half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
      // во весь рост — почти на высоту кадра; поясной портрет или фреска — как бюст
      const bust = s.figure.userData.aspect > 0.6;
      const h = half * 2 * (bust ? 0.5 : 0.92), w = h * s.figure.userData.aspect;
      s.figure.scale.setScalar(h);
      const right = half * camera.aspect;
      // справа, но не за краем; на узком экране — по центру, за текстом видна голова
      const x = camera.aspect > 1 ? Math.min(right * 0.5, right - w * 0.55) : 0;
      s.figure.position.set(x, bust ? half * 0.18 : -half * 0.12, -dist);
    }
  }
  async function draw(list) {
    renderer.clear();
    for (const L of list) {
      const s = await L.s;
      if (!s || L.alpha <= 0) continue;
      if (s.model) {
        const night = isNight();
        if (s.night !== night) { s.model.setNight(night); s.night = night; }
        frameModel(s.model, L.fwd);
        if (L.alpha >= 0.999) { renderer.clearDepth(); renderer.render(s.model.scene, camera); continue; }
        renderer.setRenderTarget(rt); renderer.clear(); renderer.render(s.model.scene, camera); renderer.setRenderTarget(null);
        blitMat.opacity = L.alpha; renderer.render(blit, blitCam);
        continue;
      }
      s.mat.opacity = L.alpha;
      if (s.figure) s.figure.material.opacity = L.alpha;
      frameFor(s, L.fwd);
      renderer.clearDepth();
      renderer.render(s.scene, camera);
    }
  }

  // pos: целая часть — номер снимка, дробная — насколько пролетели к следующему.
  const ready = new Set();
  const want = (i) => { const s = scene(i); if (s) s.then(() => ready.add(i)).catch(() => {}); return s; };
  function list(pos) {
    const out = [];
    let flashAmt = 0;
    const i = Math.floor(pos), t = pos - i;
    // уходим вглубь текущего снимка, следующий выплывает навстречу
    out.push({ s: want(i), fwd: ease(clamp(t / 0.85, 0, 1)) * 0.62 + 0.02, alpha: 1 });
    if (t > 0.35 && layers[i + 1]) {
      const k = clamp((t - 0.35) / 0.5, 0, 1);
      out.push({ s: want(i + 1), fwd: -0.18 * (1 - ease(k)), alpha: k });
      flashAmt = Math.sin(Math.PI * k) * 0.28;
    }
    want(i + 1);
    if (flash && !root.classList.contains('scene-leaving')) flash.style.opacity = flashAmt.toFixed(3);
    return out;
  }

  let pos = 0, target = 0, drawing = false, extra = 0;
  if (body.dataset.scene === 'home') {
    const slides = [...document.querySelectorAll('[data-shot]')];
    const dots = [...document.querySelectorAll('.era-line a')];
    const instant = /[?&]instant\b/.test(location.search);
    const measure = () => {
      const tops = slides.map((s) => s.offsetTop);
      const y = Math.min(scrollY, document.documentElement.scrollHeight - innerHeight);
      let i = 0;
      while (i < tops.length - 1 && y >= tops[i + 1]) i++;
      const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1;
      const frac = clamp((y - tops[i]) / span, 0, 1);
      target = Math.min(layers.length - 1, i + Math.max(0, (frac - 0.4) / 0.6));
      const cur = Math.min(slides.length - 1, i + (frac > 0.6 ? 1 : 0));
      slides.forEach((s, j) => s.classList.toggle('active', j === cur));
      dots.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + slides[cur].id));
      if (instant) pos = target;
    };
    addEventListener('scroll', measure, { passive: true });
    addEventListener('resize', measure);
    measure(); pos = target;
    root.classList.add('scene-ready');
    done();
  } else {
    // снимок 0 — здание раздела, последний — внутри; подлёт один раз за раздел
    const section = body.dataset.sceneTarget || '';
    let skip = reduced || layers.length < 2;
    try { skip = skip || sessionStorage.getItem('scene-section') === section; sessionStorage.setItem('scene-section', section); } catch (e) {}
    const last = layers.length - 1;
    pos = target = skip ? last : 0;
    if (skip) done();
    else {
      await want(0); await want(last);
      const t0 = performance.now();
      const fly = () => {
        const t = clamp((performance.now() - t0) / 2400, 0, 1);
        pos = target = t * t * last;
        if (t > 0.55) done();
        if (t < 1) requestAnimationFrame(fly);
      };
      requestAnimationFrame(fly);
    }
    // внутри прокрутка немного продвигает камеру к фигуре
    addEventListener('scroll', () => { extra = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), 0, 1) * 0.25; }, { passive: true });
  }

  const toggle = document.querySelector('.theme-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    root.dataset.theme = isNight() ? 'light' : 'dark';
    try { localStorage.setItem('ska-theme', root.dataset.theme); } catch (e) {}
  });

  // переход по ссылке: камера «ныряет» в снимок
  let diving = null;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || reduced || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if (!/^[a-z0-9-]+\.html(#.*)?$/.test(href) || a.target === '_blank' || a.hasAttribute('download')) return;
    e.preventDefault();
    root.classList.add('scene-leaving');
    diving = { t0: performance.now(), href };
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { root.classList.remove('scene-leaving'); diving = null; if (flash) flash.style.opacity = '0'; } });

  await want(Math.floor(pos));
  if (fellBack) return;
  let shown = false;
  async function loop(now) {
    if (fellBack) return;
    requestAnimationFrame(loop);
    if (document.hidden || drawing) return;
    drawing = true;
    sway.x += (sway.tx + Math.sin(now / 2600) * 0.35 - sway.x) * 0.04;
    sway.y += (sway.ty * 0.6 + Math.cos(now / 3400) * 0.2 - sway.y) * 0.04;
    pos += (target - pos) * (reduced ? 1 : 0.07);
    const L = list(pos);
    if (body.dataset.scene !== 'home' && Math.abs(pos - (layers.length - 1)) < 0.001) L[0].fwd += extra;
    if (diving) {
      const t = Math.min(1, (now - diving.t0) / 450);
      L[L.length - 1].fwd += t * t * 0.5;
      if (flash) flash.style.opacity = String(t);
      if (t >= 1) { location.href = diving.href; diving.t0 = Infinity; }
    }
    await draw(L);
    drawing = false;
    if (!shown) { shown = true; root.classList.add('scene-3d'); }
  }
  requestAnimationFrame(loop);
}

setTimeout(() => fallback('долгая загрузка'), 15000);
start().catch((e) => fallback(e));
