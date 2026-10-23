// Палата с крестовыми сводами и центральным столпом (по мотивам Грановитой палаты Кремля):
// сюда «входит» посетитель на внутренних страницах сайта.
import * as THREE from '../vendor/three.module.min.js';

function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
// Роспись: золотой фон, ряды арок-клейм с фигурами, растительный орнамент.
function fresco(accent) {
  return tex(512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#6b4a1e'); grad.addColorStop(0.5, '#a77a34'); grad.addColorStop(1, '#5a3a17');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const x = c * 128 + 14, y = r * 256 + 40, ww = 100, hh = 180;
      g.fillStyle = r ? '#2d3f5e' : accent;
      g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x, y + 50); g.arc(x + ww / 2, y + 50, ww / 2, Math.PI, 0); g.lineTo(x + ww, y + hh); g.fill();
      g.strokeStyle = '#f0cf7a'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#f0cf7a'; g.beginPath(); g.arc(x + ww / 2, y + 48, 14, 0, 7); g.fill(); // нимб
      g.fillStyle = '#e9dcc0'; g.beginPath(); g.arc(x + ww / 2, y + 50, 9, 0, 7); g.fill();
      g.fillStyle = r ? '#8c2b24' : '#e9dcc0';
      g.beginPath(); g.moveTo(x + ww / 2 - 22, y + hh - 6); g.lineTo(x + ww / 2 - 12, y + 66); g.lineTo(x + ww / 2 + 12, y + 66); g.lineTo(x + ww / 2 + 22, y + hh - 6); g.fill();
    }
    g.strokeStyle = 'rgba(240,207,122,.55)'; g.lineWidth = 3;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.arc(x, 236, 8, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(x + 8, 20, 8, Math.PI, 0); g.stroke(); }
  }, [3, 1]);
}
function floorTex() {
  return tex(256, 256, (g, w) => {
    const s = 32;
    for (let y = 0; y < w; y += s) for (let x = 0; x < w; x += s) {
      g.fillStyle = ((x + y) / s) % 2 ? '#3a2a1c' : '#6a5338'; g.fillRect(x, y, s, s);
    }
  }, [10, 10]);
}

export function buildInterior(scene, accent = '#8c2b24') {
  const room = new THREE.Group();
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
  const wallMat = std({ map: fresco(accent), side: THREE.BackSide });
  const vaultMat = std({ map: fresco('#7a1f2b'), side: THREE.DoubleSide });
  vaultMat.map.repeat.set(2, 1);
  const white = std({ color: '#e7dcc4' });
  const gold = std({ color: '#d9a94a', metalness: 0.5, roughness: 0.35, emissive: '#8a5a10', emissiveIntensity: 0.8 });
  const S = 40, H = 11;

  const walls = new THREE.Mesh(new THREE.BoxGeometry(S, H, S), [wallMat, wallMat, new THREE.MeshBasicMaterial({ visible: false }), std({ map: floorTex(), side: THREE.BackSide }), wallMat, wallMat]);
  walls.position.y = H / 2; room.add(walls);
  // крестовые своды на четыре пролёта
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const r = S / 4;
    for (const rot of [0, Math.PI / 2]) {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(r, r, S / 2, 24, 1, true, 0, Math.PI), vaultMat);
      v.rotation.set(0, rot, Math.PI / 2);
      v.position.set(sx * r, H, sz * r);
      room.add(v);
    }
  }
  // центральный столп, расходящийся в своды
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(5, H, 5), white); pillar.position.y = H / 2; room.add(pillar);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 2.6, 4, 4), white); cap.rotation.y = Math.PI / 4; cap.position.y = H + 1; room.add(cap);
  // окна с золотистым светом
  for (let i = -1; i <= 1; i += 2) for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), std({ color: '#000', emissive: '#ffd79a', emissiveIntensity: 1.4 }));
    win.position.set(i * 10, 6, side * (S / 2 - 0.05)); if (side > 0) win.rotation.y = Math.PI;
    room.add(win);
  }
  // паникадила
  const flames = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * S / 4, z = sz * S / 4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 6, 24), gold); ring.rotation.x = Math.PI / 2; ring.position.set(x, 9, z); room.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), gold); chain.position.set(x, 12, z); room.add(chain);
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffd38a' }));
      f.position.set(x + Math.cos(a) * 2.4, 9.35, z + Math.sin(a) * 2.4); room.add(f); flames.push(f);
    }
    const l = new THREE.PointLight('#ffb862', 60, 30, 1.6); l.position.set(x, 8.6, z); room.add(l);
  }
  room.add(new THREE.HemisphereLight('#ffe2b0', '#2a1a10', 0.6));
  room.userData.flames = flames;
  scene.add(room);
  return room;
}
