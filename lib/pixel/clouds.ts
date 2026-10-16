import { blit, c, dith, mix, sprite, type Frame, type Sprite } from "./frame";

/**
 * a cumulus cloud, painted the way pixel artists do it: a bumpy silhouette from a handful of
 * big lobes, then shaded from that silhouette rather than from the lobes. each column is
 * brightest just under its own top edge and gets bluer below it and toward the flat base, so
 * every bump gets a lit rim and a soft underside without any circles drawn inside.
 */

type Puff = { x: number; y: number; r: number; z: number };

export const CLOUD_DAY = [0xffffff, 0xeef6fd, 0xd2e8f9, 0xaed0f1, 0x8bb9e7];
export const CLOUD_NIGHT = [0x8e9cc4, 0x7282ad, 0x5a6994, 0x46537c, 0x343f65];

export function cumulus(rand: () => number, w: number, h: number, palette: number[], haze = 0, hazeTo = 0) {
  const base = Math.round(h * 0.9);
  const puffs: Puff[] = [];
  const minR = Math.max(2.5, h * 0.1);

  const grow = (x: number, y: number, r: number, z: number, depth: number) => {
    // a lobe that doesn't fit is left out rather than squeezed in, which would stack lobes
    // into a straight wall at the sprite's edge
    if (r < minR || y - r < 1 || x - r < 1 || x + r > w - 1) return;
    puffs.push({ x, y, r, z });
    if (depth === 0) return;
    const kids = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < kids; k++) {
      // children sit out on the upper rim, so they push the outline into bumps
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.2;
      const cr = r * (0.58 + rand() * 0.16);
      const d = r * (0.72 + rand() * 0.15);
      grow(x + Math.cos(a) * d, y + Math.sin(a) * d, cr, z + 1 + rand() * 0.5, depth - 1);
    }
  };

  const n = Math.max(2, Math.round(w / (h * 0.42)));
  for (let i = 0; i < n; i++) {
    const t = 0.14 + (i / (n - 1)) * 0.72;
    const lift = Math.sin(Math.PI * t) ** 1.4;
    const r = Math.min(h * (0.14 + lift * 0.22) * (0.85 + rand() * 0.3), t * w - 1, (1 - t) * w - 1);
    // end lobes ride higher so the bottom corners round off instead of meeting the base square
    const sit = 0.45 + (1 - lift) * 0.5;
    grow(t * w + (rand() - 0.5) * r * 0.3, base - r * sit, r, lift * 0.5 + rand() * 0.3, lift > 0.5 ? 2 : 1);
  }

  const owner = new Int16Array(w * h).fill(-1);
  const zs = new Float32Array(w * h);
  for (let y = 0; y <= base && y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = -Infinity;
      let who = -1;
      for (let k = 0; k < puffs.length; k++) {
        const p = puffs[k];
        const d2 = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
        if (d2 <= p.r * p.r && p.z > best) {
          best = p.z;
          who = k;
        }
      }
      owner[y * w + x] = who;
      zs[y * w + x] = best;
    }
  }

  // how high each column's cloud reaches, so the tones follow the cloud's own height
  const topOf = new Int16Array(w).fill(base);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y <= base; y++) {
      if (owner[y * w + x] >= 0) {
        topOf[x] = y;
        break;
      }
    }
  }
  let cloudTop = base;
  for (let x = 0; x < w; x++) cloudTop = Math.min(cloudTop, topOf[x]);

  // the top line, blurred sideways, so tones don't step where one bump meets the next
  const reach = Math.max(2, Math.round(h * 0.07));
  const smoothTop = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let n = 0;
    for (let k = -reach; k <= reach; k++) {
      const xx = x + k;
      if (xx < 0 || xx >= w || topOf[xx] >= base) continue;
      sum += topOf[xx];
      n++;
    }
    smoothTop[x] = n ? Math.max(topOf[x], sum / n) : base;
  }
  // where each row's cloud starts and ends, for the lit and the shaded side
  const leftOf = new Int16Array(h).fill(w);
  const rightOf = new Int16Array(h).fill(-1);
  for (let y = 0; y <= base && y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (owner[y * w + x] >= 0) {
        if (leftOf[y] === w) leftOf[y] = x;
        rightOf[y] = x;
      }
    }
  }

  const pal = palette.map((p) => c(haze ? mix(p, hazeTo, haze) : p));
  const s = sprite(w, h);
  const span = Math.max(1, base - cloudTop);
  for (let y = 0; y <= base && y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (owner[i] < 0) continue;
      // the last rows of the base thin out into the sky
      if (base - y < 3 && dith(x, y) + 0.5 < (3 - (base - y)) / 3.5) continue;
      // tone follows the silhouette: bright just under the top edge of each bump, bluer the
      // deeper you go below it, and bluer again toward the flat base of the whole cloud
      const local = (y - smoothTop[x]) / (h * 0.45);
      const global = (y - cloudTop) / span;
      const t = Math.min(Math.max(local, 0), 1) * 0.45 + global * 0.5 + dith(x, y) * 0.06;
      let lv = t < 0.34 ? 0 : t < 0.6 ? 1 : t < 0.8 ? 2 : t < 0.95 ? 3 : 4;
      if (x - leftOf[y] < 2 && lv > 0) lv--;
      else if (rightOf[y] - x < 2 && lv < 4 && global > 0.25) lv++;
      s.px[i] = pal[lv];
    }
  }
  return s;
}

/** a cloud drifting across the frame, wrapping around once it's fully off one side */
export type Drifter = { s: Sprite; x: number; y: number; speed: number; depth: number };

export function drawDrifters(f: Frame, list: Drifter[], t: number, look: number) {
  for (const d of list) {
    const span = f.W + d.s.w;
    const x = ((((d.x + t * d.speed) % span) + span) % span) - d.s.w;
    blit(f, d.s, x - look * d.depth, d.y);
  }
}
