# Подбирает камеру фотографа: положение, поворот и угол обзора, при которых контур каркаса
# совпадает с контуром здания на снимке (маска SegFormer). Результат — img/scene/model/<ключ>/calib.json.
# Запуск: python3 tools/calibrate.py модель.json маска.png выход.json [x0,x1 — полоса снимка] [начальная камера JSON]
import sys, json, math, numpy as np
from PIL import Image, ImageDraw
from scipy.optimize import minimize

model = json.load(open(sys.argv[1]))
T = np.array(model['tris'], dtype=np.float64).reshape(-1, 3, 3)
mask_img = Image.open(sys.argv[2]).convert('L')
W = 384; H = round(W * mask_img.height / mask_img.width)
mask = np.array(mask_img.resize((W, H))) > 127
if len(sys.argv) > 4:  # поле поиска: доли ширины, вне его маска не учитывается
    a, b = map(float, sys.argv[4].split(','))
    keep = np.zeros_like(mask); keep[:, int(a * W):int(b * W)] = True
else: keep = np.ones_like(mask)
mask &= keep
cx, cy, cz = model['center']

def view(p):
    # p: азимут и высота камеры относительно центра (рад), расстояние, сдвиг взгляда, верт. угол обзора
    az, el, dist, lx, ly, fov = p
    eye = np.array([cx + math.sin(az) * math.cos(el) * dist, cy + math.sin(el) * dist, cz + math.cos(az) * math.cos(el) * dist])
    tgt = np.array([cx + lx, cy + ly, cz])
    f = tgt - eye; f /= np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    return eye, r, u, f, fov

def render(p):
    eye, r, u, f, fov = view(p)
    P = T - eye
    x, y, z = P @ r, P @ u, P @ f
    t = math.tan(math.radians(fov) / 2)
    ok = (z > 0.5).all(axis=1)
    sx = (x / (z * t * W / H) * 0.5 + 0.5) * W
    sy = (0.5 - y / (z * t) * 0.5) * H
    img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img)
    for i in np.nonzero(ok)[0]:
        d.polygon([(sx[i, 0], sy[i, 0]), (sx[i, 1], sy[i, 1]), (sx[i, 2], sy[i, 2])], fill=255)
    return np.array(img) > 0

BOUNDS = json.loads(sys.argv[6]) if len(sys.argv) > 6 else {}  # пределы: {"el": [мин, макс], "fov": [...]}
NAMES = ['az', 'el', 'dist', 'lx', 'ly', 'fov']
def loss(p):
    if any(not (BOUNDS[n][0] <= p[i] <= BOUNDS[n][1]) for i, n in enumerate(NAMES) if n in BOUNDS): return 1.0
    if view(p)[0][1] < 1.5 or p[5] < 10 or p[5] > 90: return 1.0  # камера под землёй или невозможный объектив
    m = render(p) & keep
    inter = (m & mask).sum(); uni = (m | mask).sum()
    return 1 - inter / max(uni, 1)

# Стартовая точка: argv[5] — JSON [азимут, высота, расстояние, сдвиг x, сдвиг y, угол]; затем шаги поменьше
x0 = json.loads(sys.argv[5]) if len(sys.argv) > 5 else [0, 0.08, 80, 0, 0, 30]
steps = np.array([0.04, 0.03, 8, 2, 2, 3])
simplex = [x0] + [list(np.array(x0) + np.eye(6)[i] * steps[i]) for i in range(6)]
best = minimize(loss, x0, method='Nelder-Mead', options={'maxiter': 500, 'initial_simplex': simplex})
print('старт', x0, '→ совпадение', round(1 - best.fun, 3), flush=True)
res = minimize(loss, best.x, method='Nelder-Mead', options={'maxiter': 400})
eye, r, u, f, fov = view(res.x)
out = {'eye': eye.round(4).tolist(), 'target': (eye + f * 50).round(4).tolist(), 'fov': round(float(fov), 4), 'aspect': mask_img.width / mask_img.height, 'iou': round(1 - float(res.fun), 4)}
json.dump(out, open(sys.argv[3], 'w'), indent=1)
print('итог', out)
# наложение для проверки
m = render(res.x)
ov = np.zeros((H, W, 3), np.uint8); ov[mask] = (0, 160, 0); ov[m] += np.array((160, 0, 0), np.uint8)
Image.fromarray(ov).save(sys.argv[3].replace('.json', '-overlay.png'))
