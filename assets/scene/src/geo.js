// Геометрия для построек: блоки, барабаны, шатры, луковичные главы, арки и колонны.
// UV считаются в метрах, чтобы кирпич и камень были одного размера на любой стене.
import * as THREE from 'three';

const TEX_M = 4; // одна плитка текстуры — 4 метра

function uvPlanar(geo, s = TEX_M) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const [u, v] = ay > ax && ay > az ? [x, z] : ax > az ? [z, y] : [x, y];
    uv[i * 2] = u / s; uv[i * 2 + 1] = v / s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
function uvRound(geo, r, s = TEX_M) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  const circ = Math.max(1, Math.round((2 * Math.PI * r) / s));
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)) / (Math.PI * 2) + 0.5;
    uv[i * 2] = a * circ; uv[i * 2 + 1] = p.getY(i) / s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export class Builder {
  constructor(parent, x = 0, y = 0, z = 0, rotY = 0) {
    this.g = new THREE.Group();
    this.g.position.set(x, y, z); this.g.rotation.y = rotY;
    parent.add(this.g);
  }
  // Точка в мировых координатах (для двери, к которой подлетает камера)
  world(x, y, z) { this.g.updateMatrixWorld(true); return this.g.localToWorld(new THREE.Vector3(x, y, z)); }
  mesh(geo, mat, x, y, z, { ry = 0, rx = 0, rz = 0, shadow = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = shadow; m.receiveShadow = true;
    this.g.add(m);
    return m;
  }
  // Блок, стоящий на y
  box(w, h, d, mat, x, y, z, o) { return this.mesh(uvPlanar(new THREE.BoxGeometry(w, h, d)), mat, x, y + h / 2, z, o); }
  drum(r, h, mat, x, y, z, sides = 8, o) { return this.mesh(uvRound(new THREE.CylinderGeometry(r, r, h, sides), r), mat, x, y + h / 2, z, o); }
  cone(r, h, mat, x, y, z, sides = 8, o) { return this.mesh(uvRound(new THREE.ConeGeometry(r, h, sides), r), mat, x, y + h / 2, z, o); }
  frustum(r1, r2, h, mat, x, y, z, sides = 8, o) { return this.mesh(uvRound(new THREE.CylinderGeometry(r2, r1, h, sides), r1), mat, x, y + h / 2, z, o); }
  sphere(r, mat, x, y, z) { return this.mesh(new THREE.SphereGeometry(r, 24, 16), mat, x, y, z); }
  // Карниз-пояс вокруг блока
  band(w, d, h, mat, x, y, z) { return this.box(w, h, d, mat, x, y, z); }

  // Луковичная глава. ribs — число рёбер, twist — закрутка рёбер (обороты снизу доверху).
  onion(r, h, mat, x, y, z, { ribs = 0, twist = 0, depth = 0.06, cross = true, gold } = {}) {
    const prof = [[0.62, 0], [0.9, 0.12], [1, 0.3], [0.9, 0.48], [0.62, 0.66], [0.3, 0.8], [0.1, 0.92], [0.03, 1]];
    const curve = new THREE.SplineCurve(prof.map(([a, b]) => new THREE.Vector2(a * r, b * h)));
    const pts = [new THREE.Vector2(0, 0), ...curve.getPoints(40)];
    const geo = new THREE.LatheGeometry(pts, 64);
    if (ribs) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), pz = p.getZ(i), py = p.getY(i), rr = Math.hypot(px, pz);
        if (rr < 1e-4) continue;
        const a = Math.atan2(pz, px) + (py / h) * twist * Math.PI * 2;
        const k = 1 + depth * Math.cos(a * ribs);
        p.setX(i, px * k); p.setZ(i, pz * k);
      }
      geo.computeVertexNormals();
    }
    // UV вдоль рёбер: полосы на текстуре закручиваются вместе с рельефом
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, Math.atan2(p.getZ(i), p.getX(i)) / (Math.PI * 2) + 0.5, p.getY(i) / h);
    const m = this.mesh(geo, mat, x, y, z);
    if (cross) this.cross(r * 0.55, x, y + h, z, gold);
    return m;
  }
  // Шлемовидная глава (древние храмы домонгольской Руси)
  helmet(r, h, mat, x, y, z, gold) {
    const prof = [[1, 0], [1, 0.25], [0.92, 0.5], [0.6, 0.8], [0.25, 0.95], [0.04, 1]];
    const curve = new THREE.SplineCurve(prof.map(([a, b]) => new THREE.Vector2(a * r, b * h)));
    const geo = new THREE.LatheGeometry([new THREE.Vector2(0, 0), ...curve.getPoints(30)], 48);
    const m = this.mesh(geo, mat, x, y, z);
    this.cross(r * 0.5, x, y + h, z, gold);
    return m;
  }
  cross(s, x, y, z, gold) {
    this.box(s * 0.07, s * 1.2, s * 0.07, gold, x, y, z);
    this.box(s * 0.6, s * 0.07, s * 0.07, gold, x, y + s * 0.8, z);
    this.box(s * 0.42, s * 0.06, s * 0.06, gold, x, y + s * 0.45, z, { rz: 0.35 });
  }
  // Арочные окна/ниши по кругу барабана
  roundWindows(r, n, w, h, mat, x, y, z) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.archWindow(w, h, mat, x + Math.cos(a) * (r + 0.02), y, z + Math.sin(a) * (r + 0.02), -a + Math.PI / 2);
    }
  }
  // Плоская арка-окно, развёрнутая наружу; y — низ окна
  archWindow(w, h, mat, x, y, z, ry = 0) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.closePath();
    const geo = new THREE.ShapeGeometry(s, 10);
    return this.mesh(geo, mat, x, y, z, { ry, shadow: false });
  }
  // Ряд окон на плоской стене вдоль оси x (стена смотрит в +z при ry = 0)
  windowRow(n, span, w, h, mat, x, y, z, ry = 0) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const dx = Math.cos(ry) * t * span, dz = -Math.sin(ry) * t * span;
      this.archWindow(w, h, mat, x + dx, y, z + dz, ry);
    }
  }
  // Колонна с базой и капителью
  column(r, h, mat, x, y, z) {
    this.box(r * 2.6, r * 0.6, r * 2.6, mat, x, y, z);
    this.drum(r, h - r * 1.4, mat, x, y + r * 0.6, z, 20);
    this.box(r * 2.8, r * 0.8, r * 2.8, mat, x, y + h - r * 0.8, z);
  }
  // Закомара — полукруглое завершение стены (z — плоскость фасада, ry — поворот)
  zakomara(w, t, mat, x, y, z, ry = 0) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.absarc(0, 0, w / 2, Math.PI, 0, true); s.lineTo(-w / 2, 0);
    const geo = uvPlanar(new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 20 }));
    geo.translate(0, 0, -t / 2);
    return this.mesh(geo, mat, x, y, z, { ry });
  }
}
export { uvPlanar, uvRound };
