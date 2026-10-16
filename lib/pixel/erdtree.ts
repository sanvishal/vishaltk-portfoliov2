import { BAYER, c, mix, mixPacked, mulberry32, type Frame } from "./frame";
import type { PlaceMaker } from "./scene";
import { makeNoise3 } from "./world";

/** whether this field is, instead, the lands beneath a golden tree */
export const isErdtree = (seed: number) => mulberry32(seed * 577 + 23)() < 0.1;

/**
 * seen from a high cliff: a valley of ruins in green haze, and beyond it a tree so large its
 * crown fills half the sky, white and gold and glittering, its light pouring down in rays.
 * a castle on the cliffs to the left, an aqueduct across the valley, a broken tower at the
 * tree's foot; mist in the low ground and gold leaves on the wind. click for grace.
 */
export const erdtree: PlaceMaker = (seed, W, H) => {
  const rand = mulberry32(seed * 613 + 31);
  const noise = makeNoise3(rand);
  const base = new Uint32Array(W * H);
  const dither = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

  // ---- the tree's place in the picture ----
  const tx = W * (0.7 + rand() * 0.05);
  const split = H * 0.3;
  const foot = H * 0.62;

  // ---- the sky: a green storm, darkest to the upper left, lit gold round the crown ----
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dth = dither(x, y);
      const t = y / H;
      let col = mix(0x1e2a1a, 0xaab47a, Math.min(1, t * 1.6));
      const n = noise(x * 0.018, y * 0.03, 1, 4) + (1 - x / W) * 0.3 - t * 0.5;
      if (n + dth * 0.1 > 0.12) col = mix(col, 0x141c12, Math.min(0.85, (n - 0.1) * 2.4));
      else if (n + dth * 0.1 > 0.02) col = mix(col, 0x3e4a30, 0.45);
      // the glow of the crown, spilling across the sky
      const d = Math.hypot((x - tx) / W, ((y - split * 0.6) / H) * 1.3);
      const warm = Math.max(0, 0.62 - d * 1.2);
      col = mix(col, 0xf2e2a0, Math.min(0.6, warm * 0.9));
      base[y * W + x] = c(col);
    }

  // ---- the tree: a great trunk out of the mist, limbs fanning out, fine strands weeping ----
  const light = new Float32Array(W * H);
  type Seg = { x0: number; y0: number; x1: number; y1: number; w: number };
  const segs: Seg[] = [];
  const tips: { x: number; y: number }[] = [];
  const grow = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    const bend = (rand() - 0.5) * 0.25;
    const x1 = x + Math.cos(a + bend) * len;
    const y1 = y - Math.sin(a + bend) * len;
    segs.push({ x0: x, y0: y, x1, y1, w });
    if (depth === 0) {
      tips.push({ x: x1, y: y1 });
      // long strands hanging from the ends of the boughs
      if (rand() < 0.45) {
        let hx = x1;
        let hy = y1;
        const steps = 3 + Math.floor(rand() * 4);
        for (let k = 0; k < steps; k++) {
          const nx = hx + (rand() - 0.5) * 2.5;
          const ny = hy + 3 + rand() * 4;
          segs.push({ x0: hx, y0: hy, x1: nx, y1: ny, w: 0.3 });
          hx = nx;
          hy = ny;
        }
      }
      return;
    }
    const n = 2 + (rand() < 0.3 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const spread = (k / (n - 1) - 0.5) * (0.8 + rand() * 0.6);
      // the crown spreads wide: limbs drift outward toward the horizontal as they go
      const pull = (Math.PI / 2 - a) * -0.12;
      grow(x1, y1, a + spread + pull, len * (0.68 + rand() * 0.14), w * 0.62, depth - 1);
    }
  };
  // the trunk, wide at the root and tapering, leaning a little
  const trunk: Seg = { x0: tx + W * 0.025, y0: foot + H * 0.04, x1: tx, y1: split, w: W * 0.065 };
  for (let k = 0; k < 10; k++) {
    const a = Math.PI * (0.08 + (k / 9) * 0.86) + (rand() - 0.5) * 0.12;
    const from = split + (k % 3) * H * 0.03;
    grow(tx + (rand() - 0.5) * W * 0.04, from, a, H * (0.22 + rand() * 0.1), W * 0.02, 5);
  }
  const lay = (s: Seg, halo: number, taper = 0.35) => {
    const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    const steps = Math.ceil(len * 2) + 1;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const x = s.x0 + (s.x1 - s.x0) * t;
      const y = s.y0 + (s.y1 - s.y0) * t;
      // a trunk flares at its roots
      const r = Math.max(0.3, s.w * (1 - t * taper) * (taper > 0.4 ? 1 + 0.6 * Math.max(0, 0.15 - t) / 0.15 : 1));
      for (let yy = Math.floor(y - r - halo); yy <= Math.ceil(y + r + halo); yy++)
        for (let xx = Math.floor(x - r - halo); xx <= Math.ceil(x + r + halo); xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
          const v = d <= r ? 1 : Math.max(0, 0.35 * (1 - (d - r) / halo));
          if (v > light[yy * W + xx]) light[yy * W + xx] = v;
        }
    }
  };
  lay(trunk, 3, 0.5);
  for (const s of segs) lay(s, 1.1);
  const GOLD = [0xa8782a, 0xd8a83e, 0xffd468, 0xfff0b8, 0xffffff];
  const leaf = new Uint8Array(W * H);
  // gold leaves crowding the outer boughs, thickest at the top of the crown
  for (const tp of tips) {
    const dense = tp.y < H * 0.2 ? 6 : 3;
    for (let k = 0; k < dense; k++) {
      const lx = tp.x + (rand() - 0.5) * 12;
      const ly = tp.y + (rand() - 0.5) * 7;
      const r = 0.7 + rand() * 1.6;
      for (let yy = Math.floor(ly - r); yy <= Math.ceil(ly + r); yy++)
        for (let xx = Math.floor(lx - r); xx <= Math.ceil(lx + r); xx++)
          if (xx >= 0 && xx < W && yy >= 0 && yy < H && Math.hypot(xx - lx, yy - ly) <= r) leaf[yy * W + xx] = 1;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dth = dither(x, y);
      const g = light[i];
      if (leaf[i] && g < 1) {
        const n = noise(x * 0.3, y * 0.3, 7, 1);
        base[i] = c(GOLD[Math.max(1, Math.min(3, Math.floor(2 + n * 3 + dth)))]);
      } else if (g >= 1) {
        // the trunk is streaked, its far side gold; the boughs burn nearly white
        const inTrunk = y > split - H * 0.02 && y < foot + H * 0.06;
        if (inTrunk) {
          const u = noise(x * 0.7, y * 0.04, 5, 1);
          base[i] = c(GOLD[u + dth * 0.3 > 0.08 ? 4 : u > -0.15 ? 3 : 2]);
        } else base[i] = c(GOLD[dth > -0.2 ? 4 : 3]);
      } else if (g > 0) base[i] = mixPacked(base[i], c(0xffe8a0), Math.floor((g + dth * 0.12) * 6) / 6);
    }

  // ---- the land: valley, ruins, mist, cliffs; all hazier the further off ----
  const haze = (y: number) => mix(0xb8c08a, 0x7a8a5a, Math.max(0, Math.min(1, (y / H - 0.45) * 2.2)));
  const solid = (x: number, y: number, rgb: number, depth: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && xi < W && yi >= 0 && yi < H) base[yi * W + xi] = c(mix(rgb, haze(yi), depth));
  };
  const block = (x: number, y: number, w: number, h: number, rgb: number, depth: number) => {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++)
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) solid(xx, yy, xx > x + w * 0.65 ? mix(rgb, 0x6a7450, 0.2) : rgb, depth);
  };

  // the valley floor, far and pale
  for (let x = 0; x < W; x++) {
    const top = H * 0.58 + noise(x * 0.04, 3, 3, 2) * H * 0.04;
    for (let y = Math.round(top); y < H; y++) solid(x, y, 0x4a5638, 0.55);
  }
  // a dark mesa at the far right
  for (let x = Math.round(W * 0.84); x < W; x++) {
    const top = H * 0.34 + noise(x * 0.08, 5, 3, 2) * H * 0.04 + (x < W * 0.87 ? (W * 0.87 - x) * 0.8 : 0);
    for (let y = Math.round(top); y < H * 0.62; y++) solid(x, y, 0x2a3222, 0.45);
  }
  // the castle on its cliff to the left
  const cx0 = W * 0.06;
  const cx1 = W * 0.33;
  for (let x = Math.round(cx0 - W * 0.06); x < Math.round(cx1 + W * 0.04); x++) {
    const top = H * 0.52 + noise(x * 0.07, 7, 3, 2) * H * 0.02;
    for (let y = Math.round(top); y < H * 0.64; y++) solid(x, y, 0x30382a, 0.4);
  }
  block(cx0, H * 0.43, cx1 - cx0, H * 0.1, 0x3a4232, 0.42);
  for (let k = 0; k < 7; k++) {
    const x = cx0 + (k / 6) * (cx1 - cx0 - W * 0.02);
    const th = H * (0.04 + rand() * 0.09);
    block(x, H * 0.43 - th, W * 0.02, th + 1, 0x3a4232, 0.42);
    for (let b = 0; b < 3; b++) block(x + b * 2, H * 0.43 - th - 2, 1, 2, 0x3a4232, 0.42);
    block(x + W * 0.007, H * 0.43 - th + 3, 1, 2, 0x10140c, 0.42);
  }
  for (let k = 0; k < 10; k++) block(cx0 + 3 + k * W * 0.025, H * 0.47, 1, 2, 0x10140c, 0.45);
  // the aqueduct across the valley: two tiers of arches
  const aq0 = W * 0.36;
  const aq1 = W * 0.66;
  for (const [ty, th, aw, depth] of [
    [H * 0.5, H * 0.09, W * 0.034, 0.48],
    [H * 0.45, H * 0.05, W * 0.022, 0.52],
  ]) {
    block(aq0, ty, aq1 - aq0, th, 0x3a4232, depth);
    for (let x = aq0 + 2; x < aq1 - aw; x += aw * 1.45) {
      if (rand() < 0.15) continue;
      for (let yy = Math.round(ty + th * 0.3); yy < Math.round(ty + th); yy++)
        for (let xx = Math.round(x); xx < Math.round(x + aw); xx++) {
          const u = (xx - x) / aw - 0.5;
          if (yy >= ty + th * 0.3 + (aw * 0.5 - Math.sqrt(Math.max(0, 0.25 - u * u)) * aw)) solid(xx, yy, 0xa8b07a, depth + 0.2);
        }
    }
  }
  // ruined towers, and the tall broken one at the tree's foot
  for (let k = 0; k < 4; k++) block(W * (0.4 + rand() * 0.24), H * (0.36 + rand() * 0.06), W * 0.016, H * 0.14, 0x343c2c, 0.48);
  block(tx - W * 0.075, H * 0.34, W * 0.022, H * 0.28, 0x2c3426, 0.38);
  block(tx - W * 0.078, H * 0.33, W * 0.028, 2, 0x2c3426, 0.38);

  // ---- the valley floor: a pale road winding through, old stones standing by it ----
  for (let k = 0; k < 3; k++) {
    let px = W * (0.3 + rand() * 0.4);
    for (let y = Math.round(H * 0.6); y < H * 0.72; y++) {
      px += Math.sin(y * 0.25 + k * 2) * 0.8 + (rand() - 0.5) * 0.6;
      const w = 1 + (y - H * 0.6) * 0.06;
      for (let x = Math.round(px - w); x <= Math.round(px + w); x++) solid(x, y, 0x9aa070, 0.45);
    }
  }
  for (let k = 0; k < 14; k++) {
    const x = W * (0.32 + rand() * 0.5);
    const y = H * (0.6 + rand() * 0.08);
    const h = 2 + Math.floor(rand() * 3);
    block(x, y - h, rand() < 0.5 ? 1 : 2, h, 0x5a5e4a, 0.4);
  }
  // a ruined bridge across a gully in the middle distance
  {
    const bx0 = W * (0.44 + rand() * 0.06);
    const bw = W * 0.16;
    const by = H * 0.6;
    block(bx0, by, bw, 3, 0x3a4232, 0.42);
    for (let x = Math.round(bx0); x < Math.round(bx0 + bw); x++) {
      const u = (x - bx0) / bw;
      const sag = Math.sin(u * Math.PI) * H * 0.03;
      for (let y = Math.round(by + 3); y < Math.round(by + 3 + H * 0.05 - sag); y++) if (u < 0.12 || u > 0.88 || y < by + 5) solid(x, y, 0x3a4232, 0.42);
    }
    block(bx0 + bw * 0.62, by - 1, bw * 0.12, 1, 0x7a8a5a, 0.42);
  }

  // ---- the cliffs we stand on: flat-topped slabs, layered rock faces, grass along the tops ----
  const slab = (x0: number, x1: number, top: number, rough: number, k: number, face: number, moss: number) => {
    const tops: number[] = [];
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x1)); x++) {
      const edge = Math.min(x - x0, x1 - x) / 6;
      const t = top + noise(x * 0.06, k, 9, 2) * rough + (edge < 1 ? (1 - edge) * 8 : 0);
      tops[x] = t;
      for (let y = Math.max(0, Math.round(t)); y < H; y++) {
        const dth = dither(x, y);
        const down = y - t;
        const crack = Math.abs(noise(x * 0.12, y * 0.03, k + 4, 1));
        // the rock is lit from above by the tree, shading darker toward its foot
        let col = mix(mix(face, 0x8a9468, 0.22), mix(face, 0x000000, 0.25), Math.min(1, down / 34));
        // strata: layers of rock running across the face, broken here and there
        const layer = Math.floor((down + noise(x * 0.05, k, 13, 1) * 4) / 5);
        if ((down + noise(x * 0.05, k, 13, 1) * 4) % 5 < 1 && noise(x * 0.09, layer, k + 2, 1) > -0.1) col = mix(col, 0x000000, 0.28);
        else if (layer % 3 === 1) col = mix(col, 0x9aa070, 0.07);
        if (down < 2) col = moss;
        else if (down < 5 && dth > -0.1) col = mix(col, moss, 0.5);
        else if (crack < 0.015 && noise(x * 0.05, y * 0.05, k + 6, 1) > 0) col = mix(col, 0x000000, 0.4);
        else if (noise(x * 0.2, y * 0.2, k + 8, 1) + dth * 0.2 > 0.24) col = mix(col, 0x6a7450, 0.2);
        base[y * W + x] = c(col);
      }
    }
    // grass in tufts along the top, a few gold flowers, a boulder or two
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x1)); x++) {
      const t = tops[x];
      if (t === undefined) continue;
      if (rand() < 0.45) {
        const h = 1 + Math.floor(rand() * 3);
        for (let y = 1; y <= h; y++) {
          const yy = Math.round(t) - y;
          if (yy >= 0 && yy < H) base[yy * W + x] = c(mix(moss, 0xc8d070, y === h ? 0.35 : 0.1));
        }
        if (rand() < 0.08 && Math.round(t) - h - 1 >= 0) base[(Math.round(t) - h - 1) * W + x] = c(rand() < 0.6 ? 0xffc850 : 0xf4f0d0);
      }
    }
    for (let n = 0; n < 2 + Math.floor(rand() * 3); n++) {
      const bx = x0 + 8 + rand() * Math.max(1, x1 - x0 - 16);
      const t = tops[Math.round(bx)];
      if (t === undefined) continue;
      const r = 1.5 + rand() * 2.5;
      for (let y = Math.round(t - r * 1.4); y <= Math.round(t + 1); y++)
        for (let x = Math.round(bx - r); x <= Math.round(bx + r); x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const u = (x - bx) / r;
          const v = (t - y) / (r * 1.4);
          if (u * u + (v - 0.4) ** 2 * 1.8 < 0.6) base[y * W + x] = c(u < 0.1 && v > 0.5 ? mix(face, 0x9aa070, 0.4) : mix(face, 0x000000, 0.1));
        }
    }
    return tops;
  };
  const midTops = slab(W * 0.38, W * 0.82, H * 0.7, H * 0.025, 41, mix(0x2e3626, 0x7a8a5a, 0.35), mix(0x7a8a3a, 0xa8b07a, 0.3));
  const rightTops = slab(W * 0.72, W * 1.02, H * 0.74, H * 0.03, 47, 0x252c1e, 0x6a7a30);
  slab(W * 0.3, W * 0.68, H * 0.85, H * 0.03, 53, 0x1e2418, 0x5a6a28);
  slab(-W * 0.02, W * 0.42, H * 0.76, H * 0.04, 59, 0x1a2014, 0x56662a);

  // ruins standing on the cliffs: a broken archway, a fallen column, a stretch of wall
  const stone = (x: number, y: number, rgb: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && xi < W && yi >= 0 && yi < H) base[yi * W + xi] = c(rgb);
  };
  {
    const ax = Math.round(W * (0.5 + rand() * 0.12));
    const t = midTops[ax] ?? H * 0.7;
    const aw = Math.round(W * 0.05);
    const ah = Math.round(H * 0.12);
    const col = mix(0x4a5040, 0x7a8a5a, 0.35);
    for (let y = 0; y < ah; y++) {
      for (let q = 0; q < 3; q++) {
        stone(ax + q, t - y, q === 0 ? mix(col, 0xa8b07a, 0.4) : col);
        if (y < ah * 0.75) stone(ax + aw - q, t - y, q === 2 ? mix(col, 0xa8b07a, 0.4) : col);
      }
    }
    // the arch itself, broken off on one side
    for (let k = 0; k <= aw * 0.7; k++) {
      const u = k / aw;
      const y = t - ah + Math.round((1 - Math.sin(u * Math.PI)) * aw * 0.4);
      for (let q = 0; q < 3; q++) stone(ax + k, y - q, col);
    }
    // a column lying where it fell
    const fx = ax + aw + 6;
    const ft = midTops[Math.round(fx)] ?? t;
    for (let k = 0; k < 14; k++) for (let q = 0; q < 3; q++) stone(fx + k, ft - 1 - q, q === 0 ? mix(col, 0x000000, 0.2) : mix(col, 0xa8b07a, 0.2));
  }
  {
    const wx = Math.round(W * (0.78 + rand() * 0.08));
    const t = rightTops[wx] ?? H * 0.74;
    const col = mix(0x2e3426, 0x6a7a52, 0.25);
    for (let x = wx; x < wx + 14; x++) {
      const h = 9 + Math.round(Math.sin(x * 1.7) * 2 + (x > wx + 9 ? -4 : 0));
      for (let y = 0; y < h; y++) stone(x, t - y, x === wx ? mix(col, 0xa8b07a, 0.3) : col);
    }
    for (let y = 3; y < 6; y++) for (let x = wx + 4; x < wx + 6; x++) stone(x, t - y, 0x0e120a);
  }

  // trees: dark, here and there, rimmed gold on the side toward the tree, and a big one at the right
  const tree = (x: number, y: number, s: number, pointed: boolean, depth: number) => {
    for (let yy = Math.round(y - s * 1.7); yy <= Math.round(y); yy++)
      for (let xx = Math.round(x - s); xx <= Math.round(x + s); xx++) {
        const v = (y - yy) / (s * 1.7);
        const u = Math.abs(xx - x) / s;
        const n = noise(xx * 0.4, yy * 0.4, 17, 1) * 0.25;
        const inside = (uu: number) => (pointed ? uu < 1 - v + n : Math.hypot(uu, (v - 0.58) * 1.5) < 0.72 + n);
        if (!inside(u)) continue;
        // the edge facing the tree catches its light
        const toward = xx < tx ? xx > x : xx < x;
        const rim = toward && !inside(u + 1.6 / s) && s > 3;
        solid(xx, yy, rim ? 0x8a8a3a : 0x141a10, depth);
      }
    for (let yy = Math.round(y); yy < Math.round(y + s * 0.5); yy++) solid(x, yy, 0x141a10, depth);
  };
  for (let k = 0; k < 14; k++) tree(W * (0.33 + rand() * 0.55), H * (0.62 + rand() * 0.08), 2 + rand() * 2.5, rand() < 0.5, 0.35);
  tree(W * (0.9 + rand() * 0.05), H * 0.7, H * 0.08, false, 0.1);
  for (let k = 0; k < 5; k++) tree(W * (0.04 + rand() * 0.32), H * (0.76 + rand() * 0.04), 3 + rand() * 3, rand() < 0.6, 0.05);

  // ---- what moves ----
  const MIST = [
    { y: H * 0.6, h: H * 0.08, k: 0.75 },
    { y: H * 0.68, h: H * 0.05, k: 0.5 },
  ];
  const rays = Array.from({ length: 9 }, () => ({ ang: Math.PI * (0.15 + rand() * 0.8), w: 0.03 + rand() * 0.06, k: 0.28 + rand() * 0.22, p: rand() * 6 }));
  const sparks = Array.from({ length: 220 }, () => {
    const s = segs[Math.floor(rand() * segs.length)];
    const t = rand();
    return { x: s.x0 + (s.x1 - s.x0) * t, y: s.y0 + (s.y1 - s.y0) * t, p: rand() * 6.28, sp: 1.5 + rand() * 3 };
  });
  const leaves = Array.from({ length: 36 }, () => ({ x: rand() * W, y: rand() * H, vx: 4 + rand() * 6, vy: 3 + rand() * 5, p: rand() * 6 }));
  // a site of grace: a small gold light, sparks rising from it, threads of light pointing away
  let grace = -1;
  let graceAt = { x: W / 2, y: H / 2 };
  const motes: { x: number; y: number; vy: number; p: number; age: number; life: number }[] = [];
  let threads: { a: number; bend: number; delay: number }[] = [];
  let clock = rand() * 10;

  return {
    bloom: 1.3,
    hour: "day",
    draw(f: Frame, _t: number, dt: number, input) {
      clock += dt;
      if (input.clicks.length) {
        grace = 0;
        graceAt = input.clicks[0];
        motes.length = 0;
        threads = Array.from({ length: 3 }, (_, k) => ({ a: k * 0.18 - 0.18, bend: (Math.random() - 0.5) * 0.6, delay: 0.3 + k * 0.35 }));
      }
      const { buf } = f;
      buf.set(base);

      // god rays: broad beams fanning out from the crown and pouring down over everything
      {
        const ox = tx;
        const oy = split * 0.75;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const dx = x - ox;
            const dy = y - oy;
            if (dy < -H * 0.05) continue;
            const ang = Math.atan2(dy, dx);
            const dist = Math.hypot(dx, dy);
            // beams: bright bands at set angles, each breathing at its own pace
            let a = 0;
            for (const r of rays) {
              const d = Math.abs(ang - r.ang);
              if (d < r.w) a += (1 - d / r.w) ** 1.5 * r.k * (0.75 + Math.sin(clock * 0.6 + r.p) * 0.25);
            }
            if (a <= 0) continue;
            a *= Math.min(1, dist / (H * 0.1)) * Math.max(0, 1 - dist / (H * 1.25));
            const q = Math.floor((a + dither(x, y) * 0.03) * 12) / 12;
            if (q > 0) buf[y * W + x] = mixPacked(buf[y * W + x], c(0xfff6d0), Math.min(0.72, q));
          }
      }

      // mist lying in the valley, drifting
      for (const m of MIST)
        for (let y = Math.round(m.y - m.h); y < Math.round(m.y + m.h); y++) {
          if (y < 0 || y >= H) continue;
          const band = 1 - Math.abs(y - m.y) / m.h;
          for (let x = 0; x < W; x++) {
            const n = noise(x * 0.025 + clock * 0.04, y * 0.1, 13, 2);
            const a = Math.max(0, (n + 0.2) * band * m.k) + dither(x, y) * 0.04;
            const q = Math.floor(a * 6) / 6;
            if (q > 0) buf[y * W + x] = mixPacked(buf[y * W + x], c(0xdce0b0), Math.min(0.75, q));
          }
        }

      // the boughs glitter
      const white = c(0xffffff);
      const pale = c(0xfff4c0);
      for (const s of sparks) {
        const tw = Math.sin(clock * s.sp + s.p);
        if (tw < 0.5) continue;
        f.set(s.x, s.y, white);
        if (tw > 0.9) {
          f.set(s.x - 1, s.y, pale);
          f.set(s.x + 1, s.y, pale);
          f.set(s.x, s.y - 1, pale);
          f.set(s.x, s.y + 1, pale);
        }
      }

      // gold leaves on the wind, turning as they fall
      for (const l of leaves) {
        l.vx += (5 - l.vx) * dt * 0.8;
        l.vy += (4 - l.vy) * dt * 0.8;
        l.x += (l.vx + Math.sin(clock + l.p) * 4) * dt;
        l.y += l.vy * dt;
        if (l.x > W + 4) l.x = -4;
        if (l.x < -4) l.x = W + 4;
        if (l.y > H + 4) {
          l.y = -4;
          l.x = Math.random() * W;
        }
        const flip = Math.sin(clock * 3 + l.p);
        const col = c(flip > 0 ? 0xffc040 : 0xd88a20);
        f.set(l.x, l.y, col);
        if (Math.abs(flip) > 0.4) f.set(l.x + (flip > 0 ? 1 : -1), l.y, col);
      }

      // grace: a little gold light where you clicked, sparks drifting up out of it, and
      // threads of light streaking away toward the tree
      if (grace >= 0) {
        grace += dt;
        const life = 4.5;
        if (grace > life + 1.5 && motes.length === 0) grace = -1;
        else {
          const on = grace < life ? Math.min(1, grace / 0.4) : Math.max(0, 1 - (grace - life) / 0.8);
          const gx = graceAt.x;
          const gy = graceAt.y;
          // the halo, soft and stepped, flickering like a flame
          const flick = 0.85 + Math.sin(clock * 9) * 0.08 + Math.sin(clock * 23) * 0.05;
          for (let y = Math.round(gy - 14); y <= Math.round(gy + 14); y++)
            for (let x = Math.round(gx - 14); x <= Math.round(gx + 14); x++) {
              if (x < 0 || x >= W || y < 0 || y >= H) continue;
              const d = Math.hypot(x - gx, (y - gy) * 1.2) / 14;
              if (d >= 1) continue;
              const a = (1 - d) ** 1.6 * 0.95 * on * flick + dither(x, y) * 0.04;
              const q = Math.floor(a * 8) / 8;
              if (q > 0) buf[y * W + x] = mixPacked(buf[y * W + x], c(0xffe2a0), q);
            }
          // the core
          if (on > 0.05) {
            const core = c(0xfffbe8);
            f.set(gx, gy, core);
            f.set(gx, gy - 1, core);
            if (flick > 0.85) {
              f.set(gx - 1, gy, c(0xffe9a0));
              f.set(gx + 1, gy, c(0xffe9a0));
              f.set(gx, gy - 2, c(0xffe9a0));
            }
          }
          // sparks rising
          if (grace < life && Math.random() < dt * 28) motes.push({ x: gx + (Math.random() - 0.5) * 4, y: gy, vy: 7 + Math.random() * 9, p: Math.random() * 6, age: 0, life: 1.4 + Math.random() * 1.4 });
          for (let k = motes.length - 1; k >= 0; k--) {
            const m = motes[k];
            m.age += dt;
            if (m.age > m.life) {
              motes.splice(k, 1);
              continue;
            }
            m.y -= m.vy * dt;
            const x = Math.round(m.x + Math.sin(m.age * 3 + m.p) * 2);
            const y = Math.round(m.y);
            const fade = 1 - m.age / m.life;
            if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = mixPacked(buf[y * W + x], c(fade > 0.6 ? 0xfff6d0 : 0xffc850), Math.min(1, fade * 1.4));
          }
          // threads of guidance: light running along a curve toward the crown, trailing
          for (const th of threads) {
            const t = (grace - th.delay) / 1.8;
            if (t < 0 || t > 1.4) continue;
            const ex = tx + Math.sin(th.a) * W * 0.25;
            const ey = split * 0.8;
            const mx = (gx + ex) / 2 + th.bend * W * 0.3;
            const my = Math.min(gy, ey) - H * 0.15;
            const at = (u: number) => ({
              x: (1 - u) ** 2 * gx + 2 * (1 - u) * u * mx + u * u * ex,
              y: (1 - u) ** 2 * gy + 2 * (1 - u) * u * my + u * u * ey,
            });
            for (let k = 0; k < 22; k++) {
              const u = Math.min(1, t) - k * 0.012;
              if (u < 0) break;
              const p = at(u);
              const fade = (1 - k / 22) * Math.max(0, 1 - Math.max(0, t - 1) / 0.4);
              const x = Math.round(p.x);
              const y = Math.round(p.y);
              const col = c(k < 3 ? 0xfffbe8 : 0xffd870);
              if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = mixPacked(buf[y * W + x], col, fade);
              if (x >= 0 && x < W && y + 1 >= 0 && y + 1 < H) buf[(y + 1) * W + x] = mixPacked(buf[(y + 1) * W + x], col, fade * 0.5);
            }
          }
        }
      }
    },
  };
};
