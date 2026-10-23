// Долина истории: река, озеро с островом, холмы и лес; на ней — шесть построек.
// День — низкое солнце и небо с рассеянием (Sky); ночь — луна, звёзды и подсветка зданий.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { makeMaterials, fbm, rnd } from './materials.js';
import { spasskaya } from './buildings/spasskaya.js';
import { basil } from './buildings/basil.js';
import { nerl } from './buildings/nerl.js';
import { kizhi } from './buildings/kizhi.js';
import { sophia } from './buildings/sophia.js';
import { mokhovaya } from './buildings/mokhovaya.js';

// Площадки построек: место, ровная площадка вокруг и откуда на них смотреть (азимут, высота, расстояние).
// view: [азимут камеры от здания, расстояние, высота камеры, высота точки взгляда] — главный фасад в три четверти.
const SITES = {
  spasskaya: { at: [-30, 0], flat: 120, view: [1.15, 100, 22, 42] },
  basil: { at: [90, 70], flat: 90, view: [-0.15, 105, 18, 28] },
  mokhovaya: { at: [-260, -160], flat: 90, view: [0.65, 82, 10, 14] },
  sophia: { at: [-560, -360], flat: 110, view: [1.05, 82, 12, 20] },
  nerl: { at: [560, 470], flat: 50, view: [-1.0, 58, 7, 12] },
  kizhi: { at: [-720, 1060], flat: 70, view: [0.95, 76, 12, 17] },
};
const RIVER = [[-2400, 420], [-1300, 360], [-500, 520], [-60, 240], [380, 260], [720, 600], [1300, 720], [2400, 640]];
const LAKE = { at: [-720, 1060], r: 380, island: 110 };

function distToPolyline(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 3 + fbm(x * 0.002 + 10, z * 0.002) * 10;
  h += Math.max(0, r - 900) * 0.09 * fbm(x * 0.001, z * 0.001 + 5) * 2; // холмы по краям долины
  const dr = distToPolyline(x, z, RIVER);
  h = Math.min(h, -3 + Math.max(0, dr - 22) * 0.18 + 3 * Math.min(1, dr / 30)); // русло
  const dl = Math.hypot(x - LAKE.at[0], z - LAKE.at[1]);
  if (dl < LAKE.r + 120) h = Math.min(h, -5 + Math.max(0, dl - LAKE.r) * 0.08);
  if (dl < LAKE.island) h = Math.max(h, 2.5 - Math.max(0, dl - LAKE.island + 40) * 0.08);
  for (const s of Object.values(SITES)) { // ровные площадки под постройками
    const d = Math.hypot(x - s.at[0], z - s.at[1]);
    if (d < s.flat * 1.8) h += (1.2 - h) * Math.max(0, Math.min(1, (s.flat * 1.8 - d) / (s.flat * 0.8)));
  }
  return h;
}

function terrain(M, quality) {
  const size = 5200, seg = quality > 1 ? 320 : 200;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  // пятна разнотравья, сухой травы и тёмной зелени — чтобы луг не был однотонным
  const col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = fbm(x * 0.006, z * 0.006), b = fbm(x * 0.02 + 7, z * 0.02);
    c.setHSL(0.2 + a * 0.08, 0.32 + b * 0.18, 0.42 + (b - 0.5) * 0.18);
    if (y < 0.4) c.lerp(new THREE.Color('#8a7a5a'), Math.min(1, (0.4 - y) / 2)); // песчаный берег
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  M.meadow = M.grass.clone(); M.meadow.color.set('#7c9a52'); // для холмов-подиумов без цвета вершин
  M.grass.vertexColors = true;
  const m = new THREE.Mesh(geo, M.grass);
  m.receiveShadow = true;
  return m;
}

function waterNormal() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'), img = g.createImageData(s, s);
  const H = (x, y) => fbm(x / s * 8, y / s * 8, 3);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 6, dy = (H(x, y + 1) - H(x, y - 1)) * 6, l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(80, 80);
  return t;
}

// Лес: ели и берёзы, по нескольку тысяч экземпляров
function forest(quality, avoid) {
  const group = new THREE.Group();
  const n = quality > 1 ? 4200 : 1600;
  const pine = new THREE.ConeGeometry(1, 1, 7); pine.translate(0, 0.5, 0);
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const trunk = new THREE.CylinderGeometry(0.12, 0.18, 1, 5); trunk.translate(0, 0.5, 0);
  const mPine = new THREE.MeshStandardMaterial({ color: '#2c4a32', roughness: 0.95, flatShading: true });
  const mBirch = new THREE.MeshStandardMaterial({ color: '#7a9a4a', roughness: 0.9, flatShading: true });
  const mBark = new THREE.MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.9 });
  const pines = new THREE.InstancedMesh(pine, mPine, n * 2), birches = new THREE.InstancedMesh(crown, mBirch, n), trunks = new THREE.InstancedMesh(trunk, mBark, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color();
  let ip = 0, ib = 0;
  for (let i = 0; i < n * 3 && (ip < n * 2 - 2 || ib < n - 1); i++) {
    const x = (rnd() - 0.5) * 4200, z = (rnd() - 0.5) * 4200, h = heightAt(x, z);
    if (h < 0.8 || fbm(x * 0.004, z * 0.004 + 3) < 0.48) continue; // поляны и вода
    if (Object.values(SITES).some((s) => Math.hypot(x - s.at[0], z - s.at[1]) < s.flat * 1.3)) continue;
    if (x > -60 && x < 180 && z > -120 && z < 180) continue; // площадь
    if (avoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < 45)) continue; // не заслонять вид
    const s = 6 + rnd() * 10;
    if (rnd() < 0.62 && ip < n * 2 - 2) {
      q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0));
      m.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(s * 0.32, s * 1.6, s * 0.32)); pines.setMatrixAt(ip, m);
      color.setHSL(0.36 + rnd() * 0.04, 0.35, 0.2 + rnd() * 0.08); pines.setColorAt(ip++, color);
      m.compose(new THREE.Vector3(x, h + s * 0.55, z), q, new THREE.Vector3(s * 0.24, s * 1.15, s * 0.24)); pines.setMatrixAt(ip, m); pines.setColorAt(ip++, color);
    } else if (ib < n - 1) {
      m.compose(new THREE.Vector3(x, h + s * 0.95, z), q, new THREE.Vector3(s * 0.38, s * 0.55, s * 0.38)); birches.setMatrixAt(ib, m);
      color.setHSL(0.17 + rnd() * 0.08, 0.45, 0.32 + rnd() * 0.12); birches.setColorAt(ib, color);
      m.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(s * 0.08 + 0.3, s * 0.8, s * 0.08 + 0.3)); trunks.setMatrixAt(ib++, m);
    }
  }
  pines.count = ip; birches.count = ib; trunks.count = ib;
  for (const t of [pines, birches, trunks]) { t.castShadow = true; t.receiveShadow = true; group.add(t); }
  return group;
}

function nightSky() {
  return new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 p;
      float h(vec3 v){ return fract(sin(dot(v, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){
        float y = max(p.y, 0.);
        vec3 c = mix(vec3(.10,.10,.20), vec3(.01,.015,.05), smoothstep(0., .5, y));
        c += vec3(.25,.16,.10) * exp(-y * 14.) * .5; // зарево города у горизонта
        vec3 g = floor(p * 900.); float s = step(.9985, h(g)) * smoothstep(.05, .3, y);
        c += s * (.6 + .4 * h(g + 1.));
        vec3 moon = normalize(vec3(-.5,.35,.6)); float d = distance(p, moon);
        c += vec3(1.,.97,.9) * smoothstep(.022,.018,d) + vec3(.35,.4,.55) * exp(-d * 18.) * .5;
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
}

export function buildWorld(renderer, scene, quality) {
  const M = makeMaterials();
  const env = new THREE.PMREMGenerator(renderer);
  // день: небо с рассеянием света
  const sky = new Sky(); sky.scale.setScalar(4500);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(76), THREE.MathUtils.degToRad(215));
  sky.material.uniforms.turbidity.value = 5; sky.material.uniforms.rayleigh.value = 1.6;
  sky.material.uniforms.mieCoefficient.value = 0.006; sky.material.uniforms.mieDirectionalG.value = 0.85;
  sky.material.uniforms.sunPosition.value.copy(sunDir);
  const night = nightSky();
  const envScene = new THREE.Scene();
  envScene.add(sky);
  const dayEnv = env.fromScene(envScene, 0.02).texture;
  envScene.remove(sky); envScene.add(night);
  const nightEnv = env.fromScene(envScene, 0.02).texture;
  envScene.remove(night);
  scene.add(sky, night);

  const hemi = new THREE.HemisphereLight('#bcd2ff', '#5a4a30', 0.9);
  const sun = new THREE.DirectionalLight('#ffd9a8', 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality > 1 ? 4096 : 2048, quality > 1 ? 4096 : 2048);
  Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 1600 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(hemi, sun, sun.target);

  scene.add(terrain(M, quality));
  // площадь между Кремлём и Покровским собором
  const sq = new THREE.Mesh(new THREE.PlaneGeometry(150, 190), M.cobble); sq.rotation.x = -Math.PI / 2; sq.position.set(42, 1.25, 30); sq.receiveShadow = true;
  scene.add(sq);
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3a5658', roughness: 0.1, metalness: 0.7, normalMap: waterNormal(), normalScale: new THREE.Vector2(0.35, 0.35) });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = -0.6;
  scene.add(water);

  const world = new THREE.Group(); world.position.y = 1.2; scene.add(world); world.updateMatrixWorld(true);
  const P = {};
  const place = (key, fn, rot = 0) => {
    const [x, z] = SITES[key].at;
    P[key] = fn(world, M, x, z, rot);
    const [az, dist, ch, ly] = SITES[key].view;
    const cx = x + Math.sin(az) * dist, cz = z + Math.cos(az) * dist;
    P[key].shot = { pos: new THREE.Vector3(cx, Math.max(heightAt(cx, cz), 0) + ch, cz), look: new THREE.Vector3(x, ly, z) };
  };
  place('spasskaya', spasskaya);
  place('basil', basil, 0.4);
  place('mokhovaya', mokhovaya, 0.2);
  place('sophia', sophia, 0.5);
  place('nerl', nerl, Math.PI);
  place('kizhi', kizhi, 0.3);
  world.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(forest(quality, Object.values(P).flatMap((b) => [[b.shot.pos.x, b.shot.pos.z], [(b.shot.pos.x + b.center.x) / 2, (b.shot.pos.z + b.center.z) / 2]])));

  // Ночная подсветка: прожекторы переезжают к зданию, на которое смотрит камера.
  const floods = [0, 1, 2].map(() => { const s = new THREE.SpotLight('#ffd6a0', 0, 300, 0.5, 0.7, 2); scene.add(s, s.target); return s; });
  const lamps = new THREE.Group(); scene.add(lamps);

  const fogDay = new THREE.FogExp2('#c4cfd9', 0.00026), fogNight = new THREE.FogExp2('#0d1222', 0.0005);
  const floodMats = [M.brick, M.stone, M.plaster, M.ochre, M.white, M.logs, M.tent, M.tile, M.shingle];
  return {
    P, M, water: waterMat,
    setNight(on) {
      scene.environment = on ? nightEnv : dayEnv;
      scene.fog = on ? fogNight : fogDay;
      sky.visible = !on; night.visible = on;
      hemi.color.set(on ? '#4a5a8a' : '#bcd2ff'); hemi.groundColor.set(on ? '#1a1410' : '#5a4a30'); hemi.intensity = on ? 0.35 : 0.9;
      sun.color.set(on ? '#9fb4ff' : '#ffd9a8'); sun.intensity = on ? 0.55 : 3.2;
      sun.userData.dir = on ? new THREE.Vector3(-0.5, 0.35, 0.6).normalize() : sunDir;
      for (const m of floodMats) { m.emissive.set(on ? '#ffb070' : '#000000'); m.emissiveMap = m.map; m.emissiveIntensity = on ? 0.16 : 0; m.needsUpdate = true; }
      M.window.emissiveIntensity = on ? 1.6 : 0;
      M.clock.emissiveIntensity = on ? 0.9 : 0;
      M.ruby.emissiveIntensity = on ? 3 : 0.4;
      for (const f of floods) f.intensity = 0;
      this.night = on;
    },
    // Следим за точкой, куда смотрит камера: тени и прожекторы рядом с ней.
    focus(look, key) {
      sun.position.copy(look).addScaledVector(sun.userData.dir || sunDir, 700);
      sun.target.position.copy(look);
      const site = key && P[key];
      if (this.night && site) {
        floods.forEach((f, i) => {
          const fl = site.flood[i % site.flood.length];
          f.position.set(fl[0], 3, fl[1]); f.target.position.copy(site.center); f.intensity = 2.5 * f.position.distanceToSquared(site.center);
        });
      }
    },
    tick(t) { waterMat.normalMap.offset.set(t * 0.004, t * 0.003); },
  };
}
export { SITES };
