// 3D-фон сайта: долина с историческими постройками. На главной камера при прокрутке летит
// от здания к зданию; на внутренних страницах подлетает к зданию раздела и входит внутрь.
// Рендер реалистичный (свет, тени, отражения), поверх — лёгкий живописный фильтр.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld } from './world.js';
import { buildInterior } from './interior.js';

const root = document.documentElement;
const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const flash = document.querySelector('.scene-flash');
const done = () => root.classList.remove('scene-intro');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isNight = () => (root.dataset.theme || (darkMQ.matches ? 'dark' : 'light')) === 'dark';

function fallback() {
  // Без WebGL — прежний фон из фотографий
  root.classList.add('scene-fallback');
  const p = './scene.js';
  import(p);
}

// Живописный фильтр Кувахары: мазки по однородным участкам, края остаются чёткими.
const Painterly = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, amount: { value: 0.85 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float amount, time; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 t = 2. / res;
      vec3 m0 = vec3(0.), m1 = vec3(0.), m2 = vec3(0.), m3 = vec3(0.), s0 = vec3(0.), s1 = vec3(0.), s2 = vec3(0.), s3 = vec3(0.);
      for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
        vec3 c = texture2D(tDiffuse, vUv + vec2(float(i), float(j)) * t).rgb;
        if (i <= 0 && j <= 0) { m0 += c; s0 += c * c; }
        if (i >= 0 && j <= 0) { m1 += c; s1 += c * c; }
        if (i <= 0 && j >= 0) { m2 += c; s2 += c * c; }
        if (i >= 0 && j >= 0) { m3 += c; s3 += c * c; }
      }
      m0 /= 9.; m1 /= 9.; m2 /= 9.; m3 /= 9.;
      float v0 = dot(s0 / 9. - m0 * m0, vec3(1.)), v1 = dot(s1 / 9. - m1 * m1, vec3(1.)), v2 = dot(s2 / 9. - m2 * m2, vec3(1.)), v3 = dot(s3 / 9. - m3 * m3, vec3(1.));
      vec3 paint = m0; float mv = v0;
      if (v1 < mv) { mv = v1; paint = m1; } if (v2 < mv) { mv = v2; paint = m2; } if (v3 < mv) { paint = m3; }
      vec3 c = mix(texture2D(tDiffuse, vUv).rgb, paint, amount);
      // тонкий «карандашный» контур по перепадам яркости — рисованный характер
      vec2 e = 1. / res;
      float lx = dot(texture2D(tDiffuse, vUv + vec2(e.x, 0.)).rgb - texture2D(tDiffuse, vUv - vec2(e.x, 0.)).rgb, vec3(.33));
      float ly = dot(texture2D(tDiffuse, vUv + vec2(0., e.y)).rgb - texture2D(tDiffuse, vUv - vec2(0., e.y)).rgb, vec3(.33));
      c *= 1. - clamp(length(vec2(lx, ly)) * 1.6, 0., .35);
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, 1.08);                                   // чуть насыщеннее
      c *= 1. - .32 * pow(distance(vUv, vec2(.5)) * 1.25, 2.2);      // виньетка
      c += (rnd(vUv * res + time) - .5) * .018;                     // зерно холста
      gl_FragColor = vec4(c, 1.);
    }`,
};

function start() {
  const canvas = document.createElement('canvas');
  canvas.className = 'scene-gl';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2');
  } catch (e) { fallback(); return; }
  const coarse = matchMedia('(pointer: coarse)').matches;
  const quality = innerWidth >= 900 && !coarse ? 2 : 1;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality > 1 ? 1.25 : 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  document.querySelector('.scenes').appendChild(canvas);

  const outside = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 9000);
  const W = buildWorld(renderer, outside, quality);
  const P = W.P;
  const inside = new THREE.Scene();
  let room = null;

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality > 1 ? 4 : 0 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(outside, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.6, 0.9);
  const paint = new ShaderPass(Painterly);
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(paint); composer.addPass(new OutputPass());

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    paint.uniforms.res.value.set(w * pr, h * pr);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 45;
    // На главной текст слева: здание чуть правее центра
    if (body.dataset.scene === 'home' && w > 760) camera.setViewOffset(w, h, -w * 0.18, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  function applyTheme() {
    const night = isNight();
    W.setNight(night);
    bloom.strength = night ? 0.85 : 0.18; bloom.threshold = night ? 0.6 : 0.9;
    renderer.toneMappingExposure = night ? 1.1 : 0.9;
  }
  applyTheme();
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    root.dataset.theme = isNight() ? 'light' : 'dark';
    try { localStorage.setItem('ska-theme', root.dataset.theme); } catch (e) {}
    applyTheme();
  });
  darkMQ.addEventListener?.('change', () => { if (!root.dataset.theme) applyTheme(); });

  // ---------- кадры ----------
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const SHOTS = {
    overview: { pos: v(250, 62, -170), look: v(20, 22, 70) },
    top: { pos: v(420, 520, 900), look: v(-160, 0, 280) },
  };
  for (const k of Object.keys(P)) SHOTS[k] = { ...P[k].shot, key: k };
  const look = new THREE.Vector3();
  const sway = { x: 0, y: 0, tx: 0, ty: 0 };
  function place(a, b, t) {
    const e = ease(clamp(t, 0, 1));
    camera.position.lerpVectors(a.pos, b.pos, e);
    camera.position.y += Math.sin(Math.PI * e) * Math.min(260, a.pos.distanceTo(b.pos) * 0.22); // перелёт над долиной
    look.lerpVectors(a.look, b.look, e);
    // лёгкое покачивание от мыши и наклона телефона
    camera.position.x += sway.x * 4; camera.position.y += sway.y * 2;
    camera.lookAt(look);
    W.focus(look, (e < 0.5 ? a : b).key);
  }
  addEventListener('pointermove', (e) => { sway.tx = (e.clientX / innerWidth) * 2 - 1; sway.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  addEventListener('deviceorientation', (e) => { if (e.gamma != null) { sway.tx = clamp(e.gamma / 25, -1, 1); sway.ty = clamp((e.beta - 45) / 25, -1, 1); } }, { passive: true });

  let update = () => {};
  let active = outside;
  if (body.dataset.scene === 'home') {
    const slides = [...document.querySelectorAll('[data-shot]')];
    const shots = slides.map((s) => SHOTS[s.dataset.shot] || SHOTS.overview);
    const dots = [...document.querySelectorAll('.era-line a')];
    let target = 0, pos = 0;
    const instant = /[?&]instant\b/.test(location.search); // для снимков экрана при проверке
    const measure = () => {
      const tops = slides.map((s) => s.offsetTop);
      const y = Math.min(scrollY, document.documentElement.scrollHeight - innerHeight);
      let i = 0;
      while (i < tops.length - 1 && y >= tops[i + 1]) i++;
      const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : 1;
      const frac = clamp((y - tops[i]) / span, 0, 1);
      target = Math.min(slides.length - 1, i + Math.max(0, (frac - 0.4) / 0.6));
      const cur = Math.min(slides.length - 1, i + (frac > 0.6 ? 1 : 0));
      slides.forEach((s, j) => s.classList.toggle('active', j === cur));
      dots.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + slides[cur].id));
      if (instant) pos = target;
    };
    addEventListener('scroll', measure, { passive: true });
    addEventListener('resize', measure);
    measure(); pos = target;
    root.classList.add('scene-ready');
    update = (dt) => {
      pos += (target - pos) * Math.min(1, dt * (reduced ? 30 : 2.4));
      const i = Math.min(shots.length - 2, Math.floor(pos));
      place(shots[i], shots[i + 1], pos - i);
    };
    done();
  } else {
    // подлёт к зданию раздела и вход внутрь
    const key = body.dataset.sceneTarget;
    const shot = SHOTS[key] || SHOTS.overview;
    const door = P[key] ? P[key].door : shot.look;
    const near = { pos: door.clone().lerp(shot.pos, 0.04), look: door.clone(), key };
    let skip = reduced;
    try { skip = skip || sessionStorage.getItem('scene-section') === key; sessionStorage.setItem('scene-section', key); } catch (e) {}
    let entered = false, t0 = 0;
    const enter = () => {
      entered = true;
      room = room || buildInterior(inside, body.dataset.sceneInterior, body.dataset.sceneAccent || '#8c2b24');
      active = inside; renderPass.scene = inside;
      bloom.strength = 0.5; bloom.threshold = 0.75;
      done();
    };
    if (skip) enter();
    update = (dt, time) => {
      if (!entered) {
        if (!t0) t0 = performance.now();
        const t = clamp((performance.now() - t0) / 2300, 0, 1);
        place(shot, near, t * t);
        if (flash) flash.style.opacity = String(Math.max(0, (t - 0.78) / 0.22));
        if (t >= 1) enter();
        return;
      }
      if (flash && +flash.style.opacity > 0) flash.style.opacity = String(Math.max(0, +flash.style.opacity - dt * 1.6));
      const o = room.orbit;
      const sc = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), 0, 1);
      const a = -0.6 + sc * 1.4 + Math.sin(time * 0.07) * 0.08 + sway.x * 0.05;
      camera.position.set(Math.cos(a) * o.r, o.y + Math.sin(time * 0.2) * 0.12, Math.sin(a) * o.r);
      camera.lookAt(-Math.cos(a + 0.9) * 9, o.look + sway.y * 0.3, -Math.sin(a + 0.9) * 9);
      for (const f of room.flames) f.scale.set(1, 1.6 + Math.random() * 0.8, 1);
    };
  }

  // переход по ссылке: камера «ныряет» вперёд
  let diving = null;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || reduced || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if (!/^[a-z0-9-]+\.html(#.*)?$/.test(href) || a.target === '_blank' || a.hasAttribute('download')) return;
    e.preventDefault();
    root.classList.add('scene-leaving');
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    diving = { t0: performance.now(), from: camera.position.clone(), dir, href };
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { root.classList.remove('scene-leaving'); diving = null; if (flash) flash.style.opacity = '0'; } });

  let last = performance.now(), first = true;
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const time = now / 1000;
    sway.x += (sway.tx - sway.x) * 0.04; sway.y += (sway.ty - sway.y) * 0.04;
    if (diving) {
      const t = Math.min(1, (now - diving.t0) / 450);
      camera.position.copy(diving.from).addScaledVector(diving.dir, t * t * (active === inside ? 8 : 60));
      if (flash) flash.style.opacity = String(t);
      if (t >= 1) { location.href = diving.href; diving.t0 = Infinity; }
    } else update(dt, time);
    W.tick(time);
    paint.uniforms.time.value = time % 100;
    composer.render(dt);
    if (first) { first = false; root.classList.add('scene-3d'); }
  }
  requestAnimationFrame(loop);
}

try { start(); } catch (e) { console.error(e); fallback(); }
