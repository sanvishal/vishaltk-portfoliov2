import { BAYER, c, type Frame, mulberry32 } from "./frame";
import { makeNoise3 } from "./world";

/**
 * an interface left alone long enough for the world to take it back. given the boxes of some
 * ui elements (in the canvas's own pixels), it first weathers them, always inside their
 * rounded outline: water stains with dark tide lines, grime settled along the bottom, a dull
 * patina and scratches, cracks, and rust, which blooms round the bolts and along the
 * edges, pits the paint near it and runs down the face in tapering drips.
 *
 * then the green comes. dirt has gathered on every ledge and grass grows thick out of it,
 * olive and dry straw, some blades long enough to arch over and hang past the lip, a few
 * seeding, the odd weed standing up out of it. moss heaps over the lips and gathers in the
 * corners. ivy creeps along the edges in fine runners of tiny leaves, and only the odd vine
 * hangs loose off an underside. nothing grows anywhere but on the interface itself.
 *
 * the hanging vines are little ropes that swing in the gusts and get pushed about by the
 * pointer; the blades bend to the same gusts and part round it; the ivy stays put but its
 * leaves shiver when the wind gets up.
 */

/** a colour with its own alpha, for stains that let the interface show through */
const ca = (rgb: number, a: number) =>
  ((Math.max(0, Math.min(255, Math.round(a))) << 24) | ((rgb & 255) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 255)) >>> 0;

const GRASS = [0xa4c25c, 0x83a848, 0x628c3a, 0x426c32].map(c);
const STRAW = [0xd6c27a, 0xb39e56, 0x8e7d40].map(c);
const SOIL = [0x5a4630, 0x463626, 0x33281e].map(c);
const MOSS = [0xbccb66, 0x93a646, 0x6c8036, 0x4a5c2a].map(c);
const STEM = c(0x55603a);
const STEM_DARK = c(0x3a4429);
// rust, darkest first: the scale at its heart, then brown, orange, and a pale orange stain
const RUST = [0x4a2414, 0x6e341c, 0x934826, 0xb8632f, 0xd08a4c];
const BLOOMS = [
  [0xe9e3cc, 0xd8b84a],
  [0xd8b84a, 0xb07a2a],
  [0xa892b8, 0xe0c870],
  [0xe2a2b6, 0xf0d070],
  [0xf2eee0, 0xe0a840],
].map(([p, h]) => [c(p), c(h)]);

/** leaf colours as pairs of (lit, body): mostly olive greens, some dark, a few yellowed or dry */
const LEAF_TONES = [
  [0x9ab854, 0x6e9440],
  [0x86a648, 0x5c7e36],
  [0x6e9440, 0x46642e],
  [0x5c7e36, 0x3a5228],
  [0xa8aa52, 0x7e8a3a],
  [0xbaa856, 0x8e7c3a],
].map(([l, b]) => [c(l), c(b)]);
const leafTone = (r: number) => (r < 0.82 ? Math.floor(r * 4.9) : r < 0.93 ? 4 : 5);

/**
 * the leaves are tiny, the way ivy reads from any distance: one to four pixels off the stem,
 * in a few irregular shapes, drawn out to the right (mirrored for the left). the first pixel
 * touches the stem and opens first.
 */
const SPRIGS: [number, number][][] = [
  [[1, 0]],
  [[1, 0], [1, -1]],
  [[1, 0], [2, 0]],
  [[1, 0], [2, -1]],
  [[1, 0], [1, -1], [2, -1]],
  [[1, 0], [2, 0], [2, -1]],
  [[1, 0], [1, 1]],
  [[1, -1], [1, 0], [2, 0], [2, -1]],
];
const sprigOf = (r: number) => Math.floor(r ** 1.4 * SPRIGS.length);

const SEG = 2; // a hanging vine's links, in pixels
const GRAVITY = 70;

export type Box = { x: number; y: number; w: number; h: number; round: number };
/** a crevice inside an element, where dirt collects and things take root: a line across (h 0) or down (w 0) */
export type Seam = { x: number; y: number; w: number; h: number };
export type GrowInput = { x: number | null; y: number | null; vx: number; vy: number };

/** how far something has been brushed aside, and how fast it's springing back */
type Spring = { off: number; vel: number };
type Blade = Spring & { x: number; y: number; h: number; col: number; kink: number; at: number; seed: number; bloom: number; head: boolean };
/** a long blade that arches over: from its root, up and out, its tip falling past the lip */
type Arch = Spring & { x: number; y: number; dir: number; len: number; droop: number; cols: number[]; at: number; seed: number };
/** a weed: a stalk with sprigs up it and a tuft or a seed head at the top */
type Weed = Spring & { x: number; y: number; h: number; lean: number; at: number; seed: number; top: number };
type Node = { x: number; y: number; px: number; py: number };
type Vine = { ax: number; ay: number; nodes: Node[]; len: number; at: number; speed: number; side: number; curl: number; seed: number };
/** a creeping runner: the pixels of its stem in the order it grows them, and its leaves */
type Creeper = { pts: { x: number; y: number; at: number }[]; leaves: (Spring & { x: number; y: number; side: number; at: number; shape: number; tone: number; seed: number; bloom: number })[] };
type Speck = { i: number; col: number; at: number };

export function overgrowth(seed: number, W: number, H: number, boxes: Box[], startAt = 0, seams: Seam[] = []) {
  const rand = mulberry32(seed * 131 + 7);
  const noise = makeNoise3(rand);
  const windDir = rand() < 0.5 ? -1 : 1;
  const grown = startAt > 0;

  const wear: Speck[] = [];
  const moss: Speck[] = [];
  const soil: Speck[] = [];
  const blades: Blade[] = [];
  const arches: Arch[] = [];
  const weeds: Weed[] = [];
  const vines: Vine[] = [];
  const creepers: Creeper[] = [];

  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const speck = (list: Speck[], x: number, y: number, col: number, at: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (inside(x, y)) list.push({ i: y * W + x, col, at: grown ? -10 : at });
  };

  /** whether a pixel lies inside a box's rounded outline */
  const within = (b: Box, x: number, y: number) => {
    if (x < b.x || y < b.y || x >= b.x + b.w || y >= b.y + b.h) return false;
    const r = b.round;
    const px = x + 0.5;
    const py = y + 0.5;
    const cx = Math.min(Math.max(px, b.x + r), b.x + b.w - r);
    const cy = Math.min(Math.max(py, b.y + r), b.y + b.h - r);
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
  };

  /** grass rising from row y along [x0, x1]: olive green with dry straw through it */
  const meadow = (x0: number, x1: number, y: number, at: number, tall: number, dry: number, thick: number) => {
    for (let x = Math.ceil(x0); x <= Math.floor(x1); x++) {
      const lush = noise(x * 0.05, y * 0.1, 3, 2) + 0.18;
      if (lush < 0 && rand() < 0.75) continue;
      const n = Math.max(1, Math.round((lush > 0.25 ? 3.5 : lush > 0.1 ? 2.5 : 1.5) * thick));
      for (let k = 0; k < n; k++) {
        const r = rand();
        const h = Math.max(1, Math.round((1 + r * 3.5 + lush * tall) * (0.55 + rand() * 0.7)));
        const straw = rand() < dry;
        const back = n - 1 - k; // the back blades are darker
        const col = straw ? STRAW[Math.min(2, back)] : GRASS[Math.min(3, back + (r < 0.3 ? 1 : 0))];
        blades.push({
          x: x + (k % 2 ? (rand() < 0.5 ? -1 : 1) : 0),
          y,
          h: straw ? h + 1 : h,
          col,
          kink: rand() < (straw ? 0.35 : 0.12) ? (rand() < 0.5 ? -1 : 1) : 0,
          at: (grown ? -10 : at) + rand() * 1.4 + Math.abs(noise(x * 0.03, y, 9, 1)) * 1.5,
          seed: rand(),
          bloom: !straw && h > 3 && rand() < 0.06 ? 1 + Math.floor(rand() * BLOOMS.length) : 0,
          head: straw && h > 4 && rand() < 0.35,
          off: 0,
          vel: 0,
        });
      }
      // now and then a long blade arching over
      if (lush > 0.05 && rand() < 0.09 * thick) {
        const len = 6 + rand() * 9;
        arches.push({
          x,
          y,
          dir: rand() < 0.5 ? -1 : 1,
          len,
          droop: rand() * len * 0.7,
          cols: rand() < dry ? [STRAW[2], STRAW[1], STRAW[0]] : [GRASS[3], GRASS[2], GRASS[1]],
          at: (grown ? -10 : at) + 1 + rand() * 1.5,
          seed: rand(),
          off: 0,
          vel: 0,
        });
      }
      // and a weed standing up out of it
      if (lush > 0.15 && rand() < 0.025 * thick)
        weeds.push({ x, y, h: 7 + Math.floor(rand() * 8), lean: (rand() - 0.5) * 0.4, at: (grown ? -10 : at) + 1.5 + rand() * 2, seed: rand(), top: Math.floor(rand() * 3), off: 0, vel: 0 });
    }
  };

  /** a heap of moss: a lumpy blob lit from the upper left, darkest underneath */
  const clump = (cx: number, cy: number, r: number, at: number, flat = 1.7) => {
    const R = Math.ceil(r + 1);
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const wob = 1 + noise((cx + x) * 0.4, (cy + y) * 0.4, 31, 1) * 0.45;
        // squashed, so it lies along a surface rather than balancing on it
        const d = Math.hypot(x, y * flat) / (r * wob);
        if (d > 1) continue;
        const lit = x + y < -r * 0.35;
        const under = y > r * 0.35 && d > 0.6;
        const col = lit ? MOSS[d < 0.5 ? 0 : 1] : under ? MOSS[d > 0.85 ? 3 : 2] : MOSS[1];
        speck(moss, cx + x, cy + y, col, at + d * 0.5 + rand() * 0.3);
      }
  };

  /** ivy creeping from (x, y), wandering but kept inside a band of the face (the box given) */
  const creep = (b: Box, x: number, y: number, heading: number, len: number, at: number, depth: number) => {
    const cr: Creeper = { pts: [], leaves: [] };
    const speed = 14 + rand() * 10;
    let a = heading;
    let side = rand() < 0.5 ? -1 : 1;
    const leafy = 0.45 + rand() * 0.25;
    for (let k = 0; k < len; k++) {
      a += (rand() - 0.5) * 0.75;
      // ivy keeps to the wall: turn back in when it nears an edge
      const nx = x + Math.cos(a);
      const ny = y + Math.sin(a);
      if (nx < b.x + 1 || nx > b.x + b.w - 2) a = Math.PI - a;
      if (ny < b.y + 1 || ny > b.y + b.h - 2) a = -a;
      x += Math.cos(a);
      y += Math.sin(a);
      const t0 = at + k / speed;
      cr.pts.push({ x: Math.round(x), y: Math.round(y), at: t0 });
      if (rand() < leafy) {
        // mostly alternating sides, not always
        if (rand() < 0.75) side = -side;
        const px = Math.round(x - Math.sin(a) * side * 0.6);
        const py = Math.round(y + Math.cos(a) * side * 0.6);
        cr.leaves.push({ x: px, y: py, side: Math.abs(Math.cos(a)) < 0.4 ? side : Math.sign(Math.cos(a) * side) || side, at: t0 + 0.2 + rand() * 0.3, shape: sprigOf(rand()), tone: leafTone(rand()), seed: rand(), bloom: rand() < 0.035 ? Math.floor(rand() * BLOOMS.length) : -1, off: 0, vel: 0 });
      }
      if (depth < 1 && rand() < 0.045) creep(b, x, y, a + (rand() < 0.5 ? -1 : 1) * (0.8 + rand() * 0.6), Math.round(len * (0.3 + rand() * 0.3)), t0, depth + 1);
    }
    if (grown) {
      for (const p of cr.pts) p.at = -10;
      for (const l of cr.leaves) l.at = -10;
    }
    creepers.push(cr);
  };

  /** rust: a corroded bloom at (x, y), pitting round it, and drips running down from it */
  const rust = (b: Box, x: number, y: number, r: number, drips: number, at: number) => {
    // it spreads: the heart first, then outward, then the drips crawl down
    const add = (px: number, py: number, col: number, later = 0) => {
      px = Math.round(px);
      py = Math.round(py);
      if (within(b, px, py)) speck(wear, px, py, col, at + later);
    };
    const R = Math.ceil(r * 1.8);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy * 1.2) / (r * (1 + noise((x + dx) * 0.5, (y + dy) * 0.5, 61, 1) * 0.7));
        if (d > 1.8) continue;
        const dth = BAYER[((y + dy) & 3) * 4 + ((x + dx) & 3)] + 0.5;
        const later = d * 1.4 + dth * 0.4;
        if (d < 0.45) add(x + dx, y + dy, ca(RUST[d < 0.25 ? 0 : 1], 235), later);
        else if (d < 0.8) add(x + dx, y + dy, ca(RUST[2], 210), later);
        else if (d < 1.1) add(x + dx, y + dy, ca(RUST[3], 150), later);
        // a pale stained halo, dithered out
        else if (dth < (1.8 - d) * 1.2) add(x + dx, y + dy, ca(RUST[4], 70), later);
      }
    // pitting: small corroded specks scattered round it
    for (let k = 0; k < r * 5; k++) {
      const a = rand() * Math.PI * 2;
      const d = r * (1.2 + rand() * 2.2);
      add(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, ca(RUST[rand() < 0.5 ? 1 : 2], 200), 1.5 + rand() * 3);
    }
    // drips, wide at the top and tapering, darkest near the source, sometimes ending in a bead
    for (let k = 0; k < drips; k++) {
      let dx = x + (rand() - 0.5) * r * 1.4;
      const len = 6 + rand() ** 1.3 * Math.min(42, b.h * 0.85);
      const wide = 1 + (rand() < 0.5 ? 1 : 0);
      const crawl = 0.1 + rand() * 0.12; // seconds a pixel
      for (let s = 0; s < len; s++) {
        if (rand() < 0.06) dx += rand() < 0.5 ? -1 : 1;
        const fade = 1 - s / len;
        const py = y + r * 0.6 + s;
        const dth = BAYER[((Math.round(py)) & 3) * 4 + (Math.round(dx) & 3)] + 0.5;
        // solid near the source, breaking up only toward the end
        if (fade < 0.45 && dth > fade * 2.2) continue;
        const shade = fade > 0.7 ? RUST[1] : fade > 0.4 ? RUST[2] : RUST[3];
        const later = 1.2 + s * crawl;
        add(dx, py, ca(shade, 110 + fade * 130), later);
        if (wide > 1 && fade > 0.35) add(dx + 1, py, ca(RUST[3], 50 + fade * 120), later + 0.3);
        // and a faint stain spreading either side of it
        if (fade > 0.3 && dth < 0.5) add(dx - 1, py, ca(RUST[4], 30 + fade * 40), later + 0.8);
      }
      if (rand() < 0.35) add(dx, y + r * 0.6 + len, ca(RUST[2], 150), 1.2 + len * crawl);
    }
  };

  /** water stain: a pale wash ringed by a darker tide line, sometimes two rings deep */
  const stain = (b: Box, cx: number, cy: number, rx: number, ry: number, at: number) => {
    const level = (x: number, y: number) => {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry) + noise(x * 0.12, y * 0.12, 71, 2) * 0.55;
      return d < 0.6 ? 2 : d < 1 ? 1 : 0;
    };
    for (let y = Math.floor(cy - ry * 1.6); y <= cy + ry * 1.6; y++)
      for (let x = Math.floor(cx - rx * 1.6); x <= cx + rx * 1.6; x++) {
        if (!within(b, x, y)) continue;
        const l = level(x, y);
        if (!l) continue;
        // a pixel on the edge of a ring is where the water stopped and left its line
        const edge = level(x + 1, y) < l || level(x - 1, y) < l || level(x, y + 1) < l || level(x, y - 1) < l;
        // it spreads from the middle, the tide line arriving last
        const spread = Math.hypot((x - cx) / rx, (y - cy) / ry) * 2.2 + (edge ? 0.6 : 0);
        speck(wear, x, y, edge ? ca(0x705a38, l === 2 ? 34 : 48) : ca(0x8a7450, l === 2 ? 20 : 12), at + spread);
      }
  };

  boxes.forEach((b, bi) => {
    const born = 0.3 + bi * 0.35 + rand() * 0.8;
    const inset = Math.min(b.round * 0.6, b.w / 3);
    const top = b.y;
    const bottom = b.y + b.h;
    const area = b.w * b.h;

    // ---- the weathering, which comes before anything grows ----
    for (let y = top; y < bottom; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        if (!within(b, x, y)) continue;
        const dth = BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
        // a faint mottled patina over everything, the paint gone unevenly dull
        const mottle = noise(x * 0.09, y * 0.11, 39 + bi, 3) + noise(x * 0.4, y * 0.4, 37, 1) * 0.25;
        if (mottle > 0.08 && dth < (mottle - 0.08) * 2.4) speck(wear, x, y, ca(0x6e5a3e, 10 + mottle * 18), 0.5 + (1 - mottle) * 2.5 + dth * 3);
        // grime settled along the bottom, and fine dirt in the corners
        const low = Math.max(0, 1 - (bottom - y) / 8) * (0.55 + noise(x * 0.15, y * 0.3, 43, 2) * 0.9);
        if (low > 0.12 && dth < low * 1.4) speck(wear, x, y, ca(0x3e3222, 20 + low * 70), 0.6 + (1 - low) * 3 + dth * 1.5);
        // streaks where rain ran down from the top edge, uneven and broken
        const run = noise(x * 0.16, 7, 47 + bi, 1);
        if (run > 0.15) {
          const len = (run - 0.15) * 100 * (0.6 + noise(x * 0.4, 3, 49, 1));
          const k = y - top;
          if (k < len && dth < (1 - k / len) * 0.9) speck(wear, x, y, ca(0x6e5a3a, 26 + (1 - k / len) * 38), 0.8 + k * 0.09 + dth * 0.6);
        }
      }
    // water stains with tide lines
    // scratches, light where the paint was scored and dark where dirt got into them, and specks
    for (let k = 0; k < Math.round(area / 900); k++) {
      let x = b.x + 3 + rand() * (b.w - 6);
      let y = top + 3 + rand() * (b.h - 6);
      const a = (rand() - 0.5) * 1.2 + (rand() < 0.5 ? 0 : Math.PI / 2);
      const dark = rand() < 0.4;
      const when = 1 + rand() * 5;
      for (let q = 0; q < 2 + rand() * 6; q++) {
        x += Math.cos(a);
        y += Math.sin(a);
        if (within(b, Math.round(x), Math.round(y))) speck(wear, x, y, dark ? ca(0x3a3024, 60) : ca(0xffffff, 32), when + q * 0.03);
      }
    }
    for (let k = 0; k < Math.round(area / 450); k++) {
      const x = Math.round(b.x + rand() * b.w);
      const y = Math.round(top + rand() * b.h);
      if (within(b, x, y)) speck(wear, x, y, ca(0x2e261c, 50 + rand() * 60), 0.5 + rand() * 7);
    }
    // water stains, where it seeped in: mostly hanging off the top edge and the corners
    for (let k = 0; k < Math.max(1, Math.round(area / 6000)) + (rand() < 0.4 ? 1 : 0); k++) {
      const rx = 4 + rand() * Math.min(16, b.w * 0.14);
      const atEdge = rand() < 0.75;
      stain(b, b.x + rand() * b.w, atEdge ? top + rx * 0.2 : top + rand() * b.h, rx, rx * (0.6 + rand() * 0.5), 0.6 + rand() * 3);
    }
    // rust round the bolts in the corners, along the top edge, and pooled along the bottom
    const r0 = b.round * 0.7 + 2;
    if (b.h > 12) {
      rust(b, b.x + r0, top + r0, 1.6 + rand(), 1 + Math.floor(rand() * 2), 0.3 + rand());
      rust(b, b.x + b.w - r0 - 1, top + r0, 1.6 + rand(), 1 + Math.floor(rand() * 2), 0.3 + rand());
    }
    for (let k = 0; k < Math.round(b.w / 45 + rand()); k++) rust(b, b.x + 6 + rand() * (b.w - 12), top + 1, 1 + rand() * 1.6, 1 + Math.floor(rand() * 2), 0.6 + rand() * 2.5);
    for (let k = 0; k < Math.round(b.w / 120 + rand() * 0.6); k++) rust(b, b.x + 6 + rand() * (b.w - 12), bottom - 2, 1 + rand() * 1.2, 0, 2 + rand() * 3);

    // a crack or two, wandering in from an edge with a lighter lip beside it
    for (let k = 0; k < (area > 1500 ? 2 : rand() < 0.6 ? 1 : 0); k++) {
      const fromTop = rand() < 0.5;
      let x = fromTop ? b.x + 6 + rand() * (b.w - 12) : rand() < 0.5 ? b.x + 1 : b.x + b.w - 2;
      let y = fromTop ? top + 1 : top + 3 + rand() * (b.h - 6);
      let a = fromTop ? Math.PI / 2 + (rand() - 0.5) : x < b.x + b.w / 2 ? rand() - 0.5 : Math.PI + (rand() - 0.5);
      const len = 6 + rand() * Math.min(30, b.h * 0.8);
      const when = 1.5 + rand() * 4;
      for (let s = 0; s < len; s++) {
        a += (rand() - 0.5) * 1.1;
        x += Math.cos(a);
        y += Math.sin(a);
        if (!within(b, Math.round(x), Math.round(y))) break;
        speck(wear, x, y, ca(0x2a2520, 215), when + s * 0.07);
        if (within(b, Math.round(x + 1), Math.round(y + 1))) speck(wear, x + 1, y + 1, ca(0xffffff, 30), when + s * 0.07);
        if (rand() < 0.12) {
          let bx = x;
          let by = y;
          let ba = a + (rand() < 0.5 ? -1 : 1) * 0.9;
          for (let q = 0; q < 3 + rand() * 5; q++) {
            bx += Math.cos(ba);
            by += Math.sin(ba);
            ba += (rand() - 0.5) * 0.8;
            if (within(b, Math.round(bx), Math.round(by))) speck(wear, bx, by, ca(0x2a2520, 180), when + s * 0.07 + q * 0.07);
          }
        }
      }
    }

    // ---- then the growing ----
    // dirt gathered along the ledge, for the grass to root in
    for (let x = Math.ceil(b.x + inset * 0.6); x < b.x + b.w - inset * 0.6; x++) {
      // a continuous line of it right on the edge, so nothing ever floats above the surface
      const deep = noise(x * 0.12, top * 0.1, 91, 2);
      speck(soil, x, top - 1, SOIL[deep > 0.15 ? 2 : 1], born + 0.3);
      if (deep > 0.08) speck(soil, x, top - 2, SOIL[deep > 0.25 ? 1 : 0], born + 0.4);
    }
    // moss heaped over the lip, in lumps, biggest at the corners
    for (let x = b.x + inset * 0.4; x < b.x + b.w - inset * 0.4; x += 2 + rand() * 3) {
      const n = noise(x * 0.07, top * 0.1, 5, 2);
      if (n < -0.12) continue;
      const nearCorner = Math.min(x - b.x, b.x + b.w - x) < 8;
      const r = (1.4 + (n + 0.12) * 5 + (nearCorner ? 1.6 : 0)) * 0.9;
      clump(x, top + 1 + rand(), Math.min(5, r), born + Math.min(x - b.x, b.x + b.w - x) * 0.02);
      // and where it's thick, a strand of it hanging down over the face
      if (r > 3 && rand() < 0.35) {
        const drop = 2 + Math.floor(rand() * 5);
        for (let k = 1; k <= drop; k++) speck(moss, x + (k > 2 && rand() < 0.3 ? 1 : 0), top + r * 0.5 + k, MOSS[k === drop ? 3 : 2], born + 0.8 + k * 0.1);
      }
    }
    // gathering in the corners and running down the sides
    for (const right of [false, true]) {
      if (rand() < 0.3) continue;
      const x = right ? b.x + b.w - 1 : b.x;
      const run = Math.min(b.h - 3, 4 + rand() ** 1.5 * 26);
      for (let k = 2; k < run; k += 1.5 + rand() * 2) clump(x + (right ? -1 : 1) * rand(), top + k, (1.6 - k / run) * 2, born + 0.4 + k * 0.05, 1);
    }

    // grass along the top: thick, tall in places, some of it dry
    meadow(b.x + inset * 0.6, b.x + b.w - inset * 0.6, top - 1, born + 0.8, 8, 0.3, 1.4);

    // ivy keeps to the edges, the way it follows a wall's corners and seams: down a side,
    // along the top under the moss, or up from a bottom corner
    for (let k = 0; k < (area > 1500 ? 4 : 2); k++) {
      if (rand() < (area > 1500 ? 0.12 : 0.3)) continue;
      const right = rand() < 0.5;
      const band = Math.min(16, Math.max(5, b.w * 0.18));
      const kind = rand();
      const at = born + 1.2 + rand();
      if (kind < 0.45) {
        const x0 = right ? b.x + b.w - band : b.x;
        creep({ x: x0, y: b.y, w: band, h: b.h, round: 0 }, right ? b.x + b.w - 3 : b.x + 2, top + 2, Math.PI / 2, Math.round(Math.min(50, b.h * (0.5 + rand() * 0.6))), at, 0);
      } else if (kind < 0.8) {
        const deep = Math.min(9, Math.max(4, b.h * 0.3));
        creep({ x: b.x, y: b.y, w: b.w, h: deep, round: 0 }, right ? b.x + b.w - 3 : b.x + 2, top + 2, right ? Math.PI : 0, Math.round(Math.min(55, b.w * (0.3 + rand() * 0.35))), at, 0);
      } else {
        const x0 = right ? b.x + b.w - band : b.x;
        creep({ x: x0, y: b.y, w: band, h: b.h, round: 0 }, right ? b.x + b.w - 3 : b.x + 2, bottom - 3, -Math.PI / 2, Math.round(Math.min(40, b.h * (0.4 + rand() * 0.5))), at, 0);
      }
    }

    // down its sides: ivy setting off from the top corners and creeping down along the edge,
    // straddling it, in two or three runners, with moss on the edge and sprays of leaves
    for (const right of [false, true]) {
      const band = 8 + rand() * 6;
      // the band reaches a little past the edge, so the runner can cling to the outside of it
      const edge = { x: right ? b.x + b.w - band + 3 : b.x - 3, y: top + 1, w: band, h: b.h - 2, round: 0 };
      const sx = right ? b.x + b.w - 1 : b.x;
      creep(edge, sx, top + 2, Math.PI / 2, Math.round(b.h * (0.7 + rand() * 0.45)), born + 1 + rand(), 0);
      if (rand() < 0.65) creep(edge, sx + (right ? -2 : 2), top + 3, Math.PI / 2, Math.round(b.h * (0.35 + rand() * 0.35)), born + 1.6 + rand(), 0);
      if (rand() < 0.25) creep(edge, sx + (right ? 1 : -1), top + 4, Math.PI / 2, Math.round(b.h * (0.2 + rand() * 0.3)), born + 2.2 + rand(), 0);
      // moss clinging along the edge in a ragged strip: thick up top where it spills over
      // the lip, thinning and breaking up further down
      const ex = right ? b.x + b.w - 1 : b.x;
      const out = right ? 1 : -1;
      for (let y = top + 3; y < bottom - 3; y++) {
        const high = 1 - (y - top) / b.h;
        const n = noise(ex * 0.3, y * 0.12, 101, 2) + high * 0.35 + 0.02;
        if (n < 0.02) continue;
        const thick = Math.min(3, Math.round(n * 6.5));
        for (let k = 0; k < thick; k++) {
          // straddling the edge: a pixel outside it, the rest on the face
          const x = ex + out - k * out;
          const col = k === 0 ? MOSS[n > 0.25 ? 1 : 2] : k === thick - 1 ? MOSS[3] : MOSS[2];
          speck(moss, x, y, col, born + 1 + (y - top) * 0.04 + rand() * 0.3);
        }
        if (n > 0.3 && rand() < 0.3) speck(moss, ex + out * 2, y, MOSS[0], born + 1.3 + (y - top) * 0.04);
      }
      // sprays of small leaves poking out from the edge, where something has rooted in it
      for (let y = top + 5; y < bottom - 4; y += 5 + rand() * 9) {
        if (rand() < 0.45) continue;
        const cr: Creeper = { pts: [], leaves: [] };
        const at = born + 1.8 + (y - top) * 0.05 + rand();
        for (let k = 0; k < 2 + Math.floor(rand() * 4); k++) {
          const ly = Math.round(y + (rand() - 0.5) * 4);
          cr.leaves.push({ x: ex + out * (1 + Math.floor(rand() * 2)), y: ly, side: out, at: grown ? -10 : at + k * 0.15, shape: sprigOf(rand()), tone: leafTone(rand()), seed: rand(), bloom: rand() < 0.06 ? Math.floor(rand() * BLOOMS.length) : -1, off: 0, vel: 0 });
        }
        creepers.push(cr);
      }
    }

    // vines draped over the top lip, hanging down across the face: plenty of short ones,
    // a few that reach a good way down, clustered where the growth on top is thickest
    for (let x = b.x + inset + 2 + rand() * 6; x < b.x + b.w - inset - 2; x += 4 + rand() * 11) {
      const lush = noise(x * 0.05, (top - 2) * 0.1, 3, 2) + 0.18;
      if (rand() > 0.35 + lush * 1.2) continue;
      vines.push({
        ax: Math.round(x),
        ay: top + 1,
        nodes: [{ x: Math.round(x), y: top + 1, px: Math.round(x), py: top + 1 }],
        len: Math.round(rand() < 0.22 ? 12 + rand() * Math.min(18, b.h / SEG / 2) : 3 + rand() ** 1.4 * 9),
        at: grown ? -10 : born + 1.6 + rand() * 2.5,
        speed: 3 + rand() * 4,
        side: rand() < 0.5 ? -1 : 1,
        curl: 0.3 + rand() * 0.7,
        seed: rand(),
      });
    }

    // and only the odd vine hanging loose off the underside
    for (let k = 0; k < (b.w > 90 ? 2 : 1); k++) {
      if (rand() < 0.55) continue;
      const x = b.x + inset + 3 + rand() * (b.w - inset * 2 - 6);
      vines.push({
        ax: Math.round(x),
        ay: bottom,
        nodes: [{ x: Math.round(x), y: bottom, px: Math.round(x), py: bottom }],
        len: Math.round(3 + rand() ** 1.8 * 10),
        at: grown ? -10 : born + 2 + rand() * 1.5,
        speed: 4 + rand() * 5,
        side: rand() < 0.5 ? -1 : 1,
        curl: 0.4 + rand() * 0.9,
        seed: rand(),
      });
    }
  });

  // the crevices inside: dirt in the line, little cushions of moss, short tufts of grass in
  // patches, and now and then a thin runner of ivy following it
  seams.forEach((sm, si) => {
    const born = 2 + si * 0.3 + rand() * 2;
    const across = sm.h === 0;
    const len = across ? sm.w : sm.h;
    for (let k = 1; k < len - 1; k++) {
      const x = across ? sm.x + k : sm.x;
      const y = across ? sm.y : sm.y + k;
      const patch = noise(x * 0.09, y * 0.09, 97 + si, 2);
      if (patch > -0.1 && rand() < 0.7) speck(soil, x, y, ca(0x3e3222, 110 + patch * 120), born + k * 0.01);
      if (patch > 0.05 && rand() < 0.16) clump(x, y, 0.8 + rand() * (0.6 + patch * 3), born + 0.4 + rand(), across ? 2 : 1);
      if (across && patch > 0.12 && rand() < 0.45) {
        const h = 1 + Math.floor(rand() * (2 + patch * 8));
        const straw = rand() < 0.25;
        blades.push({ x, y: y - 1, h, col: straw ? STRAW[1 + Math.floor(rand() * 2)] : GRASS[1 + Math.floor(rand() * 3)], kink: rand() < 0.15 ? (rand() < 0.5 ? -1 : 1) : 0, at: (grown ? -10 : born + 1 + rand() * 1.5), seed: rand(), bloom: !straw && h > 2 && rand() < 0.07 ? 1 + Math.floor(rand() * BLOOMS.length) : 0, head: false, off: 0, vel: 0 });
      }
    }
    for (let k = 0; k < Math.round(len / 60) + (rand() < 0.5 ? 1 : 0); k++) {
      const start = rand() * len * 0.7;
      const band = across ? { x: sm.x, y: sm.y - 2, w: sm.w, h: 4, round: 0 } : { x: sm.x - 2, y: sm.y, w: 4, h: sm.h, round: 0 };
      creep(band, across ? sm.x + start : sm.x, across ? sm.y : sm.y + start, across ? (rand() < 0.5 ? 0 : Math.PI) : Math.PI / 2, Math.round(10 + rand() * 22), born + 1.5 + rand(), 1);
    }
  });

  blades.sort((a, b) => a.y - b.y);

  // two clocks: the wind runs in real time, the growth slower, so it creeps in over a while
  const PACE = 0.55;
  let t = startAt;
  let g = startAt;
  // grown already: lay the hanging vines out at full length
  if (grown)
    for (const v of vines)
      for (let k = 1; k < v.len; k++) v.nodes.push({ x: v.ax, y: v.ay + k * SEG, px: v.ax, py: v.ay + k * SEG });

  const put = (f: Frame, x: number, y: number, col: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) f.buf[y * W + x] = col;
  };
  const line = (f: Frame, x0: number, y0: number, x1: number, y1: number, col: number) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k++) put(f, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, col);
  };

  // gusts: patches of stronger air drifting downwind, while the breeze swells and drops
  const gust = (x: number, y: number, at: number) => {
    const g = noise((x - at * 16 * windDir) * 0.022, y * 0.035, at * 0.12, 2);
    const swell = 0.5 + 0.5 * Math.sin(at * 0.35);
    return Math.max(0, (g + 0.08) * 2.6) * (0.55 + swell * 0.6);
  };
  const hash = (s: number, n: number) => {
    const v = Math.sin(s * 1000 + n * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  // a sprig: its first pixel in the body colour, the rest lit where they sit higher
  const leaf = (f: Frame, x: number, y: number, side: number, shape: number, tone: number, open: number) => {
    const px = SPRIGS[shape];
    const [lit, body] = LEAF_TONES[tone];
    const n = open < 0.4 ? 1 : px.length;
    for (let k = 0; k < n; k++) {
      const [ox, oy] = px[k];
      put(f, x + ox * side, y + oy, k > 0 && oy <= 0 ? lit : body);
    }
  };
  /** how far the wind pushes something at (x, y) right now, in pixels */
  const sway = (x: number, y: number, seed: number, stiff: number) => {
    const n = Math.floor((t + seed * 0.3) * 10);
    const s = gust(x, y, n / 10);
    let amount = s * (0.5 + seed) * stiff;
    if (s > 0.35 && hash(seed, n) < 0.1) amount = -0.5;
    return (amount > 1.1 ? 2 : amount > 0.4 ? 1 : amount < -0.3 ? -1 : 0) * windDir;
  };
  /**
   * the pointer brushing past: only its movement counts, never where it rests. whatever it
   * passes close to is shoved the way it's going, then springs back, overshooting a touch
   * and wobbling to rest, each at its own stiffness.
   */
  const brush = (o: Spring, x: number, y: number, seed: number, input: GrowInput, dt: number) => {
    if (input.x !== null && input.y !== null) {
      const d = Math.hypot(x - input.x, (y - input.y) * 1.3);
      if (d < 9) o.vel += Math.max(-260, Math.min(260, input.vx)) * (1 - d / 9) ** 2 * 7 * dt;
    }
    const stiff = 55 + seed * 40;
    o.vel += (-o.off * stiff - o.vel * 6) * dt;
    o.off = Math.max(-3, Math.min(3, o.off + o.vel * dt));
    return o.off;
  };

  return {
    draw(f: Frame, dt: number, input: GrowInput) {
      t += dt;
      g += dt * PACE;
      const rdt = Math.min(dt, 1 / 30);
      f.buf.fill(0);
      const buf = f.buf;

      for (const s of wear) if (g > s.at) buf[s.i] = s.col;
      for (const s of soil) if (g > s.at) buf[s.i] = s.col;
      for (const s of moss) if (g > s.at) buf[s.i] = s.col;

      // the creeping ivy: the stem as far as it's grown, then its leaves opening behind it
      const step10 = Math.floor(t * 10);
      for (const cr of creepers) {
        for (let k = 0; k < cr.pts.length; k++) {
          const p = cr.pts[k];
          if (g < p.at) break;
          put(f, p.x, p.y, k % 5 === 4 ? STEM_DARK : STEM);
        }
        for (const l of cr.leaves) {
          const age = g - l.at;
          if (age < 0) continue;
          // they shiver when a gust passes over, or when the pointer is close
          const flick = gust(l.x, l.y, step10 / 10) > 0.55 && hash(l.seed, step10) < 0.4 ? windDir : 0;
          const dx = Math.max(-1, Math.min(1, flick + Math.round(brush(l, l.x, l.y, l.seed, input, rdt) * 0.5)));
          leaf(f, l.x + dx, l.y, l.side, l.shape, l.tone, age);
          // a few of them flower, a while after they've leafed
          if (l.bloom >= 0 && age > 2.5) {
            const [p, ht] = BLOOMS[l.bloom];
            const fx = l.x + dx + l.side * 2;
            put(f, fx, l.y - 1, ht);
            put(f, fx - 1, l.y - 1, p);
            put(f, fx + 1, l.y - 1, p);
            put(f, fx, l.y - 2, p);
            if (age > 3.2) put(f, fx, l.y, p);
          }
        }
      }

      // the hanging vines: grow a link at a time, then step the rope
      const step = Math.min(dt, 1 / 30);
      for (const v of vines) {
        if (g < v.at) continue;
        const want = Math.min(v.len, 1 + Math.floor((g - v.at) * v.speed));
        while (v.nodes.length < want) {
          const tip = v.nodes[v.nodes.length - 1];
          v.nodes.push({ x: tip.x, y: tip.y + SEG * 0.6, px: tip.x, py: tip.y + SEG * 0.6 });
        }
        const ns = v.nodes;
        for (let k = 1; k < ns.length; k++) {
          const n = ns[k];
          const vx = (n.x - n.px) * 0.97;
          const vy = (n.y - n.py) * 0.97;
          n.px = n.x;
          n.py = n.y;
          const reach = k / Math.max(4, v.len);
          // a gentle s-curve of its own, the way a vine never hangs quite plumb, plus the wind
          let ax =
            Math.sin(k * 0.32 + v.seed * 40) * 26 * v.curl +
            gust(n.x, n.y, t) * windDir * 55 * (0.4 + reach) +
            Math.sin(t * 2.1 + v.seed * 20 + k * 0.4) * 6;
          let ay = GRAVITY;
          if (input.x !== null && input.y !== null) {
            const dx = n.x - input.x;
            const dy = n.y - input.y;
            const d = Math.hypot(dx, dy);
            // nudged along by the pointer's movement as it passes, only gently pushed by its body
            if (d < 12 && d > 0.01) {
              const near = 1 - d / 12;
              ax += (dx / d) * near * 120 + Math.max(-260, Math.min(260, input.vx)) * near * 1.6;
              ay += (dy / d) * near * 50 + Math.max(-260, Math.min(260, input.vy)) * near * 0.8;
            }
          }
          n.x += vx + ax * step * step;
          n.y += vy + ay * step * step;
        }
        for (let it = 0; it < 4; it++) {
          ns[0].x = v.ax;
          ns[0].y = v.ay;
          for (let k = 0; k < ns.length - 1; k++) {
            const a = ns[k];
            const b = ns[k + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.001;
            const diff = (d - SEG) / d;
            if (k === 0) {
              b.x -= dx * diff;
              b.y -= dy * diff;
            } else {
              a.x += dx * diff * 0.5;
              a.y += dy * diff * 0.5;
              b.x -= dx * diff * 0.5;
              b.y -= dy * diff * 0.5;
            }
          }
        }
        for (let k = 0; k < ns.length - 1; k++) line(f, ns[k].x, ns[k].y, ns[k + 1].x, ns[k + 1].y, k % 4 === 3 ? STEM_DARK : STEM);
        const grownLinks = (g - v.at) * v.speed;
        for (let k = 1; k < ns.length; k++) {
          if (hash(v.seed, k) > 0.6) continue;
          const age = (grownLinks - k) / v.speed;
          if (age < 0.2) continue;
          const side = hash(v.seed, k + 3) < 0.5 ? v.side : -v.side;
          leaf(f, Math.round(ns[k].x), Math.round(ns[k].y), side, sprigOf(hash(v.seed, k + 50)), leafTone(hash(v.seed, k + 7)), age);
        }
      }


      // weeds, behind the grass: a stalk, sprigs up it, and a tuft or seed head on top
      for (const wd of weeds) {
        const a = g - wd.at;
        if (a <= 0) continue;
        const h = Math.ceil(wd.h * Math.min(1, a / 1.2));
        const lean = sway(wd.x, wd.y, wd.seed, 1.3) + brush(wd, wd.x, wd.y - wd.h / 2, wd.seed, input, rdt);
        let tx = wd.x;
        for (let k = 0; k < h; k++) {
          tx = wd.x + Math.round(wd.lean * k + lean * (k / Math.max(1, wd.h)) ** 1.3);
          put(f, tx, wd.y - k, k < 2 ? GRASS[3] : GRASS[2]);
          if (k > 2 && k < h - 1 && hash(wd.seed, k) < 0.4) leaf(f, tx, wd.y - k, hash(wd.seed, k + 9) < 0.5 ? -1 : 1, sprigOf(hash(wd.seed, k + 4) * 0.5), leafTone(hash(wd.seed, k + 2) * 0.8), a);
        }
        if (h === wd.h && a > 1.5) {
          const y = wd.y - h;
          if (wd.top === 0) {
            // a dry seed head
            put(f, tx, y, STRAW[0]);
            put(f, tx - 1, y + 1, STRAW[1]);
            put(f, tx + 1, y + 1, STRAW[1]);
            put(f, tx, y - 1, STRAW[0]);
          } else {
            const [p, ht] = BLOOMS[wd.top % BLOOMS.length];
            put(f, tx, y, ht);
            put(f, tx - 1, y, p);
            put(f, tx + 1, y, p);
            put(f, tx, y - 1, p);
          }
        }
      }

      // the blades, bending to the gusts each on its own beat, parting round the pointer
      for (const b of blades) {
        const a = g - b.at;
        if (a <= 0) continue;
        const h = Math.ceil(b.h * Math.min(1, a / 0.7));
        const lean = sway(b.x, b.y, b.seed, Math.min(1.4, h / 3)) + brush(b, b.x, b.y - h / 2, b.seed, input, rdt) * Math.min(1, h / 4);
        let tx = b.x;
        for (let k = 0; k < h; k++) {
          tx = b.x + (k === 0 ? 0 : Math.round(lean * Math.pow(k / Math.max(1, h - 1), 1.2))) + (k === h - 1 && h > 1 ? b.kink : 0);
          put(f, tx, b.y - k, b.col);
        }
        // seed heads on the dry ones: a little zigzag of paler grains at the top
        if (b.head && h === b.h) {
          put(f, tx - 1, b.y - h + 2, STRAW[0]);
          put(f, tx + 1, b.y - h + 1, STRAW[0]);
          put(f, tx, b.y - h, STRAW[0]);
        }
        if (b.bloom && a > 2.5) {
          const [p, ht] = BLOOMS[b.bloom - 1];
          put(f, tx, b.y - h, ht);
          put(f, tx - 1, b.y - h, p);
          put(f, tx + 1, b.y - h, p);
        }
      }

      // the long blades arching over: rising almost straight, then bending further and further
      // until the tip hangs, nodding with the wind
      for (const ar of arches) {
        const a = g - ar.at;
        if (a <= 0) continue;
        const L = Math.round(ar.len * Math.min(1, a / 1.4));
        const lean = sway(ar.x, ar.y, ar.seed, 1.4) * 0.35 + brush(ar, ar.x, ar.y - ar.len / 2, ar.seed, input, rdt) * 0.3;
        let x = ar.x;
        let y = ar.y;
        const bend = (1.6 + ar.droop / ar.len) * ar.dir;
        for (let k = 0; k < L; k++) {
          const u = k / Math.max(1, ar.len);
          const ang = ar.dir * 0.15 + (bend + lean) * u * u;
          x += Math.sin(ang);
          y -= Math.cos(ang);
          put(f, x, y, ar.cols[u < 0.35 ? 0 : u < 0.75 ? 1 : 2]);
        }
      }
    },
  };
}
