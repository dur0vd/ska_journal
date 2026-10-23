# Карты глубины для фона сайта (объём при движении мыши): img/scene/*.jpg -> img/scene/depth/*.jpg.
# Запуск: pip install torch transformers pillow && python3 tools/depth-maps.py img/scene img/scene/depth
import sys, os, torch
from PIL import Image, ImageFilter
from transformers import pipeline
pipe = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device='cpu')
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith('.jpg'): continue
    im = Image.open(os.path.join(src, f)).convert('RGB')
    d = pipe(im)['depth'].convert('L').resize((im.width // 2, im.height // 2), Image.BICUBIC)
    # Сглаживаем края, чтобы при сдвиге фон «тянулся», а не рвался.
    d = d.filter(ImageFilter.GaussianBlur(3))
    d.save(os.path.join(out, f), quality=85)
    print(f, d.size, flush=True)
