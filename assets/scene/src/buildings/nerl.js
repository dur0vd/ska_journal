// Церковь Покрова на Нерли: белокаменный одноглавый храм на холме у воды,
// фасады разделены на три закомары, аркатурный пояс, три апсиды, высокий барабан и шлемовидная глава.
import * as THREE from 'three';
import { Builder } from '../geo.js';

export function nerl(parent, M, x, z, rotY = 0) {
  const b = new Builder(parent, x, 0, z, rotY);
  // насыпной холм-подиум
  b.frustum(22, 15, 3, M.meadow, 0, -0.5, 0, 32);
  const W = 10, H = 12;
  b.box(W, H, W, M.stone, 0, 2.5, 0);
  // лопатки и полуколонны по углам и делениям фасадов
  for (const s of [-1, 1]) for (const t of [-1, -1 / 3, 1 / 3, 1]) {
    b.box(0.5, H, 0.4, M.stone, t * W / 2, 2.5, s * (W / 2 + 0.1));
    b.box(0.4, H, 0.5, M.stone, s * (W / 2 + 0.1), 2.5, t * W / 2);
  }
  // три закомары на каждом фасаде, средняя выше
  for (const [ry, ox, oz] of [[0, 0, W / 2], [Math.PI, 0, -W / 2], [Math.PI / 2, W / 2, 0], [-Math.PI / 2, -W / 2, 0]]) {
    for (const t of [-1, 0, 1]) {
      const dx = Math.cos(ry) * t * W / 3, dz = -Math.sin(ry) * t * W / 3;
      b.zakomara(W / 3, 0.9, M.stone, ox * 0.98 + dx, 2.5 + H + (t ? 0 : 0.6), oz * 0.98 + dz, ry);
    }
    // аркатурно-колончатый пояс
    for (let k = 0; k < 9; k++) {
      const t = (k / 8 - 0.5) * (W - 1);
      b.archWindow(0.5, 2, M.dark, ox * 1.01 + Math.cos(ry) * t, 7, oz * 1.01 - Math.sin(ry) * t, ry);
    }
    // узкие окна верхнего яруса
    b.windowRow(3, W * 0.62, 0.55, 2.4, M.dark, ox * 1.01, 10, oz * 1.01, ry);
    // перспективный портал
    if (ry !== -Math.PI / 2) for (let k = 0; k < 3; k++) b.archWindow(2.6 - k * 0.5, 4.6 - k * 0.5, k % 2 ? M.stone : M.dark, ox * (1.02 + k * 0.004), 2.5, oz * (1.02 + k * 0.004), ry);
  }
  // три апсиды на восток (-x)
  for (const t of [-1, 0, 1]) {
    const r = t ? 1.5 : 2;
    b.drum(r, H - 2, M.stone, -W / 2, 2.5, t * 3.2, 20);
    b.mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.lead, -W / 2, 2.5 + H - 2, t * 3.2);
  }
  b.box(W + 0.4, 0.6, W + 0.4, M.stone, 0, 2.5 + H + 0.2, 0);
  // кровля по закомарам и барабан
  b.box(W - 1, 2.2, W - 1, M.lead, 0, 2.5 + H + 0.8, 0);
  b.drum(2.7, 7, M.stone, 0, 2.5 + H + 2, 0, 16);
  b.roundWindows(2.7, 8, 0.45, 2.6, M.dark, 0, 2.5 + H + 4.2, 0);
  b.helmet(2.9, 4.2, M.lead, 0, 2.5 + H + 9, 0, M.gold);
  const door = b.world(W / 2 + 1.5, 4, 0);
  return { center: new THREE.Vector3(x, 12, z), height: 30, door, flood: [[x + 22, z + 10], [x - 18, z - 16]] };
}
