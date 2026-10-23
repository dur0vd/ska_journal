# Окружение для 3D-модели: со снимка убирается здание (по маске) и дорисовывается фон — небо, трава,
# деревья, — то же для карты глубины. Модель встаёт на место здания, а за ней нет пустоты.
# Рядом можно положить маски «-sky» (небо) и «-people» (люди, машины) — tools/seg.py.
# Запуск: python3 tools/environment.py снимок.jpg глубина.jpg маска.png папка-вывода [x0,x1] [линия земли, доля высоты]
import sys, os, numpy as np, cv2
photo, depth, mask_p, out = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
img = cv2.imread(photo); dep = cv2.imread(depth, cv2.IMREAD_GRAYSCALE)
# люди и машины (маска «-people» рядом с маской здания) убираются: при облёте они растягивались бы в полосы
ppl_p = mask_p.replace('-building', '-people')
if os.path.exists(ppl_p):
    pm = cv2.resize(cv2.imread(ppl_p, cv2.IMREAD_GRAYSCALE), (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
    pm = cv2.dilate((pm > 127).astype(np.uint8) * 255, np.ones((31, 15), np.uint8))
    # по строкам: дыру закрывает зеркальное отражение соседей слева и справа — сохраняется фактура травы и дорожек
    for y in np.nonzero(pm.any(axis=1))[0]:
        row = pm[y] > 0; xs = np.flatnonzero(np.diff(np.r_[0, row.astype(np.int8), 0]))
        for a, b in zip(xs[::2], xs[1::2]):
            n = b - a
            for i in range(n):
                l, r = a - 1 - i, b + (n - 1 - i)
                src = l if (i < n / 2 and l >= 0) or r >= img.shape[1] else r
                img[y, a + i] = img[y, min(max(src, 0), img.shape[1] - 1)]
    soft = cv2.GaussianBlur(img, (0, 0), 1.5); img = np.where(pm[..., None] > 0, soft, img)
    # снимок без людей — его же наклеивают на каркас (иначе люди «ложатся» на склон и стены)
    cv2.imwrite(os.path.join(out, 'clean.jpg'), img, [cv2.IMWRITE_JPEG_QUALITY, 82])
    pd = cv2.resize(pm, (dep.shape[1], dep.shape[0]), interpolation=cv2.INTER_NEAREST)
    # глубина на месте людей — как у земли рядом: по строке линейно между краями (земля ровная поперёк кадра)
    dep = dep.astype(np.float32)
    for y in np.nonzero(pd.any(axis=1))[0]:
        row = pd[y] > 0; xs = np.flatnonzero(np.diff(np.r_[0, row.astype(np.int8), 0]))
        for a, b in zip(xs[::2], xs[1::2]):
            l = dep[y, a - 1] if a > 0 else dep[y, min(b, dep.shape[1] - 1)]
            r = dep[y, b] if b < dep.shape[1] else l
            dep[y, a:b] = np.linspace(l, r, b - a + 2)[1:-1]
    dep = dep.astype(np.uint8)
m = cv2.imread(mask_p, cv2.IMREAD_GRAYSCALE)
m = cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
if len(sys.argv) > 5:
    a, b = map(float, sys.argv[5].split(',')); keep = np.zeros_like(m); keep[:, int(a * m.shape[1]):int(b * m.shape[1])] = 255; m = cv2.bitwise_and(m, keep)
m = cv2.dilate((m > 127).astype(np.uint8) * 255, np.ones((15, 15), np.uint8))
# Фон за зданием: в каждом столбце выше линии земли тянем вниз цвет неба/деревьев над зданием,
# ниже — цвет земли под ним; затем сглаживаем и добавляем лёгкую текстуру шумом.
H, Wd = m.shape
horizon = int(H * float(sys.argv[6])) if len(sys.argv) > 6 else None
env = img.copy().astype(np.float32)
for x in range(Wd):
    col = np.nonzero(m[:, x])[0]
    if not len(col): continue
    top, bot = col.min(), col.max()
    hz = horizon if horizon is not None else bot
    above = img[max(top - 6, 0), x].astype(np.float32); below = img[min(bot + 6, H - 1), x].astype(np.float32)
    for y in col: env[y, x] = above if y < hz else below
blur = cv2.GaussianBlur(env, (0, 0), sigmaX=60, sigmaY=12)
env = np.where(m[..., None] > 0, blur + np.random.normal(0, 3, env.shape), img).clip(0, 255).astype(np.uint8)
cv2.imwrite(os.path.join(out, 'env.jpg'), env, [cv2.IMWRITE_JPEG_QUALITY, 82])
md = cv2.resize(m, (dep.shape[1], dep.shape[0]), interpolation=cv2.INTER_NEAREST)
# глубина за зданием — как у фона по краю маски (дальше здания), а не как у самого здания
envd = cv2.inpaint(dep, md, 15, cv2.INPAINT_TELEA)
envd = np.where(md > 0, np.minimum(envd, (dep.astype(np.float32) * 0.55)).astype(np.uint8), dep)  # фон за зданием — заведомо дальше здания
# небо — бесконечно далеко: и вокруг здания, и за ним выше линии земли (иначе рельеф неба рвётся по краям глав)
sky_p = mask_p.replace('-building', '-sky')
if os.path.exists(sky_p):
    skd = cv2.resize(cv2.imread(sky_p, cv2.IMREAD_GRAYSCALE), (dep.shape[1], dep.shape[0]), interpolation=cv2.INTER_NEAREST) > 127
    behind = (md > 0) & (np.arange(dep.shape[0])[:, None] < (horizon or 0) * dep.shape[0] / H)
    envd[skd | behind] = 0
cv2.imwrite(os.path.join(out, 'env-depth.jpg'), envd, [cv2.IMWRITE_JPEG_QUALITY, 90])
# цвета неба (зенит и у горизонта) по маске неба, если она есть рядом с маской здания
if os.path.exists(sky_p):
    sk = cv2.resize(cv2.imread(sky_p, cv2.IMREAD_GRAYSCALE), (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST) > 127
    rows = np.nonzero(sk.any(axis=1))[0]
    if len(rows):
        top = img[rows[0]:rows[0] + max(1, len(rows) // 5)][sk[rows[0]:rows[0] + max(1, len(rows) // 5)]].mean(axis=0)
        low = img[rows[-1] - max(1, len(rows) // 5):rows[-1] + 1][sk[rows[-1] - max(1, len(rows) // 5):rows[-1] + 1]].mean(axis=0)
        hexc = lambda c: '#%02x%02x%02x' % (int(c[2]), int(c[1]), int(c[0]))
        print('небо', hexc(top), hexc(low))
# медиана глубины здания — чтобы согласовать масштаб окружения с моделью
print(os.path.basename(photo), 'медиана глубины здания', float(np.median(dep[md > 0])) / 255)
