// Выгружает треугольники каркаса в JSON — для подбора камеры по снимку (tools/calibrate.py).
import * as THREE from 'three';
const [, , name, out] = process.argv;
const mod = await import(new URL(`../assets/scene/src/models/${name}.js`, import.meta.url));
const g = mod.build(); g.updateMatrixWorld(true);
const tris = [];
g.traverse((m) => {
  if (!m.isMesh) return;
  const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); tris.push(+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)); }
});
(await import('fs')).writeFileSync(out, JSON.stringify({ photo: mod.PHOTO, center: mod.CENTER, tris }));
console.log(name, tris.length / 9, 'треугольников');
