import { BAYER, blit, c, sprite, type Frame, type Sprite } from "./frame";
import { makeNoise3 } from "./world";

/** six tones each, darkest first: trunk-dark, deep shadow, shadow, mid, light, highlight */
export const TREE_GREEN = [0x2a1a2e, 0x26385a, 0x26767e, 0x34b46a, 0xaad476, 0xe6ec8a];
export const TREE_OLIVE = [0x2a1e1a, 0x34401c, 0x4a6224, 0x6e8a2a, 0xa8b03a, 0xd8d870];
export const TREE_AUTUMN = [0x2a1a22, 0x5a2a36, 0x9a3a2a, 0xd8682a, 0xf2a63a, 0xffe08a];
export const TREE_TEAL = [0x1e1a2a, 0x1e3a4a, 0x2a6a6a, 0x3a9a7a, 0x8ac88a, 0xd4f0a8];

/** a clump of leaves: where it sits relative to the foot of the trunk, and how it's moving */
export type Clump = { x: number; y: number; r: number; s: Sprite; ox: number; oy: number; vx: number; vy: number; seed: number };
export type Tree = { body: Sprite; ax: number; ay: number; clumps: Clump[]; top: number };

/**
 * a tree, the way pixel artists draw one: a lumpy silhouette of a canopy on a dark trunk
 * that flares at the root and forks into it; the canopy made of clumps of leaves laid down
 * from the bottom up, so each one higher up sits in front and throws a dark crescent on the
 * one below. light comes from one side, so one half of the crown is bright and the other in
 * shade, and each clump is lit on its own too: a highlight on its sunny shoulder, its
 * underside dark. the clumps are kept separate so they can move.
 */
export function makeTree(
  rand: () => number,
  R: number,
  tones: number[],
  opts: { light?: number; trunk?: number; blossom?: number[] | null; bark?: number[] } = {},
): Tree {
  const noise = makeNoise3(rand);
  const light = opts.light ?? 1;
  const trunkH = R * (opts.trunk ?? 1.1);
  const RX = R * (1.05 + rand() * 0.2);
  const RY = R * (0.8 + rand() * 0.15);
  const CY = -(trunkH + RY * 0.55);
  const pal = tones.map(c);
  // bark has its own browns: dark, mid, and the strip the light catches
  const bk = (opts.bark ?? [0x2a1a1e, 0x5a3a2c, 0x8a5e3e]).map(c);

  // the circles that make the crown: big ones inside, smaller ones round the rim for bumps
  const circles: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < 14; k++) {
    for (let tries = 0; tries < 20; tries++) {
      const x = (rand() * 2 - 1) * RX * 0.75;
      const y = CY + (rand() * 2 - 1) * RY * 0.7;
      if ((x / RX) ** 2 + ((y - CY) / RY) ** 2 > 0.55) continue;
      circles.push({ x, y, r: R * (0.32 + rand() * 0.16) });
      break;
    }
  }
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + rand() * 0.3;
    // the underside is flatter and a little ragged, with gaps for the boughs
    const under = Math.sin(a) > 0.3;
    if (under && rand() < 0.35) continue;
    circles.push({ x: Math.cos(a) * RX * 0.82, y: CY + Math.sin(a) * RY * (under ? 0.7 : 0.82), r: R * (0.2 + rand() * 0.12) });
  }

  // the body: trunk and boughs, then the crown's silhouette in deep shadow behind the clumps
  const pad = Math.ceil(R * 0.5);
  const bw = Math.ceil(RX * 2 + pad * 2);
  const bh = Math.ceil(-CY + RY + pad + 2);
  const ax = Math.round(bw / 2);
  const ay = bh - 1;
  const body = sprite(bw, bh);
  const put = (x: number, y: number, col: number) => {
    const xi = Math.round(x + ax);
    const yi = Math.round(y + ay);
    if (xi >= 0 && xi < bw && yi >= 0 && yi < bh) body.px[yi * bw + xi] = col;
  };
  for (const cl of circles)
    for (let y = Math.floor(cl.y - cl.r); y <= Math.ceil(cl.y + cl.r); y++)
      for (let x = Math.floor(cl.x - cl.r); x <= Math.ceil(cl.x + cl.r); x++) {
        const d = Math.hypot(x + 0.5 - cl.x, y + 0.5 - cl.y) / cl.r;
        if (d <= 1 + noise(x * 0.4, y * 0.4, 1, 1) * 0.25) put(x, y, pal[1]);
      }
  const wB = Math.max(2, R * 0.17);
  const wT = Math.max(1.2, R * 0.1);
  const top = -trunkH - RY * 0.2;
  for (let y = 0; y >= top; y--) {
    const t = y / top;
    // the trunk flares at the root and leans a touch
    const w = wT + (wB - wT) * (1 - t) + (t < 0.12 ? (0.12 - t) * R * 0.9 : 0);
    const cx = Math.sin(t * 2.2) * R * 0.05;
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      const u = (x + 0.5 - cx) / w;
      if (Math.abs(u) > 1) continue;
      // dark, with a strip of light down the sunny side and a groove or two
      const lit = u * light > 0.35 && u * light < 0.85;
      const groove = Math.abs(Math.sin(u * 5 + y * 0.15)) < 0.12 && t > 0.15;
      put(x, y, groove ? bk[0] : lit ? bk[2] : u * light > -0.2 ? bk[1] : bk[0]);
    }
  }
  // boughs forking up into the crown
  for (const side of [-1, 1, rand() < 0.5 ? -1 : 1]) {
    const from = -trunkH * (0.62 + rand() * 0.15);
    const len = R * (0.55 + rand() * 0.3);
    const ang = side * (0.5 + rand() * 0.4);
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = Math.sin(ang) * k;
      const y = from - Math.cos(ang) * k;
      const w = Math.max(0.6, wT * (1 - t * 0.6));
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) put(x + dx, y, side * light > 0 && dx * light > 0 ? bk[2] : bk[1]);
    }
  }

  // the clumps: a selection of the crown's circles, each its own little lit shape
  const chosen = circles.filter((cl) => cl.r > R * 0.2).sort((a, b) => b.y + b.r * 0.2 - (a.y + a.r * 0.2));
  const L = [0.62 * light, -0.78];
  const clumps: Clump[] = chosen.map((cl, idx) => {
    const r = cl.r * 1.02;
    const size = Math.ceil(r * 2 + 3);
    const s = sprite(size, size);
    const cx = size / 2;
    const cy = size / 2;
    // how lit this clump is, by where it sits in the crown
    const gx = cl.x / RX;
    const gy = (cl.y - CY) / RY;
    const global = gx * L[0] + gy * L[1];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const nx = (x + 0.5 - cx) / r;
        const ny = (y + 0.5 - cy) / r;
        // leafy, scalloped edges
        const edge = 1 + noise(x * 0.5 + idx * 7, y * 0.5, 3, 1) * 0.35;
        const d = Math.hypot(nx, ny);
        if (d > edge) continue;
        const local = nx * L[0] + ny * L[1];
        const leafy = noise(x * 0.3 + idx * 3, y * 0.3, 5, 1) * 0.5;
        let v = 2.4 + global * 1.4 + local * 1.1 + leafy + BAYER[(y & 3) * 4 + (x & 3)] * 0.15;
        // the underside of the clump, away from the light, sinks into shadow
        if (local < -0.45 && d > 0.55) v -= 1.1;
        s.px[y * size + x] = pal[Math.max(1, Math.min(5, Math.round(v)))];
      }
    // blossom, scattered over the sunny side
    if (opts.blossom)
      for (let k = 0; k < r * 0.6; k++) {
        const a = rand() * Math.PI * 2;
        const dd = rand() * r * 0.75;
        const x = Math.round(cx + Math.cos(a) * dd);
        const y = Math.round(cy + Math.sin(a) * dd - r * 0.1);
        if (x < 1 || y < 1 || x >= size - 1 || y >= size - 1 || !s.px[y * size + x]) continue;
        const col = c(opts.blossom[Math.floor(rand() * opts.blossom.length)]);
        for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (s.px[(y + oy) * size + x + ox]) s.px[(y + oy) * size + x + ox] = col;
      }
    return { x: cl.x, y: cl.y, r, s, ox: 0, oy: 0, vx: 0, vy: 0, seed: Math.floor(rand() * 1e6) };
  });
  return { body, ax, ay, clumps, top: CY - RY };
}

/** draws a tree with its foot at (x, y), its clumps where their springs have them */
export function drawTree(f: Frame, tree: Tree, x: number, y: number) {
  blit(f, tree.body, x - tree.ax, y - tree.ay);
  for (const cl of tree.clumps) blit(f, cl.s, x + cl.x + cl.ox - cl.s.w / 2, y + cl.y + cl.oy - cl.s.h / 2);
}
