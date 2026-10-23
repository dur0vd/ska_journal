// 3D-модель здания с фотографией, «наклеенной» на каркас.
// Снимок проецируется на каркас с той точки, откуда снимал фотограф (подобрана tools/calibrate.py).
// Невидимую на фото сторону шейдер берёт зеркально с видимой (храмы симметричны), остальное —
// фактурой стены с того же снимка. Окружение — тот же снимок, где здание заменено фоном,
// поднятый в рельеф по карте глубины: местность та же, что на фото, и за моделью нет пустоты.
import * as THREE from 'three';

const loadImage = (url) => new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error(url)); im.src = url; });
function pixels(im, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}
const RANGE0 = 0.035; // небо (глубина 0) — в 1/0,035 ≈ 30 раз дальше самого близкого
const tex = (im) => { const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };

const vert = `varying vec3 vW; varying vec3 vN;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const frag = `uniform sampler2D photo, depthMap, patchMap, maskMap; uniform mat4 photoVP; uniform vec3 photoEye;
  uniform vec4 patchRect; uniform float mirrorZ, useMirrorZ, mirrorX, useMirrorX, night; uniform vec3 tint;
  varying vec3 vW; varying vec3 vN;
  vec4 proj(vec3 p, vec3 n){
    vec4 c = photoVP * vec4(p, 1.); if (c.w <= 0.) return vec4(0.);
    vec2 uv = c.xy / c.w * .5 + .5;
    if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.);
    vec3 toEye = photoEye - p; float dist = length(toEye);
    float facing = dot(n, toEye / dist); if (facing < .05) return vec4(0.);
    float inv = texture2D(depthMap, uv).r; float d = inv > 0. ? 1. / inv : 1e9;
    if (dist > d + .4 + dist * .006) return vec4(0.);
    if (texture2D(maskMap, uv).r < .5) return vec4(-1.); // фотограф видел здесь небо: этой части каркаса у здания нет
    return vec4(texture2D(photo, uv).rgb, smoothstep(.05, .22, facing));
  }
  void main(){
    vec3 n = normalize(vN);
    vec4 c = proj(vW, n);
    if (c.a < 0.) discard; // каркас выступает за контур здания на снимке — срезаем
    bool sky = false;
    if (c.a < .99 && useMirrorZ > .5) { vec3 q = vW; q.z = 2. * mirrorZ - q.z; vec3 m = n; m.z = -m.z; vec4 c2 = proj(q, m); sky = c2.a < 0.; if (c2.a > c.a) c = c2; }
    if (c.a < .99 && useMirrorX > .5) { vec3 q = vW; q.x = 2. * mirrorX - q.x; vec3 m = n; m.x = -m.x; vec4 c2 = proj(q, m); sky = sky || c2.a < 0.; if (c2.a > c.a) c = c2; }
    if (sky && c.a <= 0.) discard;
    // фактура стены со снимка по трём проекциям, слегка оттенённая по стороне света
    vec3 an = abs(n); vec2 uvp = an.y > .7 ? vW.xz : (an.x > an.z ? vW.zy : vW.xy);
    vec3 fb = texture2D(patchMap, fract(uvp / 6.)).rgb * tint;
    fb *= .78 + .22 * clamp(dot(n, normalize(vec3(.3, .8, .5))), 0., 1.);
    vec3 col = mix(fb, c.rgb, c.a);
    if (night > .5) col *= vec3(.62, .58, .55) + vec3(.35, .22, .08) * smoothstep(0., 18., vW.y); // ночью — подсветка снизу
    gl_FragColor = vec4(col, 1.);
    #include <colorspace_fragment>
  }`;

// Рельеф окружения в координатах камеры снимка: вершина уходит по лучу на расстояние по глубине.
function relief(colorImg, depthImg, cols, fovY, aspect, near) {
  const rows = Math.max(2, Math.round(cols / aspect));
  const D = pixels(depthImg, cols + 1, rows + 1);
  const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  const ty = Math.tan(THREE.MathUtils.degToRad(fovY / 2)), tx = ty * aspect;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const d = D[(Math.round((1 - v) * rows) * (cols + 1) + Math.round(u * cols)) * 4] / 255;
    const dist = Math.min(near / (RANGE0 + (1 - RANGE0) * d), 3000);
    p.setXYZ(i, (u * 2 - 1) * tx * dist, (v * 2 - 1) * ty * dist, -dist);
  }
  // Треугольники на перепадах глубины (край дерева на фоне неба) убираем: предметы становятся
  // отдельными объёмными слоями, и при облёте между ними видно небо и землю, а не растянутые полосы.
  // Скачок — это перепад, много больший, чем у соседних клеток: плавный наклон близкой земли не рвём.
  const W = cols + 1, at = (x, y) => D[(y * W + x) * 4] / 255, keep = [];
  const dv = (x, y) => (y < 0 || y >= rows ? null : Math.abs(at(x, y + 1) - at(x, y)));
  const dh = (x, y) => (x < 0 || x >= cols ? null : Math.abs(at(x + 1, y) - at(x, y)));
  const jump = (d, a, b) => d > 0.035 && d > 2.5 * Math.max(0.004, Math.min(a ?? b ?? d, b ?? a ?? d));
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const cut = jump(dv(x, y), dv(x, y - 1), dv(x, y + 1)) || jump(dv(x + 1, y), dv(x + 1, y - 1), dv(x + 1, y + 1))
      || jump(dh(x, y), dh(x - 1, y), dh(x + 1, y)) || jump(dh(x, y + 1), dh(x - 1, y + 1), dh(x + 1, y + 1));
    if (cut) continue;
    // вершины сетки PlaneGeometry: строка 0 — верх (v = 1)
    const a = y * W + x, b = (y + 1) * W + x;
    keep.push(a, b, a + 1, b, b + 1, a + 1);
  }
  geo.setIndex(keep);
  geo.computeBoundingSphere();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex(colorImg), transparent: true }));
}

export async function modelScene(renderer, key, mod, photoUrl, { small = false } = {}) {
  const base = `img/scene/model/${key}/`;
  const calib = await fetch(base + 'calib.json').then((r) => r.json());
  const [photo, env, envDepth] = await Promise.all([
    loadImage(calib.clean ? base + 'clean.jpg' : photoUrl), loadImage(base + 'env.jpg'), loadImage(base + 'env-depth.jpg'),
  ]);
  // контур здания на снимке (необязателен): точки каркаса, попавшие на небо, берут фактуру с другой стороны
  const silhouette = calib.mask ? await loadImage(base + 'mask.png') : null;
  const scene = new THREE.Scene();
  // камера фотографа
  const photoCam = new THREE.PerspectiveCamera(calib.fov, calib.aspect, 0.5, 5000);
  photoCam.position.fromArray(calib.eye); photoCam.lookAt(new THREE.Vector3().fromArray(calib.target)); photoCam.updateMatrixWorld(true);
  const photoVP = new THREE.Matrix4().multiplyMatrices(photoCam.projectionMatrix, photoCam.matrixWorldInverse);

  // каркас
  const model = mod.build(); model.updateMatrixWorld(true);
  // глубина каркаса с точки фотографа — чтобы не наклеивать фото на заслонённые части
  const depthRT = new THREE.WebGLRenderTarget(1024, Math.round(1024 / calib.aspect), { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const distMat = new THREE.ShaderMaterial({
    uniforms: { eye: { value: photoCam.position } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 eye; varying vec3 vW; void main(){ gl_FragColor = vec4(1. / length(vW - eye), 0., 0., 1.); }', // 1/расстояние: пустота = 0 = бесконечно далеко
  });
  const depthScene = new THREE.Scene(); depthScene.add(model); depthScene.overrideMaterial = distMat;
  const prevTarget = renderer.getRenderTarget(), prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(depthRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(depthScene, photoCam);
  renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha);
  depthScene.remove(model);

  // фактура стены — вырезка со снимка
  const [px, py, pw, ph] = mod.PATCH;
  const pc = document.createElement('canvas'); pc.width = pc.height = 256;
  pc.getContext('2d').drawImage(photo, px * photo.naturalWidth, py * photo.naturalHeight, pw * photo.naturalWidth, ph * photo.naturalHeight, 0, 0, 256, 256);
  const patch = new THREE.CanvasTexture(pc); patch.colorSpace = THREE.SRGBColorSpace; patch.wrapS = patch.wrapT = THREE.RepeatWrapping;

  const photoTex = tex(photo);
  const maskTex = silhouette ? new THREE.Texture(silhouette) : new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  maskTex.needsUpdate = true;
  const night = { value: 0 };
  const tints = { wall: [1, 1, 1], roof: [0.42, 0.46, 0.5], dome: [0.72, 0.76, 0.82], gold: [1.05, 0.82, 0.38] };
  const materials = [];
  model.traverse((m) => {
    if (!m.isMesh) return;
    const u = m.userData;
    m.material = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: {
        photo: { value: photoTex }, maskMap: { value: maskTex }, depthMap: { value: depthRT.texture }, patchMap: { value: patch },
        photoVP: { value: photoVP }, photoEye: { value: photoCam.position }, patchRect: { value: new THREE.Vector4() },
        mirrorZ: { value: u.mirrorZ ?? 0 }, useMirrorZ: { value: u.mirrorZ == null ? 0 : 1 },
        mirrorX: { value: u.mirrorX ?? 0 }, useMirrorX: { value: u.mirrorX == null ? 0 : 1 },
        tint: { value: new THREE.Vector3(...(tints[u.kind] || tints.wall)) }, night,
      },
    });
    materials.push(m.material);
  });
  scene.add(model);

  // окружение: расстояние до здания на снимке = расстояние от фотографа до центра здания
  const center = new THREE.Vector3().fromArray(mod.CENTER);
  const toBuilding = photoCam.position.distanceTo(center) * 0.85;
  const near = toBuilding * (RANGE0 + (1 - RANGE0) * calib.buildingDepth);
  const envMesh = relief(env, envDepth, small ? 180 : 280, calib.fov, calib.aspect, near);
  envMesh.applyMatrix4(photoCam.matrixWorld);
  envMesh.renderOrder = -1;
  scene.add(envMesh);
  // Задник — тот же снимок окружения плоско и очень далеко: в разрывах рельефа (край дерева на фоне неба)
  // видно родное небо снимка, а не подложку
  const BACK = 3000, bty = Math.tan(THREE.MathUtils.degToRad(calib.fov / 2));
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2 * bty * calib.aspect * BACK, 2 * bty * BACK), new THREE.MeshBasicMaterial({ map: envMesh.material.map, depthWrite: false, fog: false }));
  backdrop.position.set(0, 0, -BACK); backdrop.applyMatrix4(photoCam.matrixWorld); backdrop.renderOrder = -1.5;
  scene.add(backdrop);
  // Небо и земля вокруг — цвета и трава с того же снимка: при облёте за краем кадра продолжается та же местность
  const cs = document.createElement('canvas'); cs.width = 1; cs.height = 64;
  const cg = cs.getContext('2d'), grad = cg.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, calib.skyTop || '#6f98c8'); grad.addColorStop(1, calib.skyHorizon || '#c9d6e2');
  cg.fillStyle = grad; cg.fillRect(0, 0, 1, 64);
  const skyTex = new THREE.CanvasTexture(cs); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.05), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false }));
  // развёртка: верх снимка — зенит, середина — горизонт
  const suv = sky.geometry.attributes.uv; for (let i = 0; i < suv.count; i++) suv.setXY(i, 0.5, 1 - suv.getY(i));
  sky.position.copy(center); sky.position.y = 0; sky.renderOrder = -3;
  const gc = document.createElement('canvas'); gc.width = gc.height = 256;
  const [gx, gy, gw, gh] = mod.GROUND_PATCH || [0.25, 0.97, 0.15, 0.03];
  gc.getContext('2d').drawImage(photo, gx * photo.naturalWidth, gy * photo.naturalHeight, gw * photo.naturalWidth, gh * photo.naturalHeight, 0, 0, 256, 256);
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace; gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(160, 160);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 48), new THREE.MeshBasicMaterial({ map: gt, depthWrite: false })); // земля-подложка не заслоняет рельеф со снимка
  ground.rotation.x = -Math.PI / 2; ground.position.set(center.x, (mod.GROUND ?? 0) - 0.05, center.z); ground.renderOrder = -2;
  scene.add(sky, ground);
  scene.background = new THREE.Color(calib.skyHorizon || '#c9d6e2');
  scene.fog = new THREE.Fog(calib.skyHorizon || '#c9d6e2', 700, 3400);

  // орбита вокруг центра здания, начиная с точки фотографа
  const rel = photoCam.position.clone().sub(center);
  const orbit = { az: Math.atan2(rel.x, rel.z), el: Math.asin(rel.y / rel.length()), dist: rel.length(), lookY: new THREE.Vector3().fromArray(calib.target).sub(photoCam.position).normalize() };
  return {
    scene, center, orbit, photoCam, range: mod.ORBIT ?? 0.4, fovY: calib.fov, aspect: calib.aspect, envMat: envMesh.material, materials,
    setNight(on) { night.value = on ? 1 : 0; for (const m of [envMesh.material, sky.material, ground.material, backdrop.material]) m.color.set(on ? '#3a4560' : '#ffffff'); scene.background.set(on ? '#1b2233' : calib.skyHorizon || '#c9d6e2'); },
    // кадр как у фотоаппарата: снимок заполняет экран без полей
    fit(camera) {
      const t = Math.tan(THREE.MathUtils.degToRad(calib.fov / 2));
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(camera.aspect > calib.aspect ? t * calib.aspect / camera.aspect : t)) * 0.96;
      camera.updateProjectionMatrix();
    },
    // камера: daz — поворот вокруг здания от точки съёмки, k — во сколько ближе, del — подъём
    place(camera, daz = 0, k = 1, del = 0) {
      const az = orbit.az + daz, el = orbit.el + del, dist = orbit.dist * k;
      camera.position.set(center.x + Math.sin(az) * Math.cos(el) * dist, center.y + Math.sin(el) * dist, center.z + Math.cos(az) * Math.cos(el) * dist);
      // смотрим туда же, куда фотограф, и плавно доворачиваем на здание при облёте
      const look = photoCam.position.clone().addScaledVector(orbit.lookY, 60);
      const towards = center.clone();
      camera.lookAt(look.lerp(towards, Math.min(1, Math.abs(daz) * 2 + (1 - k))));
    },
  };
}
