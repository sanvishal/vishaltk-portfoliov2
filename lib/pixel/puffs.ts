import { BAYER, c, mixPacked, sprite, type Sprite } from "./frame";
import type { Time } from "./time";

/**
 * cloud tones: lit white, a very light blue, the light blue of the crescents, the shadow
 * under the base, a deeper shadow, and a lavender for the far, shaded side
 */
export const PUFF_DAY = [0xffffff, 0xe4f3ff, 0xbcdcfc, 0x8fbdf0, 0x6e9ce4, 0x9a9ce8];
export const PUFF_GOLD = [0xfff6e6, 0xffe4c4, 0xf4c4a8, 0xd49c9c, 0xa47c9c, 0xb08cc0];
export const PUFF_DUSK = [0xffd8c8, 0xf4b4b0, 0xd4909e, 0xa46c8e, 0x74507a, 0x8a6aa8];
export const PUFF_NIGHT = [0xa8b2dc, 0x8a96c8, 0x6e7ab4, 0x56609a, 0x3e4680, 0x5a5a9a];

/** the cloud tones for an hour of the day */
export const puffTones = (hour: Time["name"]) => ({ dawn: PUFF_GOLD, day: PUFF_DAY, golden: PUFF_GOLD, dusk: PUFF_DUSK, night: PUFF_NIGHT })[hour];

type Lobe = { x: number; y: number; r: number };

/**
 * a cumulus, painted the way pixel artists teach it. a silhouette from a heap of circles: a
 * tall mass a little off centre, shoulders stepping down either side, a bumpy top, a flat
 * base that thins out into long tails. then each circle is a puff lit from the upper left,
 * white with a light blue crescent on its lower right; they're laid down from the top of the
 * cloud to the bottom, so the nearer, lower puffs show their bright crowns against the
 * shadowed undersides of the ones behind. the base gets a flat band of shadow, the deep
 * shadows on the far side go lavender, and the edges fray into a few loose wisps.
 */
export function puffCloud(rand: () => number, w: number, h: number, tones: number[], haze = 0, hazeTo = 0): Sprite {
  const s = sprite(w, h);
  const owner = new Int16Array(w * h).fill(-1);
  const lobes: Lobe[] = [];
  const baseY = h * 0.84;
  const cx = w * (0.38 + rand() * 0.24);

  // the main mass: a few big lobes climbing from the base
  let x = cx;
  let y = baseY - h * 0.16;
  let r = h * (0.2 + rand() * 0.06);
  const crest = h * (0.12 + rand() * 0.12);
  while (y - r > crest) {
    lobes.push({ x, y, r });
    y -= r * (0.7 + rand() * 0.2);
    x += (rand() - 0.5) * r * 0.7;
    r *= 0.84 + rand() * 0.1;
  }
  lobes.push({ x, y: Math.max(y, crest + r), r });
  // bumps along the top of the mass
  for (let k = 0; k < 4; k++) {
    const b = lobes[Math.floor(rand() * lobes.length)];
    lobes.push({ x: b.x + (rand() - 0.5) * b.r * 1.4, y: b.y - b.r * (0.5 + rand() * 0.3), r: b.r * (0.35 + rand() * 0.2) });
  }
  // shoulders, stepping down and out to either side
  for (const side of [-1, 1]) {
    let sx = cx + side * h * (0.22 + rand() * 0.08);
    let sr = h * (0.16 + rand() * 0.05);
    while (sr > h * 0.05 && sx > w * 0.06 && sx < w * 0.94) {
      lobes.push({ x: sx, y: baseY - sr * (0.75 + rand() * 0.25), r: sr });
      if (rand() < 0.6) lobes.push({ x: sx - side * sr * 0.4, y: baseY - sr * 1.35, r: sr * 0.55 });
      sx += side * sr * (0.95 + rand() * 0.4);
      sr *= 0.68 + rand() * 0.14;
    }
  }
  // the base: a row of low lobes along a flat line
  for (let bx = w * 0.12; bx < w * 0.88; bx += h * (0.12 + rand() * 0.14)) {
    if (rand() < 0.3) continue;
    const br = h * (0.06 + rand() * 0.08);
    if (Math.abs(bx - cx) < w * 0.42) lobes.push({ x: bx, y: baseY - br * 0.45, r: br });
  }

  // keep every puff inside the picture, so none is sliced flat at an edge
  for (const lb of lobes) {
    lb.r = Math.min(lb.r, lb.y - 1, lb.x - 1, w - 2 - lb.x);
    if (lb.r < 1) lb.r = 0;
  }
  for (let k = lobes.length - 1; k >= 0; k--) if (lobes[k].r <= 0) lobes.splice(k, 1);

  // lay the puffs down from the back (top) to the front (bottom)
  lobes.sort((a, b) => a.y + a.r * 0.5 - (b.y + b.r * 0.5));
  const shade = new Uint8Array(w * h);
  for (const [li, lb] of lobes.entries()) {
    for (let py = Math.floor(lb.y - lb.r); py <= Math.ceil(lb.y + lb.r); py++) {
      if (py < 0 || py >= h || py > baseY) continue;
      for (let px = Math.floor(lb.x - lb.r); px <= Math.ceil(lb.x + lb.r); px++) {
        if (px < 0 || px >= w) continue;
        const nx = (px + 0.5 - lb.x) / lb.r;
        const ny = (py + 0.5 - lb.y) / lb.r;
        if (nx * nx + ny * ny > 1) continue;
        const i = py * w + px;
        owner[i] = li;
        // a crescent of shade on the lower right of every puff, deeper on the big ones
        const away = nx * 0.55 + ny * 0.84 + BAYER[(py & 3) * 4 + (px & 3)] * 0.12;
        const rim = Math.hypot(nx, ny);
        let t = 0;
        if (away > 0.3 && rim > 0.45 && nx > -0.2) t = lb.r > h * 0.12 && away > 0.72 ? 3 : 2;
        else if (away > 0.1 && rim > 0.6 && nx > -0.5) t = 1;
        shade[i] = t;
      }
    }
  }

  // tails: the base drawn out thin to either side
  const tailY = Math.round(baseY);
  for (const side of [-1, 1]) {
    let ex = side < 0 ? w * 0.14 : w * 0.86;
    let thick = 3;
    while (thick > 0 && ex > 1 && ex < w - 2) {
      const len = 3 + Math.floor(rand() * 7);
      for (let k = 0; k < len; k++) {
        const tx = Math.round(ex + side * k);
        if (tx < 0 || tx >= w) break;
        for (let q = 0; q < thick; q++) {
          const i = (tailY - q) * w + tx;
          if (owner[i] < 0) {
            owner[i] = 0;
            shade[i] = q === 0 ? 3 : 2;
          }
        }
      }
      ex += side * (len + (rand() < 0.3 ? 2 : 0));
      thick -= rand() < 0.55 ? 1 : 0;
    }
  }

  // contact shadows: where a puff behind meets the top of a puff in front, the one behind
  // darkens just above the line, and that's what outlines each puff
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      const o = owner[i];
      if (o < 0) continue;
      // the light comes from the left, so the shadow thickens toward each puff's right side
      const lb = lobes[o];
      const nx = (px + 0.5 - lb.x) / lb.r;
      const reach = nx < -0.45 ? 0 : nx < 0 ? 1 : nx < 0.45 ? 2 : 4;
      for (let k = 1; k <= reach; k++) {
        if (py + k >= h) break;
        const below = owner[i + k * w];
        if (below > o) {
          shade[i] = Math.max(shade[i], k === 1 && nx > 0.2 ? 3 : nx > -0.1 ? 2 : 1);
          break;
        }
        if (below !== o) break;
      }
    }

  // paint: the flat band of shadow along the base, lavender in the far shadows, the edges
  // anti-aliased in the shadow tone where they face down or away
  const band = h * 0.12;
  const bandTop = (px: number) => baseY - band + Math.sin(px * 0.35) * 1.2 + Math.sin(px * 0.11 + 2) * 1.5;
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      if (owner[i] < 0) continue;
      const dth = BAYER[(py & 3) * 4 + (px & 3)];
      let t = shade[i];
      if (py >= bandTop(px)) t = Math.max(t, py > baseY - 1.5 ? 3 : 2);
      // edges facing down or to the right soften into the shadow tone
      const below = py + 1 < h ? owner[i + w] : -1;
      const right = px + 1 < w ? owner[i + 1] : -1;
      if ((below < 0 || right < 0) && t < 2) t = 1 + (below < 0 ? 1 : 0);
      let col = tones[Math.min(4, t)];
      if (t >= 3 && px > w * 0.55 && dth > -0.2) col = tones[5];
      s.px[i] = c(col);
    }

  // loose puffs breaking off near the top and sides: small soft blobs, a little apart
  for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) {
    const left = rand() < 0.5;
    const px = left ? cx - w * (0.18 + rand() * 0.14) : cx + w * (0.14 + rand() * 0.18);
    const py = crest + h * (0.08 + rand() * 0.25);
    const bw = 2 + rand() * 2.5;
    const bh = 1.4 + rand() * 1.2;
    for (let yy = Math.floor(py - bh); yy <= Math.ceil(py + bh); yy++)
      for (let xx = Math.floor(px - bw); xx <= Math.ceil(px + bw); xx++) {
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const u = (xx + 0.5 - px) / bw;
        const v = (yy + 0.5 - py) / bh;
        if (u * u + v * v > 1 || owner[yy * w + xx] >= 0) continue;
        s.px[yy * w + xx] = c(tones[v > 0.3 || u > 0.5 ? 2 : 0]);
      }
  }
  // far-off clouds take on the colour of the sky behind them
  if (haze > 0) {
    const to = c(hazeTo);
    for (let i = 0; i < s.px.length; i++) if (s.px[i]) s.px[i] = mixPacked(s.px[i], to, haze);
  }
  return s;
}
