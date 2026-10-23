// Детали каркаса: блоки, барабаны, луковичные и шлемовидные главы, кресты.
// Каждой детали задаются вид поверхности (стена, кровля, глава) и плоскость симметрии: невидимую
// на снимке сторону шейдер берёт с зеркальной видимой.
import * as THREE from 'three';

export class Kit {
  constructor() { this.group = new THREE.Group(); }
  add(geo, x, y, z, { kind = 'wall', mirrorZ = null, mirrorX = null, ry = 0 } = {}) {
    const m = new THREE.Mesh(geo);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.userData = { kind, mirrorZ, mirrorX };
    this.group.add(m);
    return m;
  }
  box(w, h, d, x, y, z, o) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return this.add(g, x, y, z, o); }
  drum(r, h, x, y, z, o, sides = 32) { const g = new THREE.CylinderGeometry(r, r, h, sides, 1); g.translate(0, h / 2, 0); return this.add(g, x, y, z, { kind: 'wall', mirrorZ: z, ...o }); }
  // Шатёр: гранёная пирамида от радиуса r0 внизу до r1 вверху
  tent(r0, r1, h, x, y, z, o, sides = 8) { const g = new THREE.CylinderGeometry(r1, r0, h, sides, 1); g.translate(0, h / 2, 0); return this.add(g, x, y, z, { kind: 'roof', mirrorZ: z, ...o }); }
  // Вальмовая кровля: брус, верх которого сужен на inset со всех сторон
  hip(w, d, h, inset, x, y, z, o) {
    const g = new THREE.BoxGeometry(w, h, d); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, Math.sign(p.getX(i)) * (w / 2 - inset), h / 2, Math.sign(p.getZ(i)) * (d / 2 - inset));
    g.translate(0, h / 2, 0); g.computeVertexNormals();
    return this.add(g, x, y, z, { kind: 'roof', ...o });
  }
  // Треугольный фронтон шириной w и высотой h, фасад в плоскости z
  gable(w, h, depth, x, y, z, o) {
    const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth);
    return this.add(g, x, y, z, { kind: 'wall', ...o });
  }
  // Склон шириной w: верхняя бровка на высоте y + h в плоскости z, подошва на высоте y в z + len
  slope(w, h, len, x, y, z, o) {
    const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0);
    return this.add(g, x, y, z, { kind: 'wall', ...o });
  }
  // Глава по профилю: 'onion' — луковица, 'helmet' — шлем
  dome(r, h, x, y, z, shape = 'onion', o) {
    const prof = shape === 'onion'
      ? [[0.86, 0], [1, 0.18], [0.98, 0.36], [0.82, 0.55], [0.5, 0.76], [0.2, 0.9], [0.05, 1]]
      : [[1, 0], [1, 0.12], [0.94, 0.4], [0.72, 0.68], [0.36, 0.9], [0.06, 1]];
    const curve = new THREE.SplineCurve(prof.map(([a, b]) => new THREE.Vector2(a * r, b * h)));
    const g = new THREE.LatheGeometry([new THREE.Vector2(0, 0), ...curve.getPoints(40)], 64);
    return this.add(g, x, y, z, { kind: 'dome', mirrorZ: z, ...o });
  }
  cross(s, x, y, z) {
    this.box(s * 0.08, s, s * 0.08, x, y, z, { kind: 'gold', mirrorZ: z });
    this.box(s * 0.5, s * 0.07, s * 0.07, x, y + s * 0.7, z, { kind: 'gold', mirrorZ: z });
  }
  // Ряд закомар по верху стены: полукружия вдоль x на высоте y, фасад в плоскости z
  zakomaras(x0, x1, n, y, z, depth, o) {
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0); s.absarc(0, 0, w / 2, Math.PI, 0, true); s.lineTo(-w / 2, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 24 });
      g.translate(0, 0, -depth);
      this.add(g, x0 + w * (i + 0.5), y, z, { kind: 'wall', ...o });
    }
  }
}
