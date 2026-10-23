// Красная площадь в 3D: стилизованные, но узнаваемые постройки. Ось x — на восток (к ГУМу),
// z — на юг (к Покровскому собору), y — вверх. Единица ≈ 2 м.
import * as THREE from '../vendor/three.module.min.js';

// ---------- текстуры (рисуются в canvas, без внешних файлов) ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

function brick(base = '#8e2b20', mortar = '#5a1810') {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = mortar; g.fillRect(0, y, w, 1);
      for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) g.fillRect(x, y, 1, 8);
      for (let x = 0; x < w; x += 16) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.18})`; g.fillRect(x + ((y / 8) % 2 ? 1 : 9), y + 1, 15, 7); }
    }
  }, [1, 1]);
}
// Полосы по спирали для луковичных глав
function stripes(a, b, n = 8, twist = 1) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    const step = w / n;
    for (let i = -n; i < n * 2; i++) {
      g.beginPath();
      g.moveTo(i * step, h); g.lineTo(i * step + step / 2, h);
      g.lineTo(i * step + step / 2 + twist * w * 0.5, 0); g.lineTo(i * step + twist * w * 0.5, 0);
      g.fill();
    }
  });
}
function zigzag(a, b, rows = 7, n = 8) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    const rh = h / rows, cw = w / n;
    for (let r = 0; r < rows; r += 2) {
      g.beginPath(); g.moveTo(0, r * rh + rh);
      for (let i = 0; i <= n; i++) { g.lineTo(i * cw + cw / 2, r * rh); g.lineTo((i + 1) * cw, r * rh + rh); }
      g.lineTo(w, r * rh + rh * 1.6); g.lineTo(0, r * rh + rh * 1.6); g.fill();
    }
  });
}
function scales(a, b) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = b; g.fillRect(0, 0, w, h);
    const s = 32;
    for (let y = 0; y < h + s; y += s / 2) for (let x = (y / (s / 2)) % 2 ? s / 2 : 0; x < w + s; x += s) {
      g.fillStyle = a; g.beginPath(); g.arc(x, y, s / 2 - 2, 0, Math.PI); g.fill();
    }
  });
}
function windows({ wall, frame, rows, cols, lit = 0.6, arch = true }) {
  const map = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.28, y = r * rh + rh * 0.25, ww = cw * 0.44, wh = rh * 0.55;
      g.fillStyle = frame; g.fillRect(x - 2, y - 2, ww + 4, wh + 4);
      g.fillStyle = '#2a2a35'; g.fillRect(x, y, ww, wh);
      if (arch) { g.beginPath(); g.arc(x + ww / 2, y, ww / 2, Math.PI, 0); g.fill(); }
    }
  });
  const emissive = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rnd() > lit) continue;
      const x = c * cw + cw * 0.28, y = r * rh + rh * 0.25, ww = cw * 0.44, wh = rh * 0.55;
      g.fillStyle = rnd() > 0.3 ? '#ffcf85' : '#ffe6b8'; g.fillRect(x, y, ww, wh);
      if (arch) { g.beginPath(); g.arc(x + ww / 2, y, ww / 2, Math.PI, 0); g.fill(); }
    }
  });
  return { map, emissive };
}
function clockFace() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#8e2b20'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#1d2433'; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.fill();
    g.strokeStyle = '#e7c36a'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#e7c36a';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88, 7, 0, 7); g.fill(); }
    g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 58); g.moveTo(128, 128); g.lineTo(178, 140); g.stroke();
  });
}
function cobbles() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3a40'; g.fillRect(0, 0, w, h);
    const s = 16;
    for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? s / 2 : 0; x < w + s; x += s) {
      const v = 70 + Math.floor(rnd() * 40);
      g.fillStyle = `rgb(${v},${v},${v + 6})`;
      g.beginPath(); g.ellipse(x, y + s / 2, s / 2 - 1.5, s / 2 - 1.5, 0, 0, 7); g.fill();
    }
  }, [60, 60]);
}

// ---------- материалы ----------
const M = {};
function mats() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  // Подсветка как у Кремля ночью: тёплое собственное свечение стен.
  M.brick = std({ map: brick(), emissive: '#3a0d06', emissiveIntensity: 0.9 });
  M.brickDark = std({ map: brick('#6e2018', '#4a120c') });
  M.white = std({ color: '#f1e9d8', emissive: '#6a573a', emissiveIntensity: 0.75 });
  M.cream = std({ color: '#e3d3a8', emissive: '#3a2c18', emissiveIntensity: 0.5 });
  M.roof = std({ color: '#151925', roughness: 0.7 });
  M.granite = std({ color: '#3b1715', roughness: 0.5 });
  M.black = std({ color: '#141418', roughness: 0.4 });
  M.gold = std({ color: '#e8b54a', metalness: 0.45, roughness: 0.35, emissive: '#9a6410', emissiveIntensity: 0.9 });
  M.silver = std({ color: '#d4d8e2', metalness: 0.4, roughness: 0.35, emissive: '#3a4050', emissiveIntensity: 0.8 });
  M.green = std({ color: '#2f6b4f' });
  M.tentGreen = std({ map: zigzag('#2f6b4f', '#e8e2d2', 9, 8) });
  M.star = std({ color: '#c0182a', emissive: '#ff1f3a', emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.3 });
  M.bronze = std({ color: '#3c4a3a', metalness: 0.7, roughness: 0.45 });
  M.ground = std({ map: cobbles(), roughness: 0.95 });
  M.earth = std({ color: '#1b1d24', roughness: 1 });
  M.water = std({ color: '#0f1a2c', metalness: 0.6, roughness: 0.15 });
  M.clock = std({ map: clockFace(), emissive: '#ffffff', emissiveMap: clockFace(), emissiveIntensity: 0.25 });
  M.domes = [
    std({ map: stripes('#c3352b', '#2f8a5a', 8, 1) }),
    std({ map: zigzag('#e0b84a', '#2f8a5a', 7, 8) }),
    std({ map: stripes('#2f5fa8', '#f0ece2', 10, -1) }),
    std({ map: stripes('#2f8a5a', '#e9c75a', 8, 1) }),
    std({ map: zigzag('#d8642a', '#2f8a5a', 7, 8) }),
    std({ map: scales('#e0b04a', '#8a5a17'), metalness: 0.6, roughness: 0.35 }),
    std({ map: stripes('#2f8a5a', '#c3352b', 8, -1) }),
    std({ map: zigzag('#3a6fb0', '#e9e2cf', 7, 8) }),
  ];
  M.tentBasil = std({ map: zigzag('#f0ead8', '#b33a2c', 12, 10) });
}

// ---------- примитивы ----------
const world = new THREE.Group();
function add(geo, mat, x, y, z, parent = world) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
// Блок, стоящий на y
const box = (w, h, d, mat, x, y, z, p) => add(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, p);
const drum = (r, h, mat, x, y, z, sides = 8, p) => add(new THREE.CylinderGeometry(r, r, h, sides), mat, x, y + h / 2, z, p);
const tent = (r, h, mat, x, y, z, sides = 8, p) => add(new THREE.ConeGeometry(r, h, sides), mat, x, y + h / 2, z, p);
function onion(r, h, mat, x, y, z, p) {
  const pts = [];
  const prof = [[0.72, 0], [0.95, 0.16], [1, 0.32], [0.86, 0.5], [0.55, 0.68], [0.25, 0.82], [0.08, 0.93], [0.02, 1]];
  const curve = new THREE.SplineCurve(prof.map(([a, b]) => new THREE.Vector2(a * r, b * h)));
  for (const v of curve.getPoints(24)) pts.push(v);
  pts.unshift(new THREE.Vector2(0, 0));
  const m = add(new THREE.LatheGeometry(pts, 24), mat, x, y, z, p);
  add(new THREE.CylinderGeometry(r * 0.06, r * 0.06, h * 0.35, 6), M.gold, x, y + h * 1.12, z, p);
  add(new THREE.BoxGeometry(r * 0.45, r * 0.06, r * 0.06), M.gold, x, y + h * 1.2, z, p);
  return m;
}
function star(size, x, y, z, rotY = 0) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? size * 0.42 : size;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const m = add(new THREE.ExtrudeGeometry(s, { depth: size * 0.3, bevelEnabled: true, bevelSize: size * 0.06, bevelThickness: size * 0.08, bevelSegments: 1 }), M.star, x, y, z);
  m.rotation.y = rotY;
  m.geometry.center();
  world.userData.stars.push(m);
  return m;
}

// ---------- постройки ----------
// Кремлёвская стена с зубцами «ласточкин хвост»: от (x, z1) до (x, z2) или вдоль z.
function wall(a, b, h = 9, t = 4) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  const seg = add(new THREE.BoxGeometry(t, h, len), M.brick, (a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2);
  seg.rotation.y = ang;
  seg.material = M.brick.clone(); seg.material.map = M.brick.map.clone(); seg.material.map.repeat.set(len / 12, h / 12); seg.material.map.needsUpdate = true;
  const n = Math.floor(len / 2.4);
  const shape = new THREE.Shape();
  shape.moveTo(-0.8, 0); shape.lineTo(0.8, 0); shape.lineTo(0.8, 2.4); shape.lineTo(0, 1.5); shape.lineTo(-0.8, 2.4); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
  geo.translate(0, 0, -0.6);
  const inst = new THREE.InstancedMesh(geo, M.brick, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang + Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    m4.compose(new THREE.Vector3(a[0] + dx * f + Math.cos(ang) * (t / 2 - 0.6), h, a[1] + dz * f - Math.sin(ang) * (t / 2 - 0.6)), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, m4);
  }
  world.add(inst);
}

function kremlinTower(x, z, { w = 9, h = 18, tentH = 14, tiers = 1, starY = true, green = true }) {
  box(w, h, w, M.brick, x, 0, z);
  box(w + 0.6, 0.8, w + 0.6, M.white, x, h, z);
  let y = h + 0.8, ww = w * 0.78;
  for (let i = 0; i < tiers; i++) {
    box(ww, 5, ww, M.brick, x, y, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tent(0.6, 3, M.white, x + sx * ww / 2, y + 5, z + sz * ww / 2, 6);
    y += 5; ww *= 0.8;
  }
  drum(ww / 2, 3, M.brick, x, y, z, 8);
  tent(ww / 2 + 0.4, tentH, green ? M.tentGreen : M.brickDark, x, y + 3, z, 8);
  if (starY) star(1.8, x, y + 3 + tentH + 2.2, z, Math.PI / 2);
  return y + 3 + tentH;
}

function spasskaya(x, z) {
  box(15, 17, 15, M.brick, x, 0, z);
  box(15.6, 1, 15.6, M.white, x, 17, z);
  box(12, 8, 12, M.brick, x, 18, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { drum(0.7, 2, M.white, x + sx * 6, 26, z + sz * 6, 8); tent(0.8, 4, M.white, x + sx * 6, 28, z + sz * 6, 8); }
  box(10, 10, 10, M.brick, x, 26, z);
  for (const [rx, rz, ry] of [[5.02, 0, Math.PI / 2], [-5.02, 0, -Math.PI / 2], [0, 5.02, 0], [0, -5.02, Math.PI]]) {
    const c = add(new THREE.PlaneGeometry(8, 8), M.clock, x + rx, 31, z + rz);
    c.rotation.y = ry;
  }
  box(10.6, 0.8, 10.6, M.white, x, 36, z);
  drum(4, 7, M.brick, x, 36.8, z, 8);
  drum(4.3, 0.8, M.white, x, 43.8, z, 8);
  tent(4.4, 18, M.tentGreen, x, 44.6, z, 8);
  add(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), M.gold, x, 64, z);
  star(2.6, x, 67.4, z, Math.PI / 2);
  // ворота
  const g = add(new THREE.PlaneGeometry(5, 9), M.black, x + 7.55, 4.5, z); g.rotation.y = Math.PI / 2;
  return { x, z, top: 68, door: new THREE.Vector3(x + 8, 4, z) };
}

function basil(cx, cz) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); world.add(g);
  box(34, 6, 34, M.brick, 0, 0, 0, g);
  box(35, 0.7, 35, M.white, 0, 6, 0, g);
  // центральный шатёр
  drum(5, 14, M.brick, 0, 6.7, 0, 8, g);
  drum(5.4, 1, M.white, 0, 20.7, 0, 8, g);
  tent(5.5, 18, M.tentBasil, 0, 21.7, 0, 8, g);
  drum(1, 2, M.gold, 0, 39.5, 0, 8, g);
  onion(1.6, 3, M.gold, 0, 41.5, 0, g);
  // большие приделы по сторонам света и малые по диагоналям
  const big = [[0, 11], [11, 0], [0, -11], [-11, 0]], small = [[8.5, 8.5], [-8.5, 8.5], [8.5, -8.5], [-8.5, -8.5]];
  big.forEach(([x, z], i) => {
    drum(3.6, 11, M.brick, x, 6.7, z, 8, g);
    drum(3.9, 0.8, M.white, x, 17.7, z, 8, g);
    drum(2.6, 3, M.brick, x, 18.5, z, 12, g);
    onion(3.6, 6.5, M.domes[i], x, 21.5, z, g);
  });
  small.forEach(([x, z], i) => {
    drum(2.4, 8, M.brick, x, 6.7, z, 8, g);
    drum(2.6, 0.6, M.white, x, 14.7, z, 8, g);
    drum(1.7, 2, M.brick, x, 15.3, z, 12, g);
    onion(2.5, 4.6, M.domes[4 + i], x, 17.3, z, g);
  });
  // колокольня
  box(5, 12, 5, M.brick, 19, 0, 10, g);
  drum(2.6, 5, M.white, 19, 12, 10, 8, g);
  tent(2.9, 8, M.tentGreen, 19, 17, 10, 8, g);
  onion(1.2, 2.2, M.gold, 19, 25, 10, g);
  // крыльцо
  box(6, 5, 4, M.brick, -12, 0, -17.5, g);
  tent(3.5, 4, M.tentGreen, -12, 5, -17.5, 4, g).rotation.y = Math.PI / 4;
  return { x: cx, z: cz, top: 45, door: new THREE.Vector3(cx - 12, 3, cz - 20) };
}

function historicalMuseum(cx, cz) {
  const front = cz + 9;
  box(44, 17, 18, M.brick, cx, 0, cz);
  box(45, 1, 19, M.white, cx, 17, cz);
  box(44, 4, 18, M.brickDark, cx, 18, cz);
  for (const x of [-8, 8]) { // две главные башни
    box(7, 10, 7, M.brick, cx + x, 18, front - 2);
    tent(4.6, 16, M.tentGreen, cx + x, 28, front - 2, 8);
    add(new THREE.SphereGeometry(0.8, 10, 8), M.gold, cx + x, 45, front - 2);
  }
  for (const x of [-20, 20]) { box(6, 6, 6, M.brick, cx + x, 18, front - 3); tent(3.6, 10, M.tentGreen, cx + x, 24, front - 3, 8); }
  for (let x = -18; x <= 18; x += 4) tent(0.7, 4, M.white, cx + x, 22, front - 0.5, 6);
  add(new THREE.PlaneGeometry(6, 9), M.black, cx, 4.5, front + 0.05);
  return { x: cx, z: cz, top: 46, door: new THREE.Vector3(cx, 4, front + 1) };
}

function gum(x0, x1, z0, z1) {
  const w = x1 - x0, d = z1 - z0, h = 15, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const f = windows({ wall: '#e8dcc0', frame: '#b9a37a', rows: 3, cols: 24, lit: 0.75 });
  f.map.wrapS = f.emissive.wrapS = THREE.RepeatWrapping; f.map.repeat.x = f.emissive.repeat.x = 4;
  const facade = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.9 });
  // Фасад смотрит на запад, к площади: грань -x — второй материал куба.
  add(new THREE.BoxGeometry(w, h, d), [M.cream, facade, M.roof, M.cream, M.cream, M.cream], cx, h / 2, cz);
  box(w + 1, 1, d + 1, M.white, cx, h, cz);
  for (const z of [z0 + d * 0.2, cz, z1 - d * 0.2]) {
    box(6, 8, 8, M.cream, x0 + 3, h, z);
    tent(4.2, 6, M.green, x0 + 3, h + 8, z, 4).rotation.y = Math.PI / 4;
  }
  // гирлянды по контуру — знаменитая подсветка ГУМа
  const pts = [];
  for (let z = z0; z <= z1; z += 1.2) pts.push(x0 - 0.6, h + 1.1, z, x0 - 0.6, h * 0.66, z);
  for (let y = 0.5; y < h; y += 1.2) for (const z of [z0, z1]) pts.push(x0 - 0.6, y, z);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  world.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffdf9e', size: 0.55, sizeAttenuation: true })));
  return { x: x0, z: cz, top: h + 14, door: new THREE.Vector3(x0 - 1, 4, cz) };
}

function mausoleum(x, z) {
  box(12, 3.5, 22, M.granite, x, 0, z);
  box(9, 0.6, 18, M.black, x, 3.5, z);
  box(8, 2.6, 16, M.granite, x, 4.1, z);
  box(6, 2, 12, M.granite, x, 6.7, z);
  for (let i = -4; i <= 4; i += 2) drum(0.25, 1.8, M.granite, x, 8.7, z + i, 6);
  box(6.4, 0.6, 12.4, M.granite, x, 10.5, z);
}

function ivanBellTower(x, z) {
  let y = 0;
  [[6.4, 15], [5.4, 12], [4.6, 10], [3.8, 8]].forEach(([r, h]) => {
    drum(r, h, M.white, x, y, z, 8); y += h;
    drum(r + 0.4, 0.8, M.cream, x, y, z, 8); y += 0.8;
  });
  drum(2.6, 5, M.white, x, y, z, 16);
  onion(3.2, 6.5, M.gold, x, y + 5, z);
  return { x, z, top: y + 13, door: new THREE.Vector3(x + 7, 4, z) };
}

function cathedral(x, z, w, d, h, domeMat, five = true) {
  box(w, h, d, M.white, x, 0, z);
  for (let i = -1; i <= 1; i++) { const a = add(new THREE.CylinderGeometry(w / 6, w / 6, d + 0.2, 16, 1, false, 0, Math.PI), M.white, x + i * w / 3, h, z); a.rotation.set(Math.PI / 2, 0, Math.PI / 2); }
  const spots = five ? [[0, 0, 1], [-1, -1, 0.7], [1, -1, 0.7], [-1, 1, 0.7], [1, 1, 0.7]] : [[0, 0, 1]];
  for (const [sx, sz, k] of spots) {
    const r = w * 0.13 * k, px = x + sx * w * 0.28, pz = z + sz * d * 0.28;
    drum(r, h * 0.35 * k, M.white, px, h + 1.5, pz, 16);
    onion(r * 1.25, r * 2.5, domeMat, px, h + 1.5 + h * 0.35 * k, pz);
  }
}

function msu(x, z) {
  const s = 1.2;
  const tower = [[30, 40, 24], [24, 20, 20], [18, 16, 16], [14, 14, 12], [10, 10, 9]];
  let y = 0;
  const f = windows({ wall: '#d9cdb4', frame: '#a99673', rows: 8, cols: 12, lit: 0.35, arch: false });
  f.map.wrapS = f.map.wrapT = f.emissive.wrapS = f.emissive.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.9 });
  for (const [w, h, d] of tower) { box(w * s, h * s, d * s, mat, x, y, z); y += h * s; box(w * s + 1, 1, d * s + 1, M.cream, x, y, z); y += 1; }
  for (const sx of [-1, 1]) { // крылья с башенками
    box(60 * s, 24 * s, 16 * s, mat, x + sx * 45 * s, 0, z);
    box(12 * s, 30 * s, 12 * s, mat, x + sx * 80 * s, 0, z);
    tent(3 * s, 14 * s, M.gold, x + sx * 80 * s, 30 * s, z, 8);
  }
  drum(3.5 * s, 8 * s, M.cream, x, y, z, 8);
  tent(3.6 * s, 34 * s, M.gold, x, y + 8 * s, z, 8);
  star(5, x, y + 45 * s, z, Math.PI / 4);
  return { x, z, top: y + 45 * s, door: new THREE.Vector3(x + 20, 8, z + 20) };
}

function city() {
  // Огни города вокруг: невысокие дома с горящими окнами
  const f = windows({ wall: '#2b2c36', frame: '#2b2c36', rows: 6, cols: 6, lit: 0.45, arch: false });
  const mat = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: '#ffffff', emissiveIntensity: 0.7, roughness: 1 });
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const n = 420, inst = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = 280 + rnd() * 380;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x < -150 && x > -420 && z > 450 && z < 720) continue; // место для МГУ
    m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 3, 0)), new THREE.Vector3(12 + rnd() * 16, 6 + rnd() * 16, 12 + rnd() * 16));
    inst.setMatrixAt(i, m4);
  }
  world.add(inst);
}

function sky() {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#070b1f') }, mid: { value: new THREE.Color('#2a2350') }, low: { value: new THREE.Color('#e48a4f') } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 p;
      float h(vec2 v){ return fract(sin(dot(v, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){ float y = p.y; vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.6, y));
        vec2 g = floor(p.xz / max(p.y, .05) * 140.); float s = step(.997, h(g)) * smoothstep(.15, .5, y);
        gl_FragColor = vec4(c + s * .8, 1.); }`,
  });
  world.add(new THREE.Mesh(geo, mat));
}

// ---------- сборка ----------
export function buildWorld(scene) {
  world.userData.stars = [];
  mats();
  sky();
  add(new THREE.PlaneGeometry(2000, 2000), M.earth, 0, -0.05, 0).rotation.x = -Math.PI / 2;
  add(new THREE.PlaneGeometry(130, 230), M.ground, 0, 0, 0).rotation.x = -Math.PI / 2;
  const river = add(new THREE.PlaneGeometry(1400, 60), M.water, 0, -0.02, 150); river.rotation.x = -Math.PI / 2;

  const P = {};
  wall([-46, -100], [-46, 100]);
  wall([-46, 100], [-200, 125]);
  wall([-46, -100], [-150, -150]);
  P.spasskaya = spasskaya(-46, 62);
  kremlinTower(-46, -6, { w: 8, h: 14, tentH: 10 });
  P.nikolskaya = { x: -46, z: -100, top: kremlinTower(-46, -100, { w: 9, h: 20, tentH: 16, tiers: 1 }) };
  kremlinTower(-120, 113, { w: 10, h: 16, tentH: 12 });
  mausoleum(-36, -6);
  box(4, 3, 50, M.granite, -41, 0, -6); // трибуны
  P.basil = basil(14, 82);
  P.museum = historicalMuseum(-6, -112);
  P.gum = gum(46, 72, -90, 55);
  // Казанский собор и Воскресенские ворота
  box(9, 9, 9, M.brick, 40, 0, -112); tent(4.8, 9, M.tentGreen, 40, 9, -112, 8); onion(1.8, 3.4, M.gold, 40, 18, -112);
  for (const x of [20, 28]) { box(5, 14, 5, M.brick, x, 0, -110); tent(3, 9, M.tentGreen, x, 14, -110, 8); add(new THREE.SphereGeometry(0.7, 8, 6), M.gold, x, 24, -110); }
  // Кремль за стеной
  P.ivan = ivanBellTower(-92, 18);
  cathedral(-112, 42, 18, 22, 14, M.gold);
  cathedral(-82, 52, 16, 20, 12, M.silver);
  cathedral(-118, 74, 12, 14, 12, M.gold);
  box(40, 14, 26, M.cream, -84, 0, -30); // Сенат
  add(new THREE.SphereGeometry(8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.green, -84, 14, -30);
  box(60, 18, 28, M.cream, -140, 0, 100); // Большой Кремлёвский дворец
  // Минин и Пожарский, Лобное место
  box(4, 5, 3, M.granite, 10, 0, 52); box(1.6, 3.5, 1.2, M.bronze, 9.2, 5, 52); box(1.4, 2.6, 1.2, M.bronze, 10.9, 5, 52);
  drum(5, 1.4, M.white, 22, 0, 54, 24);
  P.msu = msu(-280, 580);
  city();
  scene.add(world);
  return P;
}
