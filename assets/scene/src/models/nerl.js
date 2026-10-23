// Церковь Покрова на Нерли (1165). Каркас по снимку с реки: 1 px ≈ 3,2 см, план квадратный,
// по три закомары на фасаде, высокий барабан и луковичная глава. Холм и река — со снимка.
import { Kit } from './kit.js';

export const PHOTO = 'nerl';
export const CENTER = [0, 8, -5.35];
export const PATCH = [0.405, 0.52, 0.03, 0.05];
export const ORBIT = 0.14; // деревья на переднем плане близко — облёт небольшой
export const GROUND = -9; // река ниже холма с храмом
export const GROUND_PATCH = [0.42, 0.64, 0.12, 0.04];
export function build() {
  const k = new Kit();
  const W = 10.7, c = -W / 2, sym = { mirrorZ: c, mirrorX: 0 };
  k.box(W, 8.9, W, 0, 0, c, sym);
  k.zakomaras(-W / 2, -W / 6, 1, 8.9, 0, W, sym);
  k.zakomaras(-W / 6, W / 6, 1, 9.6, 0, W, sym);
  k.zakomaras(W / 6, W / 2, 1, 8.9, 0, W, sym);
  k.box(W - 1, 1.6, W - 1, 0, 8.9, c, { kind: 'roof', ...sym });
  k.drum(1.76, 4.6, 0, 10.4, c);
  k.dome(2.15, 3.4, 0, 15, c, 'onion');
  k.cross(2.4, 0, 18.4, c);
  // три апсиды с востока (на снимке не видны — покрываются фактурой стены)
  for (const t of [-3.4, 0, 3.4]) k.drum(t ? 1.5 : 2, 7.4, t, 0, -W, { mirrorZ: null });
  return k.group;
}
