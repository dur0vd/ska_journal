// Покровский собор на Рву: центральный шатёр, восемь приделов с витыми главами, галерея на подклете.
import * as THREE from 'three';
import { Builder } from '../geo.js';

export function basil(parent, M, x, z, rotY = 0) {
  const b = new Builder(parent, x, 0, z, rotY);
  // подклет и галерея
  b.box(44, 7, 44, M.brick, 0, 0, 0);
  b.box(45, 0.8, 45, M.stone, 0, 7, 0);
  for (const s of [-1, 1]) {
    b.windowRow(9, 36, 1.4, 3, M.dark, 0, 1.8, s * 22.05, s > 0 ? 0 : Math.PI);
    b.windowRow(9, 36, 1.4, 3, M.dark, s * 22.05, 1.8, 0, s * Math.PI / 2);
  }
  // центральный шатровый столп
  b.drum(7, 16, M.brick, 0, 7.8, 0, 8);
  b.roundWindows(7, 8, 1.2, 3.2, M.dark, 0, 12, 0);
  b.drum(7.6, 1.2, M.stone, 0, 23.8, 0, 8);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; b.zakomara(4.6, 0.6, M.stone, Math.cos(a) * 7.2, 25, Math.sin(a) * 7.2, Math.PI / 2 - a); }
  b.drum(6.6, 4, M.brick, 0, 25, 0, 8);
  b.cone(6.9, 26, M.tent, 0, 29, 0, 8);
  b.drum(1.3, 3, M.gold, 0, 54.5, 0, 12);
  b.onion(2.3, 4.5, M.gold, 0, 57.5, 0, { ribs: 0, gold: M.gold });
  // приделы
  const big = [[0, 15], [15, 0], [0, -15], [-15, 0]], small = [[11, 11], [-11, 11], [11, -11], [-11, -11]];
  big.forEach(([px, pz], i) => {
    b.drum(5, 13, M.brick, px, 7.8, pz, 8);
    b.roundWindows(5, 8, 1, 2.6, M.dark, px, 11, pz);
    b.drum(5.4, 0.8, M.stone, px, 20.8, pz, 8);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; b.zakomara(3.2, 0.5, M.stone, px + Math.cos(a) * 5.2, 21.6, pz + Math.sin(a) * 5.2, Math.PI / 2 - a); }
    b.drum(3.3, 5, M.brick, px, 21.6, pz, 16);
    b.roundWindows(3.3, 8, 0.6, 1.8, M.dark, px, 23, pz);
    b.onion(5.2, 9, M.domes[i], px, 26.6, pz, { ribs: 12, twist: i % 2 ? -0.35 : 0.35, depth: 0.06, gold: M.gold });
  });
  small.forEach(([px, pz], i) => {
    b.drum(3.4, 9, M.brick, px, 7.8, pz, 8);
    b.drum(3.7, 0.6, M.stone, px, 16.8, pz, 8);
    b.drum(2.3, 3.5, M.brick, px, 17.4, pz, 16);
    b.onion(3.6, 6.5, M.domes[4 + i], px, 20.9, pz, { ribs: 10, twist: i % 2 ? 0.3 : -0.3, depth: 0.07, gold: M.gold });
  });
  // колокольня
  b.box(7, 16, 7, M.brick, 27, 0, 14);
  b.drum(3.8, 7, M.plaster, 27, 16, 14, 8);
  b.cone(4.2, 12, M.tile, 27, 23, 14, 8);
  b.onion(1.8, 3.2, M.gold, 27, 35, 14, { gold: M.gold });
  // крыльца с шатрами
  for (const [px, pz, ry] of [[-16, 25, 0], [16, -25, Math.PI]]) {
    b.box(8, 7, 7, M.brick, px, 0, pz, { ry });
    b.cone(5, 6, M.tile, px, 7, pz, 4, { ry: Math.PI / 4 });
  }
  const door = b.world(-16, 3, 29);
  return { center: new THREE.Vector3(x, 30, z), height: 62, door, flood: [[x + 40, z + 40], [x - 40, z + 30], [x, z - 45]] };
}
