import { BAYER, c, type Frame, mulberry32 } from "./frame";
import { makeNoise3 } from "./world";

/**
 * a field of grass from a little way off, grown from bare earth, painted the way pixel artists
 * do it: big soft swathes of a few close greens, drifting on a diagonal, and every edge between
 * them made of blades. the nearer grass (lower down) pokes up into the grass behind it as a
 * comb of one-pixel blades of uneven height, so no edge is ever a smooth blob. inside the
 * swathes sit spiky tufts of a darker or paler green and the odd lone blade with a bend in
 * it, and there are flowers.
 *
 * it grows outward from a handful of spots with a ragged front, the blades rising after the
 * green has arrived. once grown it bends to gusts of wind drifting across it, the pointer
 * parts the grass, and a click sends a ring out that lifts the blades and opens some flowers.
 */

// the greens, lightest first: a pale fleck, light, mid, dark, deep
const PALE = c(0xb2e57a);
const GREENS = [0x90d868, 0x70d058, 0x3fb85a, 0x229262].map(c);
const SOIL = [0x3b2c2a, 0x4a3830, 0x5a4636, 0x2c2224].map(c);

/**
 * the flowers, as little sprites: h highlight, p petal, s shade, c heart, d the heart's shadow.
 * each kind pairs a shape with its colours, the shade hue-shifted rather than just darker.
 */
const SHAPES = {
  // four rounded petals on the diagonals, the heart a plus between them
  daisy: ["hp.pp", "ppcpp", ".ccd.", "ppdss", "ps.ss"],
  // a round bloom, lit from the upper left
  cup: ["..h..", ".hps.", "hpcss", ".pss.", "..s.."],
  // five petals round a heart
  star: ["..h..", "hpcps", ".pdp.", "p.s.s"],
  // small: four petals round a heart
  tiny: [".h.", "pcs", ".s."],
};
const KINDS = [
  { shape: SHAPES.daisy, pal: [0xffffff, 0xfff6e2, 0xe9cfa0, 0xffcf4a, 0xe8902a], n: [2, 4] },
  { shape: SHAPES.daisy, pal: [0xffe2ee, 0xff9ec4, 0xe0628f, 0xffd34a, 0xc8507a], n: [2, 4] },
  { shape: SHAPES.star, pal: [0xf1e4ff, 0xc39bff, 0x8a5ce0, 0xffe066, 0x6a3cc0], n: [2, 3] },
  { shape: SHAPES.cup, pal: [0xfff7b8, 0xffe14a, 0xf0a030, 0xff8a1f, 0xc8601a], n: [3, 5] },
  { shape: SHAPES.cup, pal: [0xffb0a0, 0xff5a4a, 0xc8302e, 0x2c2234, 0x2c2234], n: [1, 3] },
  { shape: SHAPES.star, pal: [0xffe0b8, 0xffa340, 0xe0682a, 0xfff0a0, 0xb84a20], n: [2, 3] },
  { shape: SHAPES.tiny, pal: [0xe2f2ff, 0x8fc8ff, 0x5a8ee8, 0xfff3a0, 0xffcf4a], n: [5, 9] },
].map((k) => {
  const [h, p, sh, ct, cd] = k.pal.map(c);
  const ink: Record<string, number> = { h, p, s: sh, c: ct, d: cd };
  const px: [number, number, number][] = [];
  k.shape.forEach((row, y) =>
    [...row].forEach((ch, x) => ink[ch] && px.push([x - Math.floor(row.length / 2), y - Math.floor(k.shape.length / 2), ink[ch]])),
  );
  return { px, petal: p, heart: ct, n: k.n, big: k.shape.length > 3 };
});

const SPEED = 30; // how fast the green front travels, in pixels a second

/**
 * a blade: a one-pixel line rising from (x, y), h tall. `kink` bends its top pixel aside;
 * `delay` is how long after the green arrives it starts to rise.
 */
type Blade = { x: number; y: number; h: number; col: number; kink: number; delay: number; seed: number };
/** `at` is when it opens: seconds after the green reaches it, or, for planted ones, a moment on the clock */
type Flower = { x: number; y: number; at: number; planted: boolean; kind: number; flip: number };
type Ring = { x: number; y: number; t: number };

export type GrassInput = { x: number | null; y: number | null; clicks: { x: number; y: number }[] };

export function meadow(seed: number, W: number, H: number) {
  const rand = mulberry32(seed * 97 + 13);
  const noise = makeNoise3(rand);
  const N = W * H;

  // where it starts growing from: a few spots, one sometimes just off an edge
  const seeds = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({
    x: rand() * W * 1.1 - W * 0.05,
    y: rand() * H * 1.1 - H * 0.05,
  }));

  // the swathes run on a diagonal, one way or the other
  const angle = (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.35);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  // and the wind blows one way across them
  const windDir = rand() < 0.5 ? -1 : 1;

  // when the green reaches each pixel, and which green it is: 0 light ... 3 deep
  const birth = new Float32Array(N);
  const level = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wx = x + noise(x * 0.04, y * 0.04, 1, 2) * 22;
      const wy = y + noise(x * 0.04, y * 0.04, 7, 2) * 22;
      let d = Infinity;
      for (const s of seeds) d = Math.min(d, Math.hypot(wx - s.x, wy - s.y));
      birth[i] = d / SPEED + (noise(x * 0.3, y * 0.3, 3, 1) * 0.5 + 0.5) * 0.45;

      // long soft swathes along the diagonal, gently warped
      const u = x * ca + y * sa;
      const v = -x * sa + y * ca;
      const warp = noise(u * 0.012, v * 0.03, 5, 2) * 1.6;
      const f = noise(u * 0.009 + warp, v * 0.032, 11, 3);
      // darker toward the corners, the way a clearing opens in the middle
      const cx = x / W - 0.5;
      const cy = y / H - 0.5;
      const g = f + (cx * cx + cy * cy) * 0.55;
      level[i] = g > 0.36 ? 3 : g > 0.2 ? 2 : g > 0.05 ? 1 : 0;
    }

  // start the clock as the first green appears, a beat after the page does
  let first = Infinity;
  for (let i = 0; i < N; i++) first = Math.min(first, birth[i]);
  for (let i = 0; i < N; i++) birth[i] -= first - 0.25;

  const soil = new Uint32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sn = noise(x * 0.09, y * 0.12, 21, 3);
      const grit = noise(x * 0.6, y * 0.6, 23, 1);
      soil[y * W + x] = grit > 0.3 ? SOIL[2] : sn < -0.12 ? SOIL[3] : sn > 0.1 ? SOIL[1] : SOIL[0];
    }

  const blades: Blade[] = [];
  const blade = (x: number, y: number, h: number, col: number, kink = 0, delay = 0.25 + rand() * 0.8) => {
    if (h > 0 && x >= 0 && x < W && y >= 0 && y < H) blades.push({ x, y, h, col, kink, delay, seed: rand() });
  };

  // the combs: wherever the green changes going up a column, the lower grass rises into the
  // higher as blades of uneven height, clumped so some stretches stand taller than others
  for (let x = 0; x < W; x++)
    for (let y = 1; y < H; y++) {
      const below = level[y * W + x];
      if (below === level[(y - 1) * W + x]) continue;
      const clump = noise(x * 0.35, y * 0.35, 29, 1) + 0.5;
      const r = rand();
      const h = r < 0.18 ? 0 : Math.round((1 + r * 3.2) * (0.5 + clump * 0.9));
      blade(x, y - 1, h, GREENS[below], rand() < 0.08 ? (rand() < 0.5 ? -1 : 1) : 0);
    }

  // tufts: short rows of spiky blades, darker in the darker grass and pale out in the light,
  // with a ragged foot as well as a ragged top
  for (let k = 0; k < N / 620; k++) {
    const x0 = Math.floor(rand() * W);
    const y0 = 3 + Math.floor(rand() * (H - 3));
    const l = level[y0 * W + x0];
    const col = l === 0 ? (rand() < 0.6 ? PALE : GREENS[1]) : l === 3 ? GREENS[2] : GREENS[Math.min(3, l + 1)];
    const w = 5 + Math.floor(rand() * 9);
    for (let j = 0; j < w; j++) {
      if (rand() < 0.3) continue;
      // spiky, not domed: neighbouring blades alternate tall and short
      const up = (j % 2 ? 1 : 2) + Math.floor(rand() * 3) + (j > 0 && j < w - 1 ? 1 : 0);
      const down = rand() < 0.5 ? 1 + Math.floor(rand() * 2) : 0;
      blade(x0 + j, y0 + down, up + down + 1, col, 0, 0.6 + rand() * 0.8);
    }
  }

  // lone blades, a step lighter than the grass they stand in, some with a bend at the top
  for (let k = 0; k < N / 280; k++) {
    const x = Math.floor(rand() * W);
    const y = 4 + Math.floor(rand() * (H - 4));
    const l = level[y * W + x];
    if (l === 0 && rand() < 0.6) continue;
    const col = l === 0 ? PALE : GREENS[l - 1];
    const h = 2 + Math.floor(rand() * 3);
    blade(x, y, h, col, rand() < 0.4 ? (rand() < 0.5 ? -1 : 1) : 0, 0.8 + rand() * 1);
    // they often come in twos and threes
    if (rand() < 0.4) blade(x + 2 + Math.floor(rand() * 2), y + Math.round(rand() * 2 - 1), h - 1 + Math.floor(rand() * 2), col, 0, 0.9 + rand());
  }
  // painter's order: lower blades stand in front
  blades.sort((a, b) => a.y - b.y);

  // flowers, in loose clumps, opening last
  const flowers: Flower[] = [];
  for (let k = 0; k < Math.round(N / 2400) + 3; k++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const kind = Math.floor(rand() * KINDS.length);
    const [lo, hi] = KINDS[kind].n;
    const spread = KINDS[kind].big ? 16 : 10;
    for (let j = 0; j < lo + Math.floor(rand() * (hi - lo + 1)); j++) {
      const x = Math.round(cx + (rand() - 0.5) * spread);
      const y = Math.round(cy + (rand() - 0.5) * spread * 0.65);
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
      const gap = KINDS[kind].big ? 6 : 4;
      if (flowers.some((fl) => Math.abs(fl.x - x) < gap && Math.abs(fl.y - y) < gap)) continue;
      flowers.push({ x, y, at: 2.4 + rand() * 1.8, planted: false, kind, flip: rand() < 0.5 ? -1 : 1 });
    }
  }

  const rings: Ring[] = [];
  let t = 0;
  // everything has arrived a few seconds after the green reaches the last pixel
  let last = 0;
  for (let i = 0; i < N; i++) last = Math.max(last, birth[i]);
  const settled = last + 5;
  let drawnStep = -1;

  const put = (f: Frame, x: number, y: number, col: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) f.buf[y * W + x] = col;
  };

  // a flower opening: a green bud, a dot of colour, a small bloom, then the whole thing, with
  // a soft shadow on the grass to lift it off
  const flower = (f: Frame, fl: Flower, g: number, dx: number) => {
    const k = KINDS[fl.kind];
    const tiny = KINDS[KINDS.length - 1];
    const x = fl.x + dx;
    const y = fl.y;
    if (g < 0.25) return put(f, x, y, PALE);
    if (g < 0.5) {
      put(f, x, y + 1, GREENS[2]);
      return put(f, x, y, k.petal);
    }
    if (g < 0.8 && k.big) {
      for (const [ox, oy, col] of tiny.px) put(f, x + ox, y + oy, col === tiny.heart ? k.heart : k.petal);
      return;
    }
    // mirrored at random, so no two clumps look stamped
    for (const [ox, oy] of k.px) put(f, x + ox * fl.flip + 1, y + oy + 1, GREENS[2]);
    for (const [ox, oy, col] of k.px) put(f, x + ox * fl.flip, y + oy, col);
  };

  return {
    /** returns false when the picture hasn't changed, so the caller can skip putting it up */
    draw(f: Frame, dt: number, input: GrassInput) {
      t += dt;
      for (const cl of input.clicks) {
        rings.push({ x: cl.x, y: cl.y, t });
        // a clump of flowers where it landed, opening as the ring passes
        const kind = Math.floor(Math.random() * KINDS.length);
        for (let k = 0; k < 5 + Math.floor(Math.random() * 5); k++) {
          const a = Math.random() * Math.PI * 2;
          const d = 2 + Math.random() * 14;
          const x = Math.round(cl.x + Math.cos(a) * d * 1.3);
          const y = Math.round(cl.y + Math.sin(a) * d);
          if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
          if (flowers.some((fl) => Math.abs(fl.x - x) < 5 && Math.abs(fl.y - y) < 5)) continue;
          flowers.push({
            x,
            y,
            at: t + 0.15 + d / 45 + Math.random() * 0.2,
            planted: true,
            kind: Math.random() < 0.7 ? kind : Math.floor(Math.random() * KINDS.length),
            flip: Math.random() < 0.5 ? -1 : 1,
          });
        }
        if (rings.length > 6) rings.shift();
        if (flowers.length > 400) flowers.splice(0, flowers.length - 400);
      }

      // the wind moves on steps, about ten a second, so between them (and with no pointer, ring
      // or new flower about) there's nothing new to draw
      const step = Math.floor(t * 10);
      const busy =
        t < settled ||
        input.x !== null ||
        input.clicks.length > 0 ||
        rings.some((r) => t - r.t < 3.5) ||
        flowers.some((fl) => fl.planted && t - fl.at < 1);
      if (!busy && step === drawnStep) return false;
      drawnStep = step;

      // the ground: earth, then the first darker green arriving, then its grown tone
      for (let i = 0; i < N; i++) {
        const a = t - birth[i];
        if (a <= 0) {
          f.buf[i] = soil[i];
          continue;
        }
        const x = i % W;
        const y = (i / W) | 0;
        const dth = BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
        const young = GREENS[Math.min(3, level[i] + 2)];
        if (a < 0.35) f.buf[i] = dth < a / 0.35 ? young : soil[i];
        else if (a < 0.7) f.buf[i] = dth < (a - 0.35) / 0.35 ? GREENS[level[i]] : young;
        else f.buf[i] = GREENS[level[i]];
      }

      // the wind: not a wave but gusts, patches of stronger air that drift downwind and change
      // shape as they go, while the whole breeze swells and drops away over a few seconds
      const gust = (x: number, y: number, at: number) => {
        const g = noise((x - at * 16 * windDir) * 0.022, y * 0.035, at * 0.12, 2);
        const swell = 0.5 + 0.5 * Math.sin(at * 0.35);
        return Math.max(0, (g + 0.08) * 2.6) * (0.55 + swell * 0.6);
      };
      const flick = (seed: number, n: number) => {
        const v = Math.sin(seed * 1000 + n * 12.9898) * 43758.5453;
        return v - Math.floor(v);
      };
      const ringAt = (x: number, y: number) => {
        let s = 0;
        for (const r of rings) {
          const d = Math.hypot(x - r.x, (y - r.y) * 1.3);
          const front = (t - r.t) * 55;
          if (d > front + 10 || t - r.t > 3) continue;
          s = Math.max(s, Math.exp(-(((d - front) / 6) ** 2)));
        }
        return s;
      };

      for (const b of blades) {
        const a = t - birth[b.y * W + b.x] - b.delay;
        if (a <= 0) continue;
        const pop = ringAt(b.x, b.y);
        const h = Math.ceil(b.h * Math.min(1, a / 0.6)) + Math.round(pop * 2);
        // each blade feels the wind at its own moments and with its own stiffness, so they never
        // move in step; taller ones bend further, and in a gust one now and then flicks back
        const n = Math.floor((t + b.seed * 0.3) * 10);
        const s = gust(b.x, b.y, n / 10);
        let amount = s * (0.5 + b.seed) * Math.min(1.4, h / 3);
        if (s > 0.35 && flick(b.seed, n) < 0.1) amount = -0.5;
        let lean = (amount > 1.1 ? 2 : amount > 0.4 ? 1 : amount < -0.3 ? -1 : 0) * windDir;
        // and the pointer parts the grass round it
        if (input.x !== null && input.y !== null) {
          const dx = b.x - input.x;
          const dy = b.y - input.y;
          const d = Math.hypot(dx, dy * 1.4);
          if (d < 14) lean = (dx < 0 ? -1 : 1) * (d < 6 ? 2 : 1);
        }
        for (let k = 0; k < h; k++) {
          const top = k === h - 1;
          // planted at the foot, bending more toward the tip
          const sway = k === 0 ? 0 : Math.round(lean * Math.pow(k / Math.max(1, h - 1), 1.2));
          put(f, b.x + sway + (top && h > 1 ? b.kink : 0), b.y - k, pop > 0.5 && top ? PALE : b.col);
        }
      }

      for (const fl of flowers) {
        const opens = fl.planted ? fl.at : birth[fl.y * W + fl.x] + fl.at;
        const g = Math.min(1, (t - opens) / 0.6);
        if (g <= 0) continue;
        flower(f, fl, g, gust(fl.x, fl.y, step / 10) > 0.75 ? windDir : 0);
      }
      return true;
    },
  };
}
