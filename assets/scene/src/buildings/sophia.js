// Софийский собор Великого Новгорода: белёный объём с закомарами, галереи, пять глав
// (центральная золотая), башня-лестница с шестой главой; рядом участок стены детинца с башней.
import * as THREE from 'three';
import { Builder } from '../geo.js';
import { kremlinWall } from './spasskaya.js';

export function sophia(parent, M, x, z, rotY = 0) {
  const b = new Builder(parent, x, 0, z, rotY);
  const W = 26, D = 24, H = 18;
  b.box(W + 8, 9, D + 8, M.plaster, 0, 0, 0); // галереи
  b.box(W, H, D, M.plaster, 0, 0, 0);
  for (const [ry, ox, oz, n] of [[0, 0, D / 2, 4], [Math.PI, 0, -D / 2, 4], [Math.PI / 2, W / 2, 0, 4], [-Math.PI / 2, -W / 2, 0, 4]]) {
    for (let k = 0; k < n; k++) {
      const t = (k / (n - 1) - 0.5) * (W - W / n), dx = Math.cos(ry) * t, dz = -Math.sin(ry) * t;
      b.zakomara(W / n, 1, M.plaster, ox * 0.98 + dx, H, oz * 0.98 + dz, ry);
    }
    b.windowRow(4, W * 0.7, 0.8, 2.6, M.dark, ox * 1.01, 12, oz * 1.01, ry);
    b.windowRow(5, W * 0.9, 0.7, 2, M.dark, ox * (W + 8) / W * 1.01, 4, oz * (D + 8) / D * 1.01, ry);
  }
  b.box(W - 2, 2.5, D - 2, M.roofGrey, 0, H, 0);
  // главы
  const head = (r, h, mat, px, pz, gold) => {
    b.drum(r, h, M.plaster, px, H + 2, pz, 16);
    b.roundWindows(r, 8, r * 0.18, h * 0.45, M.dark, px, H + 2 + h * 0.3, pz);
    b.helmet(r * 1.05, r * 1.7, mat, px, H + 2 + h, pz, M.gold);
  };
  head(4.2, 7, M.gold, 0, 0);
  for (const [px, pz] of [[7, 7], [-7, 7], [7, -7], [-7, -7]]) head(2.8, 5, M.lead, px, pz);
  b.drum(3.4, H + 6, M.plaster, -W / 2 - 2, 0, -D / 2 - 2, 16);
  b.helmet(2.6, 4, M.lead, -W / 2 - 2, H + 6, -D / 2 - 2, M.gold);
  // стена детинца с круглой башней
  kremlinWall(b, M, 40, -80, 40, 60, 10, 4);
  b.drum(6, 16, M.brick, 40, 0, -10, 20);
  b.cone(6.6, 9, M.roofRed, 40, 16, -10, 20);
  const door = b.world(0, 3, D / 2 + 5);
  return { center: new THREE.Vector3(x, 18, z), height: 38, door, flood: [[x + 30, z + 30], [x - 30, z + 30]] };
}
