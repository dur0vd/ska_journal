// Помещения, куда «входит» камера: древняя палата с росписью и иконостасом
// или классический зал университета с колоннами и люстрами.
import * as THREE from 'three';
import { pbr, fbm } from './materials.js';

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
// Роспись: охра и золото, ряды святых в арках, орнамент — как в палатах и храмах XVI–XVII веков
function fresco(accent) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#5a3c1c'); grad.addColorStop(0.5, '#9c7232'); grad.addColorStop(1, '#4a2f14');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
      const x = c * 204 + 22, y = r * 512 + 70, ww = 160, hh = 380;
      g.fillStyle = r ? '#253a5c' : accent;
      g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x, y + 80); g.arc(x + ww / 2, y + 80, ww / 2, Math.PI, 0); g.lineTo(x + ww, y + hh); g.fill();
      g.strokeStyle = '#e8c56e'; g.lineWidth = 6; g.stroke();
      const cx = x + ww / 2;
      g.fillStyle = '#e8c56e'; g.beginPath(); g.arc(cx, y + 92, 28, 0, 7); g.fill();
      g.fillStyle = '#d9b48c'; g.beginPath(); g.ellipse(cx, y + 96, 15, 19, 0, 0, 7); g.fill();
      g.fillStyle = r ? '#7c2a22' : '#e9dcc0';
      g.beginPath(); g.moveTo(cx - 40, y + hh - 10); g.quadraticCurveTo(cx - 34, y + 150, cx - 18, y + 120); g.lineTo(cx + 18, y + 120); g.quadraticCurveTo(cx + 34, y + 150, cx + 40, y + hh - 10); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(cx - 20 + k * 10, y + 140); g.lineTo(cx - 30 + k * 15, y + hh - 14); g.stroke(); }
    }
    g.strokeStyle = 'rgba(232,197,110,.6)'; g.lineWidth = 4;
    for (let x = 0; x < w; x += 24) { g.beginPath(); g.arc(x, 486, 12, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(x + 12, 30, 12, Math.PI, 0); g.stroke(); }
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = (fbm((i / 4 % w) / 60, Math.floor(i / 4 / w) / 60) - 0.5) * 40; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }, [3, 1]);
}
function iconostasis() {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#b8872e'; g.fillRect(0, 0, w, h);
    const rows = 3;
    for (let r = 0; r < rows; r++) for (let c = 0; c < 9; c++) {
      const x = c * 112 + 10, y = r * 168 + 12, ww = 92, hh = 146;
      g.fillStyle = '#3a2412'; g.fillRect(x - 3, y - 3, ww + 6, hh + 6);
      const gr = g.createLinearGradient(x, y, x, y + hh); gr.addColorStop(0, '#d8a84a'); gr.addColorStop(1, '#8a5a1c');
      g.fillStyle = gr; g.fillRect(x, y, ww, hh);
      g.fillStyle = ['#7c1f18', '#20406a', '#2a5a3a'][(r + c) % 3];
      g.beginPath(); g.moveTo(x + 18, y + hh - 6); g.lineTo(x + 28, y + 50); g.lineTo(x + ww - 28, y + 50); g.lineTo(x + ww - 18, y + hh - 6); g.fill();
      g.fillStyle = '#f2d27a'; g.beginPath(); g.arc(x + ww / 2, y + 36, 18, 0, 7); g.fill();
      g.fillStyle = '#c99a72'; g.beginPath(); g.ellipse(x + ww / 2, y + 38, 9, 12, 0, 0, 7); g.fill();
    }
  });
}

function candles(group, positions, color = '#ffb35a', power = 260) {
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd08a' });
  for (const [x, y, z, n, r] of positions) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 48), new THREE.MeshStandardMaterial({ color: '#d4a24a', metalness: 1, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z); group.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8, 4), ring.material); chain.position.set(x, y + 4, z); group.add(chain);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), flameMat);
      f.position.set(x + Math.cos(a) * r, y + 0.22, z + Math.sin(a) * r); f.scale.y = 2; group.add(f); flames.push(f);
    }
    const l = new THREE.PointLight(color, power, 34, 1.7); l.position.set(x, y - 0.4, z); group.add(l);
  }
  return flames;
}

// Палата с крестовыми сводами, центральным столпом и золотым иконостасом
function palata(scene, accent) {
  const g = new THREE.Group();
  const S = 40, H = 11;
  const wall = new THREE.MeshStandardMaterial({ map: fresco(accent), roughness: 0.85, side: THREE.BackSide });
  const vault = new THREE.MeshStandardMaterial({ map: fresco('#7a1f2b'), roughness: 0.85, side: THREE.DoubleSide });
  vault.map.repeat.set(2, 1);
  const floor = pbr({ size: 512, height: (u, v) => ((Math.floor(u * 12) + Math.floor(v * 12)) % 2 ? 0.4 : 0.6), color: (u, v) => ((Math.floor(u * 12) + Math.floor(v * 12)) % 2 ? [74, 52, 34] : [134, 108, 76]).map((c) => c * (0.85 + fbm(u * 20, v * 20) * 0.3)), rough: () => 0.4, strength: 2, repeat: [3, 3] });
  floor.side = THREE.BackSide;
  const room = new THREE.Mesh(new THREE.BoxGeometry(S, H, S), [wall, wall, new THREE.MeshBasicMaterial({ visible: false }), floor, wall, wall]);
  room.position.y = H / 2; g.add(room);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const rot of [0, Math.PI / 2]) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(S / 4, S / 4, S / 2, 32, 1, true, 0, Math.PI), vault);
    v.rotation.set(0, rot, Math.PI / 2); v.position.set(sx * S / 4, H, sz * S / 4); g.add(v);
  }
  const white = new THREE.MeshStandardMaterial({ color: '#e7dcc4', roughness: 0.8 });
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(5, H, 5), white); pillar.position.y = H / 2; g.add(pillar);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 2.6, 4, 4), white); cap.rotation.y = Math.PI / 4; cap.position.y = H + 1; g.add(cap);
  const ico = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshStandardMaterial({ map: iconostasis(), metalness: 0.6, roughness: 0.35 }));
  ico.position.set(0, 6.6, -S / 2 + 0.1); g.add(ico);
  for (let i = -1; i <= 1; i += 2) for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshBasicMaterial({ color: '#ffe2b0' }));
    win.position.set(side * (S / 2 - 0.05), 6, i * 10); win.rotation.y = -side * Math.PI / 2; g.add(win);
  }
  const flames = candles(g, [[-10, 9, -10, 12, 2.4], [10, 9, -10, 12, 2.4], [-10, 9, 10, 12, 2.4], [10, 9, 10, 12, 2.4]]);
  g.add(new THREE.HemisphereLight('#ffe2b0', '#2a1a10', 0.5));
  scene.add(g);
  return { flames, orbit: { r: 15, y: 4.2, look: 6.5 } };
}

// Классический зал: колоннада, кессонный потолок, люстры, скамьи амфитеатром
function hall(scene) {
  const g = new THREE.Group();
  const W = 44, D = 30, H = 14;
  const wallMat = pbr({ size: 256, height: (u, v) => fbm(u * 20, v * 20), color: (u, v) => [236, 222, 196].map((c) => c * (0.95 + fbm(u * 4, v * 4) * 0.08)), rough: () => 0.8, strength: 1, side: THREE.BackSide });
  const ceil = new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#efe6d2'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = '#d8c7a2'; c.fillRect(x * 128 + 12, y * 128 + 12, 104, 104); c.fillStyle = '#c9a85c'; c.beginPath(); c.arc(x * 128 + 64, y * 128 + 64, 18, 0, 7); c.fill(); }
  }, [6, 4]), roughness: 0.8, side: THREE.BackSide });
  const parquet = pbr({ size: 512, height: (u, v) => ((u * 16) % 1 < 0.04 || ((v * 4 + Math.floor(u * 16) * 0.37) % 1) < 0.02) ? 0.3 : 0.6, color: (u, v) => [150, 98, 54].map((c) => c * (0.75 + fbm(u * 16, v * 60) * 0.5)), rough: () => 0.35, strength: 2, repeat: [6, 4], side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [wallMat, wallMat, ceil, parquet, wallMat, wallMat]);
  room.position.y = H / 2; g.add(room);
  const col = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.4 });
  for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, H - 1.6, 24), col); c.position.set(sx * (W / 2 - 4), (H - 1.6) / 2 + 0.6, -D / 2 + 3 + i * 4); g.add(c);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), col); cap.position.set(sx * (W / 2 - 4), H - 0.5, -D / 2 + 3 + i * 4); g.add(cap);
  }
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3820', roughness: 0.55 });
  for (let r = 0; r < 6; r++) { const b = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9 + r * 0.6, 1.2), wood); b.position.set(0, (0.9 + r * 0.6) / 2, 2 + r * 2); g.add(b); }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshStandardMaterial({ color: '#1f2a24', roughness: 0.9 })); board.position.set(0, 5, -D / 2 + 0.1); g.add(board);
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 7), new THREE.MeshBasicMaterial({ color: '#e8dcc0' })); win.position.set(side * (W / 2 - 0.05), 7, -D / 2 + 5 + i * 7); win.rotation.y = -side * Math.PI / 2; g.add(win);
  }
  const flames = candles(g, [[-9, 10.5, -4, 16, 1.8], [9, 10.5, -4, 16, 1.8], [-9, 10.5, 8, 16, 1.8], [9, 10.5, 8, 16, 1.8]], '#ffd59a', 90);
  g.add(new THREE.HemisphereLight('#fff4e0', '#3a2a1a', 0.3));
  scene.add(g);
  return { flames, orbit: { r: 12, y: 5, look: 6 } };
}

export function buildInterior(scene, kind, accent) {
  return kind === 'hall' ? hall(scene) : palata(scene, accent);
}
