// Фон сайта из фотографий Москвы. На главной прокрутка «пролетает» сквозь снимок к следующему,
// на внутренних страницах камера приближается к зданию раздела и «входит» внутрь.
const root = document.documentElement;
const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scenes = [...document.querySelectorAll('.scene')];
const flash = document.querySelector('.scene-flash');
const done = () => root.classList.remove('scene-intro');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

// Положение «камеры» pos: целая часть — номер снимка, дробная — насколько пролетели к следующему.
function draw(pos) {
  let flashAmt = 0;
  scenes.forEach((sc, i) => {
    const d = pos - i;
    const show = d > -0.8 && d < 0.8;
    sc.style.visibility = show ? 'visible' : 'hidden';
    if (!show) return;
    let scale, op;
    if (d >= 0) { scale = 1 + ease(clamp(d / 0.8, 0, 1)) * 0.9; op = 1; } // улетаем в снимок
    else { // следующий снимок выходит из глубины
      scale = 0.86 + ease(clamp(1 + d, 0, 1)) * 0.14;
      op = clamp((d + 0.8) / 0.55, 0, 1);
      flashAmt = Math.max(flashAmt, Math.sin(Math.PI * clamp((d + 0.8) / 0.6, 0, 1)) * 0.3);
    }
    sc.style.zIndex = String(i);
    sc.style.opacity = op.toFixed(3);
    sc.style.transform = `scale(${scale.toFixed(4)})`;
  });
  if (flash) flash.style.opacity = flashAmt.toFixed(3);
}

if (body.dataset.scene === 'home') {
  const slides = [...document.querySelectorAll('[data-shot]')];
  const dots = [...document.querySelectorAll('.era-line a')];
  let target = 0, pos = 0, settled = true;
  const step = () => {
    pos += (target - pos) * (reduced ? 1 : 0.075);
    draw(pos);
    if (Math.abs(target - pos) < 0.0005) { pos = target; draw(pos); settled = true; return; }
    requestAnimationFrame(step);
  };
  const measure = () => {
    const tops = slides.map((s) => s.offsetTop);
    const y = Math.min(scrollY, document.documentElement.scrollHeight - innerHeight);
    let i = 0;
    while (i < tops.length - 1 && y >= tops[i + 1]) i++;
    const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1;
    const frac = clamp((y - tops[i]) / span, 0, 1);
    // Пока экран на месте, видно его здание; перелёт — во второй половине прокрутки.
    target = Math.min(scenes.length - 1, i + Math.max(0, (frac - 0.4) / 0.6));
    const cur = Math.min(slides.length - 1, i + (frac > 0.6 ? 1 : 0));
    slides.forEach((s, j) => s.classList.toggle('active', j === cur));
    dots.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + slides[cur].id));
    if (settled) { settled = false; requestAnimationFrame(step); }
  };
  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', measure);
  root.classList.add('scene-ready');
  measure(); pos = target; draw(pos);
  done();
} else if (scenes.length) {
  // Снимок 0 — здание раздела, последний — помещение внутри.
  const section = body.dataset.sceneTarget || '';
  let skip = reduced || scenes.length < 2;
  try { skip = skip || sessionStorage.getItem('scene-section') === section; sessionStorage.setItem('scene-section', section); } catch (e) {}
  const last = scenes.length - 1;
  if (skip) { draw(last); done(); } else {
    draw(0);
    const go = () => {
      const t0 = performance.now(), dur = 1900;
      const step = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        draw(t * t * last); // разгон к двери
        if (t > 0.55) done();
        if (t < 1) requestAnimationFrame(step); else draw(last);
      };
      requestAnimationFrame(step);
    };
    // Ждём первый снимок, чтобы не лететь сквозь пустоту.
    const img = scenes[0].querySelector('img');
    let started = false;
    const once = () => { if (!started) { started = true; go(); } };
    if (img.complete) once(); else { img.onload = img.onerror = once; setTimeout(once, 1500); }
  }
} else done();

// Переход по ссылке: снимок «надвигается», страница меркнет.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || reduced || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = a.getAttribute('href');
  if (!/^[a-z0-9-]+\.html(#.*)?$/.test(href) || a.target === '_blank' || a.hasAttribute('download')) return;
  e.preventDefault();
  root.classList.add('scene-leaving');
  const visible = scenes.filter((s) => s.style.visibility !== 'hidden').pop();
  const from = visible ? parseFloat((visible.style.transform.match(/[\d.]+/) || ['1'])[0]) : 1;
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / 420);
    if (visible) visible.style.transform = `scale(${(from + t * t * 0.8).toFixed(4)})`;
    if (flash) flash.style.opacity = String(t * 0.9);
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
  const frame = () => {
    requestAnimationFrame(frame);
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
  requestAnimationFrame(frame);
})();
