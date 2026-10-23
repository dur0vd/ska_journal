// 3D-фон сайта: на главной камера летит над Красной площадью при прокрутке,
// на внутренних страницах — подлетает к зданию раздела и «входит» внутрь.
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { buildInterior } from './interior.js';

const root = document.documentElement;
const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const done = () => root.classList.remove('scene-intro');
const flash = document.querySelector('.scene-flash');
const canvas = document.getElementById('world');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  root.classList.add('scene-fallback'); done();
  throw e;
}
const small = innerWidth < 760;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.6));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2500);
const outside = new THREE.Scene();
outside.fog = new THREE.Fog('#3a2b4f', 160, 900);
outside.add(new THREE.HemisphereLight('#6a78b8', '#3a2a20', 0.55));
const sun = new THREE.DirectionalLight('#ffb37a', 2.2); sun.position.set(-300, 120, 220); outside.add(sun);
const fill = new THREE.DirectionalLight('#6f7dff', 0.6); fill.position.set(200, 80, -200); outside.add(fill);
const P = buildWorld(outside);

// снег
const snow = (() => {
  const n = small ? 900 : 2200, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 300; pos[i * 3 + 1] = Math.random() * 120; pos[i * 3 + 2] = (Math.random() - 0.5) * 300; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32;
  const c = dot.getContext('2d'), grad = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grad; c.fillRect(0, 0, 32, 32);
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.6, map: new THREE.CanvasTexture(dot), transparent: true, opacity: 0.85, depthWrite: false }));
  outside.add(p);
  return p;
})();

const inside = new THREE.Scene();
let room = null;

// ---------- кадры ----------
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const SHOTS = {
  overview: { pos: v(30, 60, -190), look: v(0, 6, 60) },
  basil: { pos: v(-12, 22, 36), look: v(P.basil.x, 20, P.basil.z), door: P.basil.door },
  spasskaya: { pos: v(-2, 16, 28), look: v(-46, 36, 62), door: P.spasskaya.door },
  msu: { pos: v(-170, 60, 380), look: v(-280, 80, 580), door: P.msu.door },
  museum: { pos: v(42, 20, -46), look: v(-6, 22, -112), door: P.museum.door },
  ivan: { pos: v(-25, 46, 4), look: v(-92, 32, 18), door: v(-84, 28, 18) },
  gum: { pos: v(-18, 14, -40), look: v(46, 12, -15), door: P.gum.door },
  minin: { pos: v(28, 9, 26), look: v(10, 6, 52), door: v(10, 4, 50) },
  top: { pos: v(10, 210, 70), look: v(-10, 0, 0) },
};
const ease = (t) => t * t * (3 - 2 * t);
const look = new THREE.Vector3();
function place(a, b, t, lift = 0) {
  const e = ease(Math.min(1, Math.max(0, t)));
  camera.position.lerpVectors(a.pos, b.pos, e);
  camera.position.y += Math.sin(Math.PI * e) * lift;
  look.lerpVectors(a.look, b.look, e);
  camera.lookAt(look);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 64 : 50;
  // На главной текст слева: сдвигаем кадр, чтобы здание стояло правее центра.
  if (body.dataset.scene === 'home' && w > 760) camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);

// ---------- режимы ----------
const mode = body.dataset.scene || 'page';
let activeScene = outside;
let update = () => {};

if (mode === 'home') {
  const slides = [...document.querySelectorAll('[data-shot]')];
  const shots = slides.map((s) => SHOTS[s.dataset.shot] || SHOTS.overview);
  let target = 0, pos = 0;
  const measure = () => {
    const tops = slides.map((s) => s.getBoundingClientRect().top + scrollY);
    const y = scrollY;
    let i = 0;
    while (i < tops.length - 1 && y >= tops[i + 1]) i++;
    const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1;
    const frac = Math.max(0, Math.min(1, (y - tops[i]) / span));
    // Пока экран на месте, камера смотрит на его здание; перелёт — во второй половине прокрутки.
    target = Math.min(slides.length - 1, i + Math.max(0, (frac - 0.4) / 0.6));
    const cur = Math.min(slides.length - 1, i + (frac > 0.6 ? 1 : 0));
    slides.forEach((s, j) => s.classList.toggle('active', cur === j));
    eras.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + slides[cur].id));
  };
  const eras = [...document.querySelectorAll('.era-line a')];
  root.classList.add('scene-ready');
  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', measure);
  measure(); pos = target;
  update = (dt) => {
    pos += (target - pos) * Math.min(1, dt * (reduced ? 20 : 3.2));
    const i = Math.min(shots.length - 2, Math.floor(pos)), t = pos - i;
    place(shots[i], shots[Math.min(shots.length - 1, i + 1)], t, 24);
    // «рывок» в середине перелёта, как приближение к зданию
    camera.fov += (((innerWidth < innerHeight) ? 64 : 50) - Math.sin(Math.PI * ease(t)) * 8 - camera.fov) * 0.2;
    camera.updateProjectionMatrix();
  };
  done();
} else {
  // внутренняя страница: подлёт к зданию раздела и вход внутрь
  const shot = SHOTS[body.dataset.sceneTarget] || SHOTS.basil;
  const accent = body.dataset.sceneAccent || '#8c2b24';
  const section = body.dataset.sceneTarget || '';
  let fly;
  let entered = false;
  let skip = reduced;
  try { skip = skip || sessionStorage.getItem('scene-section') === section; sessionStorage.setItem('scene-section', section); } catch (e) {}
  const enter = () => {
    entered = true;
    room = room || buildInterior(inside, accent);
    activeScene = inside;
    done();
  };
  const door = shot.door || shot.look;
  const near = { pos: door.clone().lerp(shot.pos, 0.06), look: door };
  if (skip) enter();
  const t0 = performance.now();
  update = (dt, time) => {
    if (!entered) {
      // по реальному времени: на медленном устройстве подлёт не затягивается
      fly = Math.min(1, (performance.now() - t0) / 2100);
      // разгон к двери: сначала плавно, потом всё быстрее
      const t = fly * fly;
      place(shot, near, t);
      if (flash) flash.style.opacity = String(Math.max(0, (fly - 0.75) / 0.25));
      if (fly >= 1) enter();
      return;
    }
    if (flash && +flash.style.opacity > 0) flash.style.opacity = String(Math.max(0, +flash.style.opacity - dt * 1.8));
    const sc = Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
    const a = -0.6 + sc * 1.4 + Math.sin(time * 0.07) * 0.08;
    // обход вокруг столпа: смотрим в соседний пролёт палаты
    camera.position.set(Math.cos(a) * 15, 4.2 + Math.sin(time * 0.2) * 0.15, Math.sin(a) * 15);
    camera.lookAt(-Math.cos(a + 0.9) * 9, 6.5, -Math.sin(a + 0.9) * 9);
    for (const f of room.userData.flames) f.scale.setScalar(0.85 + Math.random() * 0.3);
  };
}

// ---------- переход по ссылке: камера «ныряет» вперёд ----------
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || reduced || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = a.getAttribute('href');
  if (!/^[a-z0-9-]+\.html(#.*)?$/.test(href) || a.target === '_blank' || a.hasAttribute('download')) return;
  e.preventDefault();
  root.classList.add('scene-leaving');
  const start = performance.now(), from = camera.position.clone(), dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const step = (now) => {
    const t = Math.min(1, (now - start) / 420);
    camera.position.copy(from).addScaledVector(dir, t * t * 40);
    if (flash) flash.style.opacity = String(t);
    renderer.render(activeScene, camera);
    if (t < 1) requestAnimationFrame(step); else location.href = href;
  };
  paused = true;
  requestAnimationFrame(step);
});
// Возврат кнопкой «Назад» из кэша страницы: убираем затемнение.
addEventListener('pageshow', (e) => { if (e.persisted) { root.classList.remove('scene-leaving'); if (flash) flash.style.opacity = '0'; paused = false; loop(performance.now()); } });

// ---------- цикл ----------
let paused = false, last = performance.now();
const clock0 = last;
function loop(now) {
  if (paused || document.hidden) return;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  update(dt, (now - clock0) / 1000);
  if (activeScene === outside) {
    const p = snow.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 4;
      if (y < 0) y += 120;
      p.setY(i, y);
    }
    p.needsUpdate = true;
    snow.position.set(camera.position.x, camera.position.y - 60, camera.position.z);
  }
  renderer.render(activeScene, camera);
  requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !paused) { last = performance.now(); requestAnimationFrame(loop); } });
requestAnimationFrame(loop);
