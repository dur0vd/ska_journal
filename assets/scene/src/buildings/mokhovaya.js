// Старое здание Московского университета на Моховой: охристый фасад классицизма, ионический портик,
// купол над актовым залом, боковые крылья.
import * as THREE from 'three';
import { Builder } from '../geo.js';

export function mokhovaya(parent, M, x, z, rotY = 0) {
  const b = new Builder(parent, x, 0, z, rotY);
  const H = 17;
  b.box(56, H, 16, M.ochre, 0, 0, 0);
  for (const s of [-1, 1]) {
    b.box(16, H, 44, M.ochre, s * 28, 0, -14);
    for (const fl of [2.5, 8, 13]) b.windowRow(6, 36, 1.4, 2.8, M.window, s * 36.05, fl, -14, s * Math.PI / 2);
  }
  b.box(57, 1.2, 17, M.white, 0, H, 0);
  b.box(57, 0.6, 17, M.white, 0, 6, 0);
  for (const fl of [2.5, 8, 13]) for (const s of [-1, 1]) b.windowRow(5, 16, 1.4, 2.8, M.window, s * 18, fl, 8.05, 0);
  // портик: восемь ионических колонн и фронтон
  b.box(28, 2.2, 6, M.white, 0, 0, 10);
  for (let i = 0; i < 8; i++) b.column(0.8, 12, M.white, -12.25 + i * 3.5, 2.2, 11.8);
  b.box(29, 1.6, 5, M.white, 0, 14.2, 11);
  const s = new THREE.Shape(); s.moveTo(-14.5, 0); s.lineTo(14.5, 0); s.lineTo(0, 5); s.closePath();
  const ped = new THREE.ExtrudeGeometry(s, { depth: 5, bevelEnabled: false }); ped.translate(0, 0, -2.5);
  b.mesh(ped, M.white, 0, 15.8, 11);
  for (const fl of [3.2, 8.4]) b.windowRow(5, 16, 1.6, 3, M.window, 0, fl, 8.05, 0);
  // ротонда с куполом над актовым залом
  b.drum(9, 8, M.ochre, 0, H, -2, 32);
  b.roundWindows(9, 12, 1.2, 3, M.window, 0, H + 2, -2);
  b.drum(9.4, 0.8, M.white, 0, H + 8, -2, 32);
  b.mesh(new THREE.SphereGeometry(9.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.green, 0, H + 8.8, -2);
  b.drum(1.6, 3, M.white, 0, H + 17.6, -2, 16);
  b.mesh(new THREE.SphereGeometry(1.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.green, 0, H + 20.6, -2);
  // ограда с фонарями
  for (let i = -10; i <= 10; i++) b.box(0.25, 2.2, 0.25, M.dark, i * 3.4, 0, 30);
  b.box(68, 0.2, 0.2, M.dark, 0, 2, 30);
  const door = b.world(0, 4, 13);
  return { center: new THREE.Vector3(x, 14, z), height: 38, door, flood: [[x, z + 40], [x + 30, z + 30], [x - 30, z + 30]], lamps: [[x - 20, z + 30], [x + 20, z + 30]] };
}
