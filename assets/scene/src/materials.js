// Процедурные PBR-материалы: цвет, рельеф (normal map) и шероховатость рисуются в canvas,
// поэтому сайту не нужны внешние текстуры.
import * as THREE from 'three';

// ---------- шум ----------
let seed = 1;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const perm = Array.from({ length: 512 }, (_, i) => i % 256).map(() => Math.floor(rnd() * 256));
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y) {
  const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y);
  const h = (a, b) => perm[(perm[a & 255] + b) & 255] / 255;
  const u = fade(xf), v = fade(yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2; }
  return s;
}

// ---------- сборка текстур ----------
// paint(ctx, w, h) рисует цвет; height(x, y) -> 0..1 рельеф (выше — ближе к зрителю).
function texture(canvas, srgb, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
function heightCanvas(size, height) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = height(x / size, y / size);
  return { H, img, g, c };
}
function normalFrom(H, size, strength) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
// color(u, v, h) -> [r, g, b] 0..255; rough(u, v, h) -> 0..1
export function pbr({ size = 512, height, color, rough, strength = 6, repeat, ...opts }) {
  const { H } = heightCanvas(size, height || (() => 0.5));
  const cc = document.createElement('canvas'); cc.width = cc.height = size;
  const cg = cc.getContext('2d'), ci = cg.createImageData(size, size);
  const rc = document.createElement('canvas'); rc.width = rc.height = size;
  const rg = rc.getContext('2d'), ri = rg.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, h = H[y * size + x], i = (y * size + x) * 4;
    const [r, gg, b] = color(u, v, h);
    ci.data[i] = r; ci.data[i + 1] = gg; ci.data[i + 2] = b; ci.data[i + 3] = 255;
    const ro = Math.round((rough ? rough(u, v, h) : 0.85) * 255);
    ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = ro; ri.data[i + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); rg.putImageData(ri, 0, 0);
  return new THREE.MeshStandardMaterial({
    map: texture(cc, true, repeat), normalMap: texture(normalFrom(H, size, strength), false, repeat),
    roughnessMap: texture(rc, false, repeat), roughness: 1, ...opts,
  });
}
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const tint = (c, k) => c.map((x) => Math.max(0, Math.min(255, x * k)));

// ---------- материалы ----------
export function makeMaterials() {
  const M = {};
  // Красный кирпич со швами (Кремль, Новгородский детинец)
  M.brick = pbr({
    height: (u, v) => { const row = Math.floor(v * 16), bx = (u * 8 + (row % 2) * 0.5) % 1, by = (v * 16) % 1; return (bx < 0.06 || by < 0.12) ? 0.15 : 0.6 + fbm(u * 40, v * 40) * 0.2; },
    color: (u, v, h) => h < 0.3 ? [150, 135, 120] : tint([150, 48, 36], 0.8 + fbm(u * 8 + Math.floor(v * 16), v * 3) * 0.45),
    rough: (u, v, h) => h < 0.3 ? 0.95 : 0.8, strength: 4,
  });
  // Белый камень: крупные блоки, лёгкая патина (Нерль, София, Покровский собор)
  M.stone = pbr({
    height: (u, v) => { const row = Math.floor(v * 6), bx = (u * 3 + (row % 2) * 0.5) % 1, by = (v * 6) % 1; return (bx < 0.015 || by < 0.03) ? 0.2 : 0.55 + fbm(u * 30, v * 30) * 0.25; },
    color: (u, v, h) => tint(mix([236, 229, 214], [196, 186, 168], fbm(u * 6, v * 6) * 0.8), h < 0.3 ? 0.85 : 1),
    rough: () => 0.88, strength: 3,
  });
  // Побелка (стены Софии и Покровского собора)
  M.plaster = pbr({ height: (u, v) => fbm(u * 24, v * 24), color: (u, v) => tint([238, 233, 222], 0.93 + fbm(u * 5, v * 5) * 0.1), rough: () => 0.92, strength: 1.5 });
  // Классическая охра и белые колонны (Моховая)
  M.ochre = pbr({ height: (u, v) => fbm(u * 30, v * 30), color: (u, v) => tint([228, 186, 98], 0.92 + fbm(u * 6, v * 6) * 0.12), rough: () => 0.9, strength: 1.2 });
  M.white = pbr({ height: (u, v) => fbm(u * 20, v * 20), color: (u, v) => tint([244, 240, 230], 0.95 + fbm(u * 4, v * 4) * 0.06), rough: () => 0.85, strength: 1 });
  // Брёвна: серое выветренное дерево (Кижи)
  M.logs = pbr({
    height: (u, v) => { const f = (v * 10) % 1; return Math.sqrt(Math.max(0, 1 - (f * 2 - 1) ** 2)) * 0.8 + fbm(u * 60, v * 4) * 0.2; },
    color: (u, v, h) => tint(mix([92, 74, 58], [134, 116, 94], fbm(u * 30, v * 3)), 0.55 + h * 0.55),
    rough: () => 0.95, strength: 8,
  });
  // Осиновый лемех: серебристая чешуя глав Кижей
  M.shingle = pbr({
    height: (u, v) => { const r = Math.floor(v * 14), x = (u * 18 + (r % 2) * 0.5) % 1, y = (v * 14) % 1; return Math.max(0, 1 - Math.hypot(x - 0.5, y * 0.9) * 1.6) * 0.8 + fbm(u * 80, v * 20) * 0.2; },
    color: (u, v, h) => tint(mix([150, 146, 138], [190, 186, 176], fbm(u * 12, v * 12)), 0.65 + h * 0.5),
    rough: () => 0.88, strength: 6,
  });
  // Позолота: зеркальная, с еле заметной чеканкой
  M.gold = pbr({ size: 256, height: (u, v) => fbm(u * 40, v * 40), color: (u, v) => tint([255, 196, 92], 0.92 + fbm(u * 10, v * 10) * 0.12), rough: (u, v) => 0.18 + fbm(u * 20, v * 20) * 0.12, metalness: 1, strength: 0.6 });
  // Свинцовое покрытие глав (Нерль, боковые главы Софии)
  M.lead = pbr({ size: 256, height: (u, v) => (v * 12) % 1 < 0.08 ? 0.2 : 0.6, color: (u, v) => tint([128, 134, 140], 0.9 + fbm(u * 8, v * 8) * 0.2), rough: () => 0.42, metalness: 0.8, strength: 2 });
  // Зелёная черепица шатров Спасской башни
  M.tile = pbr({
    height: (u, v) => { const r = Math.floor(v * 24), x = (u * 20 + (r % 2) * 0.5) % 1, y = (v * 24) % 1; return 0.4 + (1 - y) * 0.5 - (x < 0.05 ? 0.3 : 0); },
    color: (u, v) => (u * 8) % 1 < 0.06 ? [236, 232, 220] : tint([46, 108, 84], 0.85 + fbm(u * 14, v * 14) * 0.3),
    rough: () => 0.35, strength: 4,
  });
  // Луковичные главы Покровского собора: спирали, ромбы, полосы
  const spiral = (a, b, n, tw) => pbr({
    height: (u, v) => 0.5 + 0.5 * Math.sin(((u + v * tw) * n) * Math.PI * 2),
    color: (u, v, h) => h > 0.5 ? a : b, rough: () => 0.4, strength: 5,
  });
  const diamonds = (a, b, n) => pbr({
    height: (u, v) => 1 - (Math.abs(((u * n) % 1) - 0.5) + Math.abs(((v * n * 0.5) % 1) - 0.5)),
    color: (u, v, h) => h > 0.55 ? a : b, rough: () => 0.4, strength: 5,
  });
  M.domes = [
    spiral([200, 54, 44], [46, 134, 90], 8, 1),
    diamonds([232, 186, 76], [46, 134, 90], 8),
    spiral([44, 96, 168], [240, 236, 226], 10, -1),
    spiral([46, 134, 90], [234, 196, 86], 8, 1),
    diamonds([216, 100, 42], [46, 134, 90], 7),
    pbr({ height: (u, v) => { const r = Math.floor(v * 12), x = (u * 12 + (r % 2) * 0.5) % 1, y = (v * 12) % 1; return Math.max(0, 1 - Math.hypot(x - 0.5, y)); }, color: (u, v, h) => tint([226, 170, 70], 0.6 + h * 0.6), rough: () => 0.3, metalness: 0.7, strength: 5 }),
    spiral([46, 134, 90], [200, 54, 44], 8, -1),
    diamonds([58, 112, 176], [240, 236, 226], 8),
  ];
  // Шатёр Покровского собора: белые ромбы по красному
  M.tent = diamonds([240, 234, 220], [170, 52, 40], 10);
  M.green = pbr({ size: 256, height: (u, v) => fbm(u * 20, v * 20), color: (u, v) => tint([52, 112, 80], 0.9 + fbm(u * 6, v * 6) * 0.2), rough: () => 0.5, strength: 1 });
  M.roofRed = pbr({ size: 256, height: (u, v) => (u * 16) % 1 < 0.1 ? 0.2 : 0.6, color: () => [120, 40, 34], rough: () => 0.55, metalness: 0.3, strength: 2 });
  M.roofGrey = pbr({ size: 256, height: (u, v) => (u * 16) % 1 < 0.1 ? 0.2 : 0.6, color: (u, v) => tint([96, 104, 110], 0.9 + fbm(u * 6, v * 6) * 0.2), rough: () => 0.5, metalness: 0.5, strength: 2 });
  M.cobble = pbr({
    height: (u, v) => { const s = 24, r = Math.floor(v * s), x = (u * s + (r % 2) * 0.5) % 1, y = (v * s) % 1; return Math.max(0, 1 - Math.hypot(x - 0.5, y - 0.5) * 1.9); },
    color: (u, v, h) => tint(mix([128, 122, 112], [168, 160, 148], fbm(u * 50, v * 50)), 0.55 + h * 0.55), rough: () => 0.85, strength: 6, repeat: [24, 30],
  });
  M.grass = pbr({
    height: (u, v) => fbm(u * 60, v * 60, 3), strength: 3, repeat: [120, 120],
    color: (u, v, h) => mix([200, 210, 170], [235, 230, 190], fbm(u * 8, v * 8)).map((x) => x * (0.7 + h * 0.45)),
    rough: () => 0.95,
  });
  M.dark = new THREE.MeshStandardMaterial({ color: '#1a1714', roughness: 0.6 });
  M.glass = new THREE.MeshStandardMaterial({ color: '#141a24', roughness: 0.15, metalness: 0.6 });
  M.clock = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#7d2a20'; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#1d2a44'; g.beginPath(); g.arc(256, 256, 220, 0, 7); g.fill();
    g.lineWidth = 16; g.strokeStyle = '#e6be62'; g.stroke();
    g.fillStyle = '#e6be62'; g.font = 'bold 44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((t, i) => { const a = i / 12 * Math.PI * 2 - Math.PI / 2; g.fillText(t, 256 + Math.cos(a) * 172, 256 + Math.sin(a) * 172); });
    g.lineCap = 'round'; g.lineWidth = 14; g.beginPath(); g.moveTo(256, 256); g.lineTo(256, 120); g.moveTo(256, 256); g.lineTo(350, 290); g.stroke();
    const t = texture(c, true);
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.4, metalness: 0.2 });
  })();
  M.ruby = new THREE.MeshStandardMaterial({ color: '#b0101e', emissive: '#ff1830', emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.3 });
  // Окна: ночью светятся
  M.window = new THREE.MeshStandardMaterial({ color: '#20242c', roughness: 0.2, metalness: 0.4, emissive: '#ffcf8a', emissiveIntensity: 0 });
  return M;
}
