# Фигуры исторических личностей: python3 tools/figures.py папка-с-портретами img/scene/fig (нужны rembg, transformers, torch).
# Вырезает фигуру из портрета (rembg) и считает рельеф (Depth Anything): PNG с прозрачностью + карта глубины.
import sys, os
from PIL import Image, ImageFilter
from rembg import remove, new_session
from transformers import pipeline
sess = new_session('isnet-general-use')
depth = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device='cpu')
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True); os.makedirs(os.path.join(out, 'depth'), exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith('.jpg'): continue
    im = Image.open(os.path.join(src, f)).convert('RGB')
    cut = remove(im, session=sess, post_process_mask=True)
    bbox = cut.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
    cut = cut.crop(bbox); rgb = im.crop(bbox)
    if cut.height > 1400: cut = cut.resize((round(cut.width * 1400 / cut.height), 1400), Image.LANCZOS); rgb = rgb.resize(cut.size, Image.LANCZOS)
    d = depth(rgb)['depth'].convert('L').resize((cut.width // 2, cut.height // 2), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    name = f[:-4]
    cut.save(os.path.join(out, name + '.png'), optimize=True)
    d.save(os.path.join(out, 'depth', name + '.jpg'), quality=85)
    print(name, cut.size, flush=True)
