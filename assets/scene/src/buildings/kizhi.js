// Кижский погост: деревянная Преображенская церковь с двадцатью двумя главами,
// рядом десятиглавая Покровская церковь и шатровая колокольня, всё — из брёвен и осинового лемеха.
import * as THREE from 'three';
import { Builder } from '../geo.js';

function barrel(b, M, w, h, x, y, z, ry) {
  // «бочка» — кровля с килевидным завершением
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.quadraticCurveTo(-w / 2, h * 0.75, 0, h); s.quadraticCurveTo(w / 2, h * 0.75, w / 2, 0); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w * 0.9, bevelEnabled: false, curveSegments: 14 });
  geo.translate(0, 0, -w * 0.45);
  b.mesh(geo, M.shingle, x, y, z, { ry });
}

export function kizhi(parent, M, x, z, rotY = 0) {
  const b = new Builder(parent, x, 0, z, rotY);
  const dome = (r, px, py, pz) => { b.drum(r * 0.45, r * 0.9, M.shingle, px, py, pz, 12); b.onion(r, r * 1.9, M.shingle, px, py + r * 0.9, pz, { cross: true, gold: M.logs }); };
  // Преображенская церковь
  b.drum(8, 12, M.logs, 0, 0, 0, 8);
  for (let i = 0; i < 4; i++) { // прирубы
    const a = (i / 4) * Math.PI * 2, px = Math.cos(a) * 9, pz = Math.sin(a) * 9;
    b.box(7, 10, 7, M.logs, px, 0, pz, { ry: -a });
    barrel(b, M, 7, 5, px, 10, pz, -a + Math.PI / 2);
    dome(1.6, px + Math.cos(a) * 1.8, 13.2, pz + Math.sin(a) * 1.8);
    barrel(b, M, 4.6, 3.6, px - Math.cos(a) * 2.5, 13, pz - Math.sin(a) * 2.5, -a + Math.PI / 2);
    dome(1.3, px - Math.cos(a) * 2.5, 15.6, pz - Math.sin(a) * 2.5);
  }
  for (let i = 0; i < 8; i++) { // бочки на восьмерике
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    barrel(b, M, 4, 3.2, Math.cos(a) * 6.4, 12, Math.sin(a) * 6.4, -a + Math.PI / 2);
    if (i % 2) dome(1.3, Math.cos(a) * 6.4, 14.5, Math.sin(a) * 6.4);
  }
  b.drum(5.6, 6, M.logs, 0, 12, 0, 8);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; barrel(b, M, 3.6, 2.8, Math.cos(a) * 4.6, 18, Math.sin(a) * 4.6, -a + Math.PI / 2); dome(1.15, Math.cos(a) * 4.6, 20.3, Math.sin(a) * 4.6); }
  b.drum(3.8, 5, M.logs, 0, 18, 0, 8);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; dome(1, Math.cos(a) * 3, 23, Math.sin(a) * 3); }
  b.drum(2.4, 4, M.logs, 0, 23, 0, 8);
  dome(2.6, 0, 27, 0);
  // Покровская церковь
  b.drum(6, 9, M.logs, 24, 0, 6, 8);
  b.box(8, 7, 8, M.logs, 31, 0, 6);
  b.drum(4.4, 3, M.logs, 24, 9, 6, 8);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; dome(1.1, 24 + Math.cos(a) * 3.6, 12, 6 + Math.sin(a) * 3.6); }
  dome(1.8, 24, 14, 6);
  // колокольня
  b.box(6, 7, 6, M.logs, 12, 0, -20);
  b.drum(3.4, 6, M.logs, 12, 7, -20, 8);
  b.cone(4, 9, M.shingle, 12, 13, -20, 8);
  dome(1, 12, 22, -20);
  // изгородь погоста
  for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; b.box(3.2, 1.8, 0.4, M.logs, 8 + Math.cos(a) * 36, 0, -2 + Math.sin(a) * 30, { ry: -a + Math.PI / 2 }); }
  const door = b.world(0, 3, 15);
  return { center: new THREE.Vector3(x, 16, z), height: 33, door, flood: [[x + 30, z + 30], [x - 30, z + 20]] };
}
