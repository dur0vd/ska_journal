// Фон сайта из фотографий Москвы с объёмом: у каждого снимка есть карта глубины (img/scene/depth),
// и ближние части — купола, башни, люди — смещаются сильнее дальних, как в настоящем 3D.
// На главной прокрутка «пролетает» сквозь снимок к следующему, на внутренних страницах камера
// приближается к зданию раздела и «входит» внутрь. Ночью — ночные снимки, днём — дневные.
const root = document.documentElement;
const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const flash = document.querySelector('.scene-flash');
const done = () => root.classList.remove('scene-intro');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

// ---------- тема ----------
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isNight = () => (root.dataset.theme || (darkMQ.matches ? 'dark' : 'light')) === 'dark';
const layers = [...document.querySelectorAll('.scene')].map((el) => {
  const img = el.querySelector('img'), src = el.querySelector('source');
  return { el, img, day: img.getAttribute('src'), night: src ? src.getAttribute('srcset') : null, dayDepth: el.dataset.depth, nightDepth: el.dataset.depthNight };
});
const pick = (l) => (isNight() && l.night ? { color: l.night, depth: l.nightDepth || l.dayDepth } : { color: l.day, depth: l.dayDepth });
// Снимок в DOM — запасной вариант без WebGL и для первого кадра.
function syncImgs() {
  for (const l of layers) {
    const want = pick(l).color;
    l.el.querySelector('source')?.remove();
    if (l.img.getAttribute('src') !== want) l.img.setAttribute('src', want);
  }
}
const toggle = document.querySelector('.theme-toggle');
if (toggle) toggle.addEventListener('click', () => {
  root.dataset.theme = isNight() ? 'light' : 'dark';
  try { localStorage.setItem('ska-theme', root.dataset.theme); } catch (e) {}
  syncImgs(); gl && gl.retheme(); render();
});
darkMQ.addEventListener?.('change', () => { if (!root.dataset.theme) { syncImgs(); gl && gl.retheme(); render(); } });
syncImgs();

// ---------- WebGL: снимок + карта глубины ----------
const gl = (() => {
  if (!layers.length || !layers.every((l) => l.dayDepth)) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-gl';
  const c = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!c) return null;
  const sh = (type, src) => { const s = c.createShader(type); c.shaderSource(s, src); c.compileShader(s); return s; };
  const prog = c.createProgram();
  c.attachShader(prog, sh(c.VERTEX_SHADER, 'attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; v.y = 1. - v.y; gl_Position = vec4(p, 0., 1.); }'));
  c.attachShader(prog, sh(c.FRAGMENT_SHADER, `precision highp float;
    uniform sampler2D uC, uD; uniform vec2 uCover, uOff; uniform float uZoom, uDolly, uAlpha, uFocus;
    varying vec2 v;
    vec2 at(float d){ vec2 q = (v - .5) / uZoom; q /= 1. + uDolly * d; q += uOff * (d - uFocus); return q * uCover + .5; }
    void main(){
      // два шага: глубина берётся там, куда смотрим после сдвига, — края зданий не рвутся
      float d = texture2D(uD, at(.5)).r;
      d = texture2D(uD, at(d)).r;
      d = texture2D(uD, at(d)).r;
      gl_FragColor = vec4(texture2D(uC, clamp(at(d), .001, .999)).rgb, uAlpha);
    }`));
  c.linkProgram(prog);
  if (!c.getProgramParameter(prog, c.LINK_STATUS)) return null;
  c.useProgram(prog);
  const buf = c.createBuffer();
  c.bindBuffer(c.ARRAY_BUFFER, buf);
  c.bufferData(c.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), c.STATIC_DRAW);
  const loc = c.getAttribLocation(prog, 'p');
  c.enableVertexAttribArray(loc); c.vertexAttribPointer(loc, 2, c.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uC', 'uD', 'uCover', 'uOff', 'uZoom', 'uDolly', 'uAlpha', 'uFocus']) U[n] = c.getUniformLocation(prog, n);
  c.uniform1i(U.uC, 0); c.uniform1i(U.uD, 1);
  c.enable(c.BLEND); c.blendFunc(c.SRC_ALPHA, c.ONE_MINUS_SRC_ALPHA);

  const cache = new Map();
  function texture(url) {
    if (cache.has(url)) return cache.get(url);
    const t = { tex: c.createTexture(), ready: false, w: 1, h: 1 };
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      c.bindTexture(c.TEXTURE_2D, t.tex);
      c.texImage2D(c.TEXTURE_2D, 0, c.RGBA, c.RGBA, c.UNSIGNED_BYTE, im);
      for (const [k, val] of [[c.TEXTURE_MIN_FILTER, c.LINEAR], [c.TEXTURE_MAG_FILTER, c.LINEAR], [c.TEXTURE_WRAP_S, c.CLAMP_TO_EDGE], [c.TEXTURE_WRAP_T, c.CLAMP_TO_EDGE]]) c.texParameteri(c.TEXTURE_2D, k, val);
      t.ready = true; t.w = im.naturalWidth; t.h = im.naturalHeight;
      render();
    };
    im.src = url;
    cache.set(url, t);
    return t;
  }
  const pair = (i) => { const p = pick(layers[i]); return { color: texture(p.color), depth: texture(p.depth) }; };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 1.25);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    c.viewport(0, 0, canvas.width, canvas.height);
  };
  addEventListener('resize', () => { resize(); render(); });
  resize();
  document.querySelector('.scenes').appendChild(canvas);
  return {
    canvas,
    retheme() {},
    preload(i) { if (layers[i]) pair(i); },
    ready(i) { const p = pair(i); return p.color.ready && p.depth.ready; },
    // list: [{ i, zoom, dolly, alpha }]
    draw(list, off) {
      c.clearColor(0.03, 0.035, 0.07, 1); c.clear(c.COLOR_BUFFER_BIT);
      for (const L of list) {
        const p = pair(L.i);
        if (!p.color.ready || !p.depth.ready || L.alpha <= 0) continue;
        // «cover»: снимок заполняет экран без полей, с запасом под сдвиг
        const ca = canvas.width / canvas.height, ia = p.color.w / p.color.h;
        const k = 0.93;
        c.uniform2f(U.uCover, ca > ia ? k : k * ca / ia, ca > ia ? k * ia / ca : k);
        c.uniform2f(U.uOff, off.x, off.y);
        c.uniform1f(U.uZoom, L.zoom); c.uniform1f(U.uDolly, L.dolly); c.uniform1f(U.uAlpha, L.alpha); c.uniform1f(U.uFocus, 0.35);
        c.activeTexture(c.TEXTURE0); c.bindTexture(c.TEXTURE_2D, p.color.tex);
        c.activeTexture(c.TEXTURE1); c.bindTexture(c.TEXTURE_2D, p.depth.tex);
        c.drawArrays(c.TRIANGLE_STRIP, 0, 4);
      }
    },
  };
})();
if (gl) root.classList.add('scene-3d');

// ---------- «камера» ----------
// pos: целая часть — номер снимка, дробная — насколько пролетели к следующему.
let pos = 0;
const look = { x: 0, y: 0, tx: 0, ty: 0 };
function frame(p) {
  const list = [];
  let flashAmt = 0;
  layers.forEach((l, i) => {
    const d = p - i;
    if (d <= -0.8 || d >= 0.8) return;
    if (d >= 0) list.push({ i, zoom: 1 + ease(clamp(d / 0.8, 0, 1)) * 0.5, dolly: ease(clamp(d / 0.8, 0, 1)) * 0.9, alpha: 1 }); // влетаем в снимок
    else {
      const t = ease(clamp(1 + d, 0, 1));
      list.push({ i, zoom: 0.9 + t * 0.1, dolly: (1 - t) * -0.25, alpha: clamp((d + 0.8) / 0.55, 0, 1) });
      flashAmt = Math.max(flashAmt, Math.sin(Math.PI * clamp((d + 0.8) / 0.6, 0, 1)) * 0.3);
    }
  });
  list.sort((a, b) => a.i - b.i);
  return { list, flashAmt };
}
function render() {
  const { list, flashAmt } = frame(pos);
  if (flash && !root.classList.contains('scene-leaving')) flash.style.opacity = flashAmt.toFixed(3);
  if (gl) {
    gl.draw(list, { x: look.x * 0.035, y: look.y * 0.022 });
    for (const L of list) gl.preload(L.i + 1);
    return;
  }
  layers.forEach((l, i) => {
    const L = list.find((x) => x.i === i);
    l.el.style.visibility = L ? 'visible' : 'hidden';
    if (!L) return;
    l.el.style.zIndex = String(i);
    l.el.style.opacity = L.alpha.toFixed(3);
    l.el.style.transform = `scale(${(L.zoom * (1 + L.dolly * 0.5)).toFixed(4)})`;
  });
}

// Взгляд следует за мышью, наклоном телефона и медленно «дышит» сам — объём виден всегда.
let target = 0;
addEventListener('pointermove', (e) => { look.tx = (e.clientX / innerWidth) * 2 - 1; look.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
addEventListener('deviceorientation', (e) => {
  if (e.gamma == null) return;
  look.tx = clamp(e.gamma / 25, -1, 1); look.ty = clamp((e.beta - 45) / 25, -1, 1);
}, { passive: true });
let running = false;
function loop(now) {
  if (document.hidden) { running = false; return; }
  const t = now / 1000;
  const auto = reduced ? 0 : 0.35;
  look.x += ((look.tx + Math.sin(t * 0.35) * auto) - look.x) * 0.05;
  look.y += ((look.ty * 0.6 + Math.cos(t * 0.27) * auto * 0.5) - look.y) * 0.05;
  pos += (target - pos) * (reduced ? 1 : 0.075);
  render();
  requestAnimationFrame(loop);
}
const start = () => { if (!running && (gl || Math.abs(target - pos) > 0.0005)) { running = true; requestAnimationFrame(loop); } };
document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

if (body.dataset.scene === 'home') {
  const slides = [...document.querySelectorAll('[data-shot]')];
  const dots = [...document.querySelectorAll('.era-line a')];
  const measure = () => {
    const tops = slides.map((s) => s.offsetTop);
    const y = Math.min(scrollY, document.documentElement.scrollHeight - innerHeight);
    let i = 0;
    while (i < tops.length - 1 && y >= tops[i + 1]) i++;
    const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1;
    const frac = clamp((y - tops[i]) / span, 0, 1);
    // Пока экран на месте, видно его здание; перелёт — во второй половине прокрутки.
    target = Math.min(layers.length - 1, i + Math.max(0, (frac - 0.4) / 0.6));
    const cur = Math.min(slides.length - 1, i + (frac > 0.6 ? 1 : 0));
    slides.forEach((s, j) => s.classList.toggle('active', j === cur));
    dots.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + slides[cur].id));
    start();
  };
  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', measure);
  root.classList.add('scene-ready');
  measure(); pos = target; render();
  done();
} else if (layers.length) {
  // Снимок 0 — здание раздела, последний — помещение внутри.
  const section = body.dataset.sceneTarget || '';
  let skip = reduced || layers.length < 2;
  try { skip = skip || sessionStorage.getItem('scene-section') === section; sessionStorage.setItem('scene-section', section); } catch (e) {}
  const last = layers.length - 1;
  if (skip) { pos = target = last; render(); done(); start(); } else {
    pos = target = 0; render();
    let started = false;
    const go = () => {
      if (started) return; started = true;
      const t0 = performance.now(), dur = 2000;
      const step = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        pos = target = t * t * last; // разгон к двери
        if (t > 0.55) done();
        if (t < 1) requestAnimationFrame(step); else { pos = target = last; start(); }
      };
      requestAnimationFrame(step);
      start();
    };
    // Ждём снимок и его глубину, чтобы не лететь сквозь пустоту.
    const wait = () => (gl ? gl.ready(0) : layers[0].img.complete) ? go() : setTimeout(wait, 60);
    wait(); setTimeout(go, 1800);
  }
} else done();

// Переход по ссылке: камера «ныряет» в снимок, страница меркнет.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || reduced || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = a.getAttribute('href');
  if (!/^[a-z0-9-]+\.html(#.*)?$/.test(href) || a.target === '_blank' || a.hasAttribute('download')) return;
  e.preventDefault();
  root.classList.add('scene-leaving');
  const from = pos, t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / 450);
    pos = target = from + t * t * 0.55;
    if (flash) flash.style.opacity = String(t * 0.9);
    render();
    if (t < 1) requestAnimationFrame(step); else location.href = href;
  };
  requestAnimationFrame(step);
});
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  root.classList.remove('scene-leaving');
  if (flash) flash.style.opacity = '0';
});

// Снег: снежинки медленно падают и расступаются перед курсором.
(() => {
  const cv = document.getElementById('snow');
  if (!cv || reduced) return;
  const ctx = cv.getContext('2d');
  let W, H, dpr;
  const flakes = [], mouse = { x: -999, y: -999 };
  const resize = () => {
    dpr = Math.min(1, Math.sqrt(2e6 / (innerWidth * innerHeight)));
    W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
  };
  resize(); addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
  const n = innerWidth < 760 ? 70 : 140;
  for (let i = 0; i < n; i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.8 + 0.5) * dpr, vy: Math.random() * 0.6 + 0.25, sway: Math.random() * 6.28, a: Math.random() * 0.5 + 0.3 });
  const tick = () => {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    for (const f of flakes) {
      f.sway += 0.01;
      f.y += f.vy * dpr; f.x += Math.sin(f.sway) * 0.3 * dpr;
      const dx = f.x - mouse.x, dy = f.y - mouse.y, d2 = dx * dx + dy * dy, R = 110 * dpr;
      if (d2 < R * R) { const k = (1 - Math.sqrt(d2) / R) * 2; f.x += dx / Math.sqrt(d2 + 1) * k; f.y += dy / Math.sqrt(d2 + 1) * k; }
      if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
      ctx.globalAlpha = f.a;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
    }
  };
  requestAnimationFrame(tick);
})();
