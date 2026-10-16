/**
 * the tiny toolkit every place is drawn with: a buffer of pixels and a handful of ways to
 * put colour in it. colours are plain 0xrrggbb until they're written; `c()` packs them for
 * the buffer.
 */

/** 4×4 ordered dither, the classic way to blend two flat colours in pixel art */
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => n / 16 - 0.5);
export const dith = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

/** 0xrrggbb → the little-endian abgr that a Uint32Array over ImageData expects */
export const c = (rgb: number) =>
  ((255 << 24) | ((rgb & 255) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 255)) >>> 0;

export function mix(a: number, b: number, t: number) {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** mix two packed buffer colours, used for reflections */
export function mixPacked(a: number, b: number, t: number) {
  const ch = (s: number) => {
    const x = (a >>> s) & 255;
    return Math.round(x + (((b >>> s) & 255) - x) * t) << s;
  };
  return (0xff000000 | ch(16) | ch(8) | ch(0)) >>> 0;
}

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Frame {
  buf: Uint32Array;
  constructor(
    public W: number,
    public H: number,
  ) {
    this.buf = new Uint32Array(W * H);
  }
  set(x: number, y: number, col: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < this.W && y >= 0 && y < this.H) this.buf[y * this.W + x] = col;
  }
  get(x: number, y: number) {
    return this.buf[y * this.W + x];
  }
  rect(x: number, y: number, w: number, h: number, col: number) {
    const x0 = Math.max(0, Math.round(x));
    const x1 = Math.min(this.W, Math.round(x + w));
    for (let yy = Math.max(0, Math.round(y)); yy < Math.min(this.H, Math.round(y + h)); yy++) {
      if (x1 > x0) this.buf.fill(col, yy * this.W + x0, yy * this.W + x1);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, col: number) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
}

/** a picture with holes: 0 means "leave what's underneath" */
export type Sprite = { w: number; h: number; px: Uint32Array };

export function sprite(w: number, h: number): Sprite {
  return { w, h, px: new Uint32Array(w * h) };
}

export function blit(f: Frame, s: Sprite, x0: number, y0: number) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  const xs = Math.max(0, -x0);
  const xe = Math.min(s.w, f.W - x0);
  for (let y = Math.max(0, -y0); y < Math.min(s.h, f.H - y0); y++) {
    const row = y * s.w;
    const out = (y + y0) * f.W + x0;
    for (let x = xs; x < xe; x++) {
      const v = s.px[row + x];
      if (v) f.buf[out + x] = v;
    }
  }
}

/** a vertical gradient through a few flat colours, dithered at each seam, the way skies are painted */
export function bands(W: number, rows: number, stops: number[]): Uint32Array {
  const out = new Uint32Array(W * rows);
  const packed = stops.map(c);
  for (let y = 0; y < rows; y++) {
    const t = (y / Math.max(rows - 1, 1)) * (stops.length - 1);
    const i = Math.min(Math.floor(t), stops.length - 2);
    const f = t - i;
    // flat colour through most of each band, dithered only near the seam with the next one
    const edge = (f - 0.72) / 0.28;
    for (let x = 0; x < W; x++) out[y * W + x] = edge > 0 && edge + dith(x, y) * 1.1 > 0.5 ? packed[i + 1] : packed[i];
  }
  return out;
}

/** a pixel circle shaded as a ball lit from the upper left, for bushes and moons */
export function ball(s: Sprite | Frame, cx: number, cy: number, r: number, shades: number[]) {
  const target = "px" in s ? s.px : s.buf;
  const W = "px" in s ? s.w : s.W;
  const H = "px" in s ? s.h : s.H;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - cy) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1 || x < 0 || y < 0 || x >= W || y >= H) continue;
      const nz = Math.sqrt(1 - d2);
      const lum = -dx * 0.45 - dy * 0.6 + nz * 0.55 + dith(x, y) * 0.3;
      const level = lum > 0.62 ? 0 : lum > 0.3 ? 1 : lum > 0 ? 2 : 3;
      target[y * W + x] = c(shades[Math.min(level, shades.length - 1)]);
    }
  }
}

/**
 * bloom: the brightest pixels spill a soft glow onto their neighbours. the glow is blurred at
 * full resolution, then added back in a few dithered steps so it still reads as pixel art.
 */
export function bloom(f: Frame, strength: number, threshold = 0.78) {
  if (strength <= 0) return;
  const { W, H, buf } = f;
  const n = W * H;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = buf[i];
    const R = (v & 255) / 255;
    const G = ((v >> 8) & 255) / 255;
    const B = ((v >> 16) & 255) / 255;
    const lum = R * 0.3 + G * 0.55 + B * 0.15;
    const k = Math.max(0, (lum - threshold) / (1 - threshold));
    r[i] = R * k;
    g[i] = G * k;
    b[i] = B * k;
  }
  const blur = (src: Float32Array, rad: number) => {
    const tmp = new Float32Array(n);
    for (let y = 0; y < H; y++) {
      let acc = 0;
      for (let x = -rad; x <= rad; x++) acc += src[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = acc / (rad * 2 + 1);
        acc += src[y * W + Math.min(W - 1, x + rad + 1)] - src[y * W + Math.max(0, x - rad)];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        src[y * W + x] = acc / (rad * 2 + 1);
        acc += tmp[Math.min(H - 1, y + rad + 1) * W + x] - tmp[Math.max(0, y - rad) * W + x];
      }
    }
  };
  const rad = Math.max(2, Math.round(W / 70));
  for (const ch of [r, g, b]) {
    blur(ch, rad);
    blur(ch, rad);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = (r[i] * 0.3 + g[i] * 0.55 + b[i] * 0.15) * strength * 2.2;
      // stepped, so a halo is a few flat rings rather than a smooth smear (undithered: a
      // dithered glow speckles every bright edge it touches)
      const step = Math.floor(Math.min(k, 1) * 3) / 3;
      if (step <= 0) continue;
      const v = buf[i];
      const scale = step / Math.max(k, 0.0001);
      const add = (ch: Float32Array, shift: number) =>
        Math.min(255, ((v >>> shift) & 255) + ch[i] * scale * strength * 255 * 0.9) << shift;
      buf[i] = (0xff000000 | add(b, 16) | add(g, 8) | add(r, 0)) >>> 0;
    }
  }
}
