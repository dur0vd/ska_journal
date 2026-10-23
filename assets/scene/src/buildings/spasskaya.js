// Спасская башня с участком Кремлёвской стены: зубцы «ласточкин хвост», часы, шатёр, рубиновая звезда.
import * as THREE from 'three';
import { Builder } from '../geo.js';

export function kremlinWall(b, M, x0, z0, x1, z1, h = 14, t = 5) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
  b.box(t, h, len, M.brick, (x0 + x1) / 2, 0, (z0 + z1) / 2, { ry });
  const shape = new THREE.Shape();
  shape.moveTo(-1, 0); shape.lineTo(1, 0); shape.lineTo(1, 2.8); shape.lineTo(0, 1.7); shape.lineTo(-1, 2.8); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false });
  geo.translate(0, 0, -0.45);
  const n = Math.floor(len / 3);
  const inst = new THREE.InstancedMesh(geo, M.brick, n * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry + Math.PI / 2);
  let k = 0;
  for (let i = 0; i < n; i++) for (const side of [-1, 1]) {
    const f = (i + 0.5) / n, ox = Math.cos(ry) * side * (t / 2 - 0.45), oz = -Math.sin(ry) * side * (t / 2 - 0.45);
    m.compose(new THREE.Vector3(x0 + dx * f + ox, h, z0 + dz * f + oz), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(k++, m);
  }
  inst.castShadow = inst.receiveShadow = true;
  b.g.add(inst);
}

export function spasskaya(parent, M, x, z, rotY = 0) {
  const b = new Builder(parent, x, 0, z, rotY);
  kremlinWall(b, M, 0, -160, 0, -9);
  kremlinWall(b, M, 0, 9, 0, 120);
  // основной четверик с воротами
  b.box(18, 26, 18, M.brick, 0, 0, 0);
  b.archWindow(6, 11, M.dark, 9.05, 0, 0, Math.PI / 2);
  b.archWindow(6, 11, M.dark, -9.05, 0, 0, -Math.PI / 2);
  b.box(19, 1.2, 19, M.stone, 0, 26, 0);
  // ярус с белокаменными башенками и арками
  b.box(14.5, 10, 14.5, M.brick, 0, 27.2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.drum(1, 5, M.stone, sx * 7.4, 27.2, sz * 7.4, 8);
    b.cone(1.2, 6, M.stone, sx * 7.4, 32.2, sz * 7.4, 8);
    b.sphere(0.35, M.gold, sx * 7.4, 38.4, sz * 7.4);
  }
  for (const [ry, ox, oz] of [[0, 0, 7.3], [Math.PI, 0, -7.3], [Math.PI / 2, 7.3, 0], [-Math.PI / 2, -7.3, 0]]) b.windowRow(3, 8, 1.4, 4, M.dark, ox, 30, oz, ry);
  // часовой ярус
  b.box(12, 12, 12, M.brick, 0, 37.2, 0);
  for (const [ry, ox, oz] of [[0, 0, 6.03], [Math.PI, 0, -6.03], [Math.PI / 2, 6.03, 0], [-Math.PI / 2, -6.03, 0]]) b.mesh(new THREE.CircleGeometry(4.6, 48), M.clock, ox, 43.2, oz, { ry, shadow: false });
  b.box(13, 1, 13, M.stone, 0, 49.2, 0);
  // восьмерик со звонницей
  b.drum(5.2, 9, M.brick, 0, 50.2, 0, 8);
  b.roundWindows(5.2, 8, 1.4, 4.2, M.dark, 0, 52, 0);
  b.drum(5.6, 1, M.stone, 0, 59.2, 0, 8);
  // шатёр с белыми рёбрами
  b.cone(5.6, 18, M.tile, 0, 60.2, 0, 8);
  b.drum(0.3, 3, M.gold, 0, 78, 0, 8);
  // рубиновая звезда
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 1.25 : 3; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const sg = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.3, bevelSegments: 2 });
  sg.center();
  b.mesh(sg, M.ruby, 0, 84, 0, { ry: Math.PI / 2 });
  const door = b.world(10, 4, 0);
  return { center: new THREE.Vector3(x, 40, z), height: 86, door, flood: [[x + 40, z + 20], [x + 40, z - 20]] };
}
