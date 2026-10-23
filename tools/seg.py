# Маски «здание», «небо» и «люди» (люди и машины — их убирают из окружения) для снимков (SegFormer, классы ADE20K).
# Запуск: python3 tools/seg.py папка-снимков папка-масок basil,peterhof,...
import sys, os, numpy as np
from PIL import Image
from transformers import pipeline
seg = pipeline('image-segmentation', model='nvidia/segformer-b2-finetuned-ade-512-512', device='cpu')
src, out, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
os.makedirs(out, exist_ok=True)
for n in names:
    im = Image.open(os.path.join(src, n + '.jpg')).convert('RGB')
    small = im.copy(); small.thumbnail((1024, 1024))
    res = seg(small)
    b = np.zeros((small.height, small.width), bool); sky = b.copy(); ppl = b.copy()
    for r in res:
        m = np.array(r['mask']) > 127
        if r['label'] in ('building', 'house', 'tower', 'skyscraper', 'church', 'column, pillar', 'dome'): b |= m
        if r['label'] == 'sky': sky |= m
        if r['label'] in ('person', 'car', 'truck', 'van', 'bus', 'minibike', 'bicycle', 'umbrella', 'animal'): ppl |= m
    Image.fromarray((b * 255).astype('uint8')).save(os.path.join(out, n + '-building.png'))
    Image.fromarray((sky * 255).astype('uint8')).save(os.path.join(out, n + '-sky.png'))
    Image.fromarray((ppl * 255).astype('uint8')).save(os.path.join(out, n + '-people.png'))
    print(n, small.size, sorted({r['label'] for r in res}))
