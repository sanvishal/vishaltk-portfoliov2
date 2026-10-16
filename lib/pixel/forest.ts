import { BAYER, c, mix, mixPacked, mulberry32, type Frame } from "./frame";
import type { PlaceMaker } from "./scene";
import { pickTime, type Time } from "./time";
import { makeNoise3 } from "./world";

/** the forest's colours at each hour: mist, leaves overhead, the sky through them, ground, bark */
type Mood = {
  fog: number;
  /** the glow far off at eye level, and the gloom up under the leaves */
  fogHi: number;
  fogTop: number;
  /** how much mist lies along the ground */
  mist: number;
  canopy: number[];
  gap: number;
  floor: number[];
  bark: number[];
  moss: number;
  fern: number[];
  light: number;
  /** how strongly the shafts of light show, 0 for none */
  shafts: number;
  spirit: number[];
  bloom: number;
  night: boolean;
};

const MOODS: Record<Time["name"], Mood> = {
  dawn: {
    fog: 0xb4a6bc,
    fogHi: 0xf6dcd2,
    fogTop: 0x3c3a4e,
    mist: 0.55,
    canopy: [0x2a3438, 0x37454a, 0x46565a],
    gap: 0xf4dcd4,
    floor: [0x2f4034, 0x3f553f, 0x55704a, 0x6b5a4c],
    bark: [0x2a2428, 0x423638, 0x5e4c4c, 0x7a6460],
    moss: 0x6a8a52,
    fern: [0x3e5a3e, 0x56784e, 0x7a9a64],
    light: 0xffe4cc,
    shafts: 0.24,
    spirit: [0xf2f2ea, 0xd2d4cc, 0xa8aca6],
    bloom: 0.35,
    night: false,
  },
  day: {
    fog: 0x93b896,
    fogHi: 0xe2f4c8,
    fogTop: 0x24402c,
    mist: 0.3,
    canopy: [0x16301e, 0x214226, 0x2e5630],
    gap: 0xe8f6d0,
    floor: [0x23401f, 0x335a28, 0x4a7a32, 0x5e4a30],
    bark: [0x241c16, 0x3c2e22, 0x5a4632, 0x7a6248],
    moss: 0x6e9a3a,
    fern: [0x2e5a24, 0x467e30, 0x6aa240],
    light: 0xfff4c4,
    shafts: 0.28,
    spirit: [0xf4f6ee, 0xd6dccf, 0xaab2a6],
    bloom: 0.25,
    night: false,
  },
  golden: {
    fog: 0xc4a064,
    fogHi: 0xffe6a4,
    fogTop: 0x3a3018,
    mist: 0.35,
    canopy: [0x2a2a14, 0x3a3a1a, 0x4e4c22],
    gap: 0xfff0b0,
    floor: [0x3a3a1a, 0x52521f, 0x6e6a28, 0x6a4a24],
    bark: [0x2a1a10, 0x44301c, 0x664a2a, 0x8a663a],
    moss: 0x8a9a36,
    fern: [0x4a5a20, 0x66782a, 0x8e9a3a],
    light: 0xffd98a,
    shafts: 0.34,
    spirit: [0xfff6e4, 0xe6d8c0, 0xb8a890],
    bloom: 0.45,
    night: false,
  },
  dusk: {
    fog: 0x4e4672,
    fogHi: 0xe0909a,
    fogTop: 0x16142a,
    mist: 0.45,
    canopy: [0x141428, 0x1c1c36, 0x262444],
    gap: 0xe89a7a,
    floor: [0x1a2230, 0x22303a, 0x2e4040, 0x302838],
    bark: [0x16121c, 0x241e2c, 0x382e40, 0x4c3e52],
    moss: 0x3e5a4e,
    fern: [0x1e3434, 0x2c4a42, 0x3e6450],
    light: 0xffb08a,
    shafts: 0.14,
    spirit: [0xeef4f2, 0xc6d4d8, 0x8ea4b4],
    bloom: 0.75,
    night: true,
  },
  night: {
    fog: 0x18243e,
    fogHi: 0x40609c,
    fogTop: 0x060a14,
    mist: 0.4,
    canopy: [0x080c18, 0x0c1222, 0x121a2e],
    gap: 0x7a90c4,
    floor: [0x0c141c, 0x121e26, 0x1a2a30, 0x1c1c26],
    bark: [0x0a0c12, 0x14181f, 0x20262f, 0x2c3440],
    moss: 0x24443e,
    fern: [0x10241f, 0x183429, 0x244a3a],
    light: 0xa8c4f4,
    shafts: 0.16,
    spirit: [0xeaf6f4, 0xbcd6dc, 0x86a6b8],
    bloom: 0.95,
    night: true,
  },
};

const MAX_D = 46;
const CELL = 3.2;
const CANOPY = 10.5;
const LEAVES = 7.6;
const EYE = 1.45;

/**
 * a walk through an old forest, drifting along a path between trunks too big to see the top
 * of, under a canopy that lets the light through in shafts. small white spirits sit among
 * the roots; they turn their heads to watch your pointer, and rattle when you click. all of
 * it is real 3d, drawn pixel by pixel: the ground and the leaves overhead are cast row by
 * row, everything else stands in depth order, and the mist takes whatever is far away.
 */
export const forest: PlaceMaker = (seed, W, H, night, hour) => {
  const rand = mulberry32(seed);
  const time = pickTime(rand, night, hour);
  const m = MOODS[time.name];
  const noise = makeNoise3(mulberry32(seed * 7 + 3));
  const mistP = c(mix(m.fogHi, m.fog, 0.3));
  // the mist's colour changes with height in the picture: glowing at eye level far off,
  // gloomier up under the leaves. worked out per row each frame, as the view tilts
  const fogRows = new Uint32Array(H);
  const fogY = (y: number) => fogRows[y < 0 ? 0 : y >= H ? H - 1 : y];
  const lightP = c(m.light);
  const gapP = c(m.gap);
  const canopyP = m.canopy.map(c);
  const floorP = m.floor.map(c);
  const barkP = m.bark.map(c);
  const mossP = c(m.moss);
  const lichenP = c(mix(m.moss, 0xdfe6cf, 0.55));
  const fernP = m.fern.map(c);
  const spiritP = m.spirit.map(c);
  const faceP = c(0x15141c);

  const density = 0.042 + rand() * 0.022;
  const treeOdds = 0.5 + rand() * 0.25;
  const giantOdds = 0.1 + rand() * 0.15;
  const spiritOdds = 0.7 + rand() * 0.25;
  const lean = (rand() - 0.5) * 0.7;
  const lightSide = rand() < 0.5 ? -1 : 1;
  const ph1 = rand() * 100;
  const ph2 = rand() * 100;
  const speed = 0.45 + rand() * 0.25;
  const start = rand() * 400;

  // the path winds, and the trees keep off it
  const pathX = (z: number) => 2.6 * Math.sin(z * 0.045 + ph1) + 1.3 * Math.sin(z * 0.11 + ph2);

  const hash = (i: number, j: number, k: number) => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k + seed * 31, 0x27d4eb2d);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  type Tree = {
    x: number;
    z: number;
    r: number;
    grooves: number;
    turn: number;
    stubs: { h: number; side: number; len: number }[];
    /** how much moss and lichen it carries */
    moss: number;
  };
  /** one of the little forest spirits. each has its own head: how wide, how tall, how lumpy */
  type Spirit = {
    x: number;
    z: number;
    /** how high it sits: 0 on the ground, more when it's perched on a rock */
    y: number;
    size: number;
    ph: number;
    rattle: number;
    next: number;
    headW: number;
    headH: number;
    lump: number;
    eyeGap: number;
    mouth: number;
    tilt: number;
    sit: boolean;
  };
  const makeSpirit = (i: number, j: number, k: number, x: number, z: number, y = 0): Spirit => ({
    x,
    z,
    y,
    size: 0.34 + hash(i, j, 70 + k) * 0.22,
    ph: hash(i, j, 80 + k) * 6.28,
    rattle: -1,
    next: 3 + hash(i, j, 90 + k) * 10,
    headW: 0.5 + hash(i, j, 200 + k) * 0.16,
    headH: 0.4 + hash(i, j, 210 + k) * 0.14,
    lump: (hash(i, j, 220 + k) - 0.5) * 0.5,
    eyeGap: 0.36 + hash(i, j, 230 + k) * 0.14,
    mouth: (hash(i, j, 240 + k) - 0.5) * 0.2,
    tilt: (hash(i, j, 250 + k) - 0.5) * 0.35,
    sit: y > 0 || hash(i, j, 260 + k) < 0.3,
  });
  type Prop = {
    kind: "fern" | "rock" | "shroom" | "bush";
    x: number;
    z: number;
    size: number;
    ph: number;
    tone: number;
    /** a bush is a heap of leafy lumps: where each sits, as fractions of its size */
    blobs?: { x: number; y: number; r: number }[];
  };
  type Shaft = { x: number; z: number; w: number };

  // what stands in each cell of the forest, made once and kept, so it's the same as you pass
  const cells = new Map<string, { tree: Tree | null; spirits: Spirit[]; props: Prop[]; shaft: Shaft | null }>();
  const cellAt = (i: number, j: number) => {
    const key = `${i},${j}`;
    let cell = cells.get(key);
    if (cell) return cell;
    const x = (i + 0.15 + hash(i, j, 1) * 0.7) * CELL;
    const z = (j + 0.15 + hash(i, j, 2) * 0.7) * CELL;
    const giant = hash(i, j, 3) < giantOdds;
    const r = giant ? 0.95 + hash(i, j, 4) * 0.6 : 0.22 + hash(i, j, 4) ** 2 * 0.6;
    const clear = Math.abs(x - pathX(z)) > r * 1.6 + 1.3;
    let tree: Tree | null = null;
    const spirits: Spirit[] = [];
    if (clear && hash(i, j, 5) < treeOdds) {
      const stubs = Array.from({ length: Math.floor(hash(i, j, 6) * 4) }, (_, k) => ({
        h: 2.2 + hash(i, j, 20 + k) * 9,
        side: hash(i, j, 30 + k) < 0.5 ? -1 : 1,
        len: 0.5 + hash(i, j, 40 + k) * 1.2,
      }));
      tree = { x, z, r, grooves: 5 + Math.floor(hash(i, j, 7) * 6), turn: hash(i, j, 8) * 6.28, stubs, moss: 0.35 + hash(i, j, 18) * 0.65 };
      // spirits gather among the roots of some trees
      if (hash(i, j, 9) < spiritOdds * (giant ? 1.4 : 1)) {
        const n = 1 + Math.floor(hash(i, j, 10) * (giant ? 6 : 3.5));
        for (let k = 0; k < n; k++) {
          const a = hash(i, j, 50 + k) * 6.28;
          const d = r * 1.15 + 0.15 + hash(i, j, 60 + k) * 0.45;
          spirits.push(makeSpirit(i, j, k, x + Math.cos(a) * d, z + Math.sin(a) * d));
        }
      }
    }
    const props: Prop[] = [];
    const nProps = Math.floor(hash(i, j, 11) * 4);
    for (let k = 0; k < nProps; k++) {
      const px = (i + hash(i, j, 100 + k)) * CELL;
      const pz = (j + hash(i, j, 110 + k)) * CELL;
      const roll = hash(i, j, 120 + k);
      const kind = roll < 0.42 ? "fern" : roll < 0.7 ? "bush" : roll < 0.88 ? "rock" : "shroom";
      if (kind !== "fern" && Math.abs(px - pathX(pz)) < 0.9) continue;
      const size = kind === "bush" ? 0.55 + hash(i, j, 130 + k) * 0.9 : 0.35 + hash(i, j, 130 + k) * 0.5;
      const blobs =
        kind === "bush"
          ? Array.from({ length: 4 + Math.floor(hash(i, j, 170 + k) * 4) }, (_, b) => {
              const a = (b / 4) * Math.PI + (hash(i, j, 600 + k * 10 + b) - 0.5) * 0.8;
              const r = 0.32 + hash(i, j, 610 + k * 10 + b) * 0.22;
              return { x: Math.cos(a) * (0.55 - r * 0.5), y: Math.sin(a) * 0.25 + r * 0.9, r };
            })
          : undefined;
      props.push({ kind, x: px, z: pz, size, ph: hash(i, j, 140 + k) * 6.28, tone: hash(i, j, 150 + k), blobs });
      // and some sit up on the rocks
      if (kind === "rock" && hash(i, j, 160 + k) < spiritOdds) spirits.push(makeSpirit(i, j, 20 + k, px, pz - 0.05, size * 0.5));
    }
    // a few wander out in the open, in twos and threes
    if (hash(i, j, 14) < spiritOdds * 0.45) {
      const n = 1 + Math.floor(hash(i, j, 15) * 3);
      const gx = (i + 0.2 + hash(i, j, 16) * 0.6) * CELL;
      const gz = (j + 0.2 + hash(i, j, 17) * 0.6) * CELL;
      if (Math.abs(gx - pathX(gz)) > 0.9)
        for (let k = 0; k < n; k++) spirits.push(makeSpirit(i, j, 40 + k, gx + (hash(i, j, 300 + k) - 0.5) * 0.9, gz + (hash(i, j, 310 + k) - 0.5) * 0.9));
    }
    const shaft =
      m.shafts > 0 && hash(i, j, 12) < 0.1 ? { x: (i + 0.5) * CELL, z: (j + 0.5) * CELL, w: 1.3 + hash(i, j, 13) * 1.6 } : null;
    cell = { tree, spirits, props, shaft };
    cells.set(key, cell);
    return cell;
  };

  // motes in the air by day, fireflies by night: kept in the camera's neighbourhood
  const motes = Array.from({ length: m.night ? 46 : 110 }, () => ({
    x: (rand() - 0.5) * 14,
    y: 0.2 + rand() * (m.night ? 2.6 : 5),
    z: 1 + rand() * 16,
    ph: rand() * 6.28,
  }));

  const f = W * 0.62;
  const STEP = 4;
  const SAMPLES = Math.ceil(W / STEP) + 1;
  const sa = new Float32Array(SAMPLES);
  const sb = new Float32Array(SAMPLES);
  const sc = new Float32Array(SAMPLES);
  // a trunk's shading across, per screen column
  const colIn = new Uint8Array(W);
  const colRim = new Uint8Array(W);
  const colLit = new Float32Array(W);
  const colA = new Float32Array(W);
  const colB = new Float32Array(W);
  const colM = new Float32Array(W);
  const colS = new Float32Array(W);
  // how far away whatever is drawn at each pixel is, so nearer things can be drawn first and
  // nothing behind them gets painted only to be covered up
  const zb = new Float32Array(W * H);
  let clock = start;
  let yaw = 0;
  let pitch = 0;
  let rattleWave: { x: number; y: number; t: number } | null = null;

  const grain = (x: number, z: number) => {
    const h = Math.imul(Math.floor(x * 3), 374761393) ^ Math.imul(Math.floor(z * 3), 668265263);
    return ((Math.imul(h ^ (h >>> 13), 1274126177) >>> 0) & 1023) / 1023;
  };

  // fog in a handful of dithered steps, so the mist reads as pixel art rather than a gradient
  // the corners darken a little, as if seen from inside the wood
  const vignette = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = ((x + 0.5 - W / 2) / (W / 2)) ** 2 * 0.8 + ((y + 0.5 - H / 2) / (H / 2)) ** 2;
      vignette[y * W + x] = Math.max(0, Math.min(5, Math.floor((v - 0.55) * 4.5 + BAYER[(y & 3) * 4 + (x & 3)] * 0.9 + 0.5)));
    }
  const shadeP = c(m.fogTop);

  const fogAt = (d: number, x: number, y: number) => {
    const k = 1 - Math.exp(-d * density);
    return Math.max(0, Math.min(1, Math.floor(k * 10 + BAYER[(y & 3) * 4 + (x & 3)] * 0.9 + 0.5) / 10));
  };

  return {
    bloom: m.bloom,
    hour: time.name,
    draw(fr: Frame, _t: number, dt: number, input) {
      clock += dt;
      const { buf } = fr;
      const camZ = clock * speed;
      const camX = pathX(camZ);
      // face along the path, and a little toward the pointer
      const ahead = Math.atan2(pathX(camZ + 4) - camX, 4);
      yaw += (ahead + input.lookX * 0.3 - yaw) * Math.min(1, dt * 1.5);
      pitch += (input.lookY * H * 0.12 - pitch) * Math.min(1, dt * 2);
      const horizon = H * 0.5 - pitch;
      for (let y = 0; y < H; y++) {
        const dy = (y + 0.5 - horizon) / H;
        const base = dy < 0 ? mix(m.fog, m.fogTop, Math.min(1, -dy / 0.5) ** 1.2 * 0.85) : mix(m.fog, m.fogTop, Math.min(1, dy / 0.5) * 0.3);
        fogRows[y] = c(mix(base, m.fogHi, Math.exp(-((dy / 0.13) ** 2)) * 0.75));
      }
      const cs = Math.cos(yaw);
      const sn = Math.sin(yaw);
      // world to camera: across and depth
      const toCam = (x: number, z: number) => {
        const dx = x - camX;
        const dz = z - camZ;
        return [dx * cs - dz * sn, dx * sn + dz * cs] as const;
      };

      for (const click of input.clicks) rattleWave = { x: click.x, y: click.y, t: 0 };
      if (rattleWave) {
        rattleWave.t += dt;
        if (rattleWave.t > 3) rattleWave = null;
      }

      // ---- everything standing, nearest first ----
      zb.fill(Infinity);
      type Item = { z: number; draw: () => void };
      const items: Item[] = [];
      const beams: Item[] = [];
      const plot = (x: number, y: number, z: number, col: number) => {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || x >= W || y < 0 || y >= H) return;
        const i = y * W + x;
        if (zb[i] <= z) return;
        zb[i] = z;
        buf[i] = col;
      };
      const i0 = Math.floor((camX - MAX_D) / CELL);
      const i1 = Math.floor((camX + MAX_D) / CELL);
      const j0 = Math.floor((camZ - 2) / CELL);
      const j1 = Math.floor((camZ + MAX_D) / CELL);
      const project = (x: number, y: number, z: number) => {
        const [rx, rz] = toCam(x, z);
        return { sx: W / 2 + (rx * f) / rz, sy: horizon - ((y - EYE) * f) / rz, rz };
      };
      const lookPx = W / 2 + input.lookX * W * 0.55;

      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const cell = cellAt(i, j);
          const tr = cell.tree;
          if (tr) {
            const p = project(tr.x, 0, tr.z);
            const hw = (tr.r * f) / p.rz;
            if (p.rz > 0.35 && p.rz < MAX_D && p.sx + hw * 2 > 0 && p.sx - hw * 2 < W) items.push({ z: p.rz, draw: () => trunk(tr, p.sx, p.sy, p.rz) });
          }
          for (const s of cell.spirits) {
            const p = project(s.x, s.y, s.z);
            if (p.rz > 0.4 && p.rz < MAX_D * 0.7 && p.sx > -20 && p.sx < W + 20) items.push({ z: p.rz, draw: () => spirit(s, p.sx, p.sy, p.rz) });
          }
          for (const pr of cell.props) {
            const p = project(pr.x, 0, pr.z);
            if (p.rz > 0.4 && p.rz < MAX_D * 0.8 && p.sx > -30 && p.sx < W + 30) items.push({ z: p.rz, draw: () => prop(pr, p.sx, p.sy, p.rz) });
          }
          const sh = cell.shaft;
          if (sh) {
            const p = project(sh.x, 0, sh.z);
            if (p.rz > 0.8 && p.rz < MAX_D) beams.push({ z: p.rz, draw: () => shaft(sh, p.rz) });
          }
        }
      }
      items.sort((a, b) => a.z - b.z);
      for (const it of items) it.draw();

      // ---- then the ground and the leaves overhead, cast row by row where nothing stands ----
      // world position runs in a straight line along a row, so the noise is sampled every few
      // pixels and filled in between; the dither and thresholds stay per pixel
      const drift = clock * 0.04;
      const fogRow = (d: number, x: number, y: number, kd: number) =>
        Math.max(0, Math.min(1, Math.floor(kd * 10 + BAYER[(y & 3) * 4 + (x & 3)] * 0.9 + 0.5) / 10));
      for (let y = 0; y < H; y++) {
        const below = y + 0.5 - horizon;
        const floor = below > 0;
        const d = floor ? (EYE * f) / below : ((CANOPY - EYE) * f) / -below;
        const row = y * W;
        if (!(d < MAX_D)) {
          for (let x = 0; x < W; x++) if (zb[row + x] === Infinity) buf[row + x] = fogRows[y];
          continue;
        }
        const kd = 1 - Math.exp(-d * density);
        const dl = ((LEAVES - EYE) * f) / -below;
        const kl = 1 - Math.exp(-dl * density);
        for (let k = 0; k < SAMPLES; k++) {
          const rx = ((k * STEP + 0.5 - W / 2) / f) * d;
          const wx = camX + rx * cs + d * sn;
          const wz = camZ - rx * sn + d * cs;
          if (floor) {
            sa[k] = noise(wx * 0.32, wz * 0.32, 0, 2);
            sb[k] = noise(wx * 0.16 + drift, wz * 0.16, 5, 1) * 1.4;
            sc[k] = noise(wx * 0.09 + clock * 0.06, wz * 0.09, 33, 1);
          } else {
            const rl = ((k * STEP + 0.5 - W / 2) / f) * dl;
            sa[k] = noise((camX + rl * cs + dl * sn) * 0.22, (camZ - rl * sn + dl * cs) * 0.22, 21, 2);
            sb[k] = noise(wx * 0.11 + drift * 0.5, wz * 0.11, 9, 2);
          }
        }
        for (let x = 0; x < W; x++) {
          if (zb[row + x] !== Infinity) continue;
          const rx = ((x + 0.5 - W / 2) / f) * d;
          const wx = camX + rx * cs + d * sn;
          const wz = camZ - rx * sn + d * cs;
          const s0 = (x / STEP) | 0;
          const st = (x - s0 * STEP) / STEP;
          const na = sa[s0] + (sa[s0 + 1] - sa[s0]) * st;
          const nb = sb[s0] + (sb[s0 + 1] - sb[s0]) * st;
          let col: number;
          const dth = BAYER[(y & 3) * 4 + (x & 3)];
          if (floor) {
            const idx = na + dth * 0.12 < -0.12 ? 0 : na + dth * 0.12 < 0.06 ? 1 : 2;
            col = grain(wx, wz) > 0.93 ? floorP[3] : floorP[idx];
            // the path: trodden, bare and a shade lighter
            const off = Math.abs(wx - pathX(wz));
            if (off < 0.8 + Math.sin(wz * 1.7) * 0.2 + Math.sin(wz * 0.6 + wx) * 0.2) col = mixPacked(floorP[3], floorP[2], 0.35 + dth * 0.2);
            // sun through the leaves, dappling the ground and drifting with them
            if (!m.night && nb + dth * 0.05 > 0.16) col = mixPacked(col, lightP, 0.32);
            else if (m.night && nb + dth * 0.05 > 0.24) col = mixPacked(col, lightP, 0.14);
            // mist drifting low along the ground, thicker further off
            const nc = sc[s0] + (sc[s0 + 1] - sc[s0]) * st;
            const mist = Math.floor(Math.max(0, Math.min(1, nc * 3 + 0.35)) * m.mist * Math.min(1, d / 6) * 6 + dth * 0.9 + 0.5) / 6;
            if (mist > 0) col = mixPacked(col, mistP, Math.min(0.85, mist));
          } else {
            // first, clumps of leaves hanging lower down, passing over the canopy as you walk
            if (na + dth * 0.05 > 0.13) {
              const edge = na < 0.19 && dl < 16;
              const rl = ((x + 0.5 - W / 2) / f) * dl;
              col = edge ? mixPacked(canopyP[2], lightP, m.night ? 0.1 : 0.25) : canopyP[grain(camX + rl * cs + dl * sn, camZ - rl * sn + dl * cs) + dth * 0.3 > 0.55 ? 1 : 0];
              const k = fogRow(dl, x, y, kl);
              buf[row + x] = k > 0 ? mixPacked(col, fogRows[y], k) : col;
              zb[row + x] = dl;
              continue;
            }
            // then the canopy itself, with the sky showing through its gaps
            const fine = grain(wx * 0.5, wz * 0.5) - 0.5;
            // gaps only open up overhead; further off, the canopy closes into the mist
            const open = 0.2 + Math.max(0, d - 12) * 0.02;
            if (nb + dth * 0.04 > open) col = gapP;
            else if (nb > open - 0.06) col = mixPacked(gapP, canopyP[2], 0.55);
            else col = canopyP[fine + dth * 0.2 > 0.1 ? 2 : fine + dth * 0.2 > -0.15 ? 1 : 0];
          }
          const k = fogRow(d, x, y, kd);
          buf[row + x] = k > 0 ? mixPacked(col, fogRows[y], k) : col;
          zb[row + x] = d;
        }
      }

      // ---- light through the leaves, far to near, over whatever it falls in front of ----
      beams.sort((a, b) => b.z - a.z);
      for (const it of beams) it.draw();

      // ---- motes, or fireflies ----
      for (const mo of motes) {
        mo.y += (m.night ? Math.sin(clock * 0.8 + mo.ph) * 0.2 : 0.05) * dt;
        mo.x += Math.sin(clock * 0.3 + mo.ph) * 0.06 * dt;
        if (mo.y > 5.5) mo.y = 0.2;
        // they hang still in the air as you walk through them, and wrap round ahead of you
        const rel = (((mo.z - camZ) % 16) + 16) % 16 + 0.6;
        const p = project(camX + mo.x, mo.y, camZ + rel);
        if (p.rz < 0.5) continue;
        const sx = Math.round(p.sx);
        const sy = Math.round(p.sy);
        if (sx < 0 || sx >= W || sy < 0 || sy >= H || zb[sy * W + sx] <= p.rz) continue;
        const k = fogAt(p.rz, sx, sy);
        if (m.night) {
          const on = Math.sin(clock * 2.2 + mo.ph * 3);
          if (on < 0.1) continue;
          const glow = mixPacked(c(0xd8ff8a), fogY(sy), k * 0.6);
          buf[sy * W + sx] = glow;
          if (on > 0.7 && p.rz < 8) {
            for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const xx = sx + ox;
              const yy = sy + oy;
              if (xx >= 0 && xx < W && yy >= 0 && yy < H) buf[yy * W + xx] = mixPacked(buf[yy * W + xx], glow, 0.5);
            }
          }
        } else {
          buf[sy * W + sx] = mixPacked(buf[sy * W + sx], lightP, 0.7 * (1 - k));
        }
      }

      // ---- the wood closing in at the edges ----
      for (let i = 0; i < W * H; i++) if (vignette[i]) buf[i] = mixPacked(buf[i], shadeP, vignette[i] * 0.1);

      // ---- the pieces ----
      function trunk(tr: Tree, cx: number, base: number, rz: number) {
        const scale = f / rz;
        const hw = tr.r * scale;
        const fogK = 1 - Math.exp(-rz * density);
        const mossLine = 0.55 + Math.sin(tr.turn * 3) * 0.25;
        // above the roots the trunk is the same width all the way up, so its shading across
        // is worked out once per column
        const sx0 = Math.max(0, Math.floor(cx - hw));
        const sx1 = Math.min(W - 1, Math.ceil(cx + hw));
        for (let x = sx0; x <= sx1; x++) {
          const u = (x + 0.5 - cx) / hw;
          colIn[x] = u >= -1 && u <= 1 ? 1 : 0;
          if (!colIn[x]) continue;
          const a = Math.asin(u);
          colLit[x] = 0.45 + 0.42 * u * lightSide + 0.25 * Math.sqrt(1 - u * u);
          colA[x] = a * tr.grooves * 0.5 + tr.turn;
          colB[x] = 1 + Math.sin(a * 5 + tr.turn);
          colRim[x] = u * lightSide > 0.86 && !m.night ? 1 : 0;
          colM[x] = a * 3 + tr.turn * 2;
          colS[x] = u * lightSide;
        }
        const bottom = Math.min(H - 1, Math.ceil(base));
        // they go up past the top of the picture, into the leaves
        for (let y = 0; y <= bottom; y++) {
          const up = (base - y) / scale;
          const row = y * W;
          // the grooves wander a little as they climb
          const wob = Math.sin(up * 1.3 + tr.turn) * 0.5;
          if (up > 2) {
            for (let x = sx0; x <= sx1; x++) {
              if (!colIn[x] || zb[row + x] <= rz) continue;
              const dth = BAYER[(y & 3) * 4 + (x & 3)];
              const groove = Math.abs(Math.sin(colA[x] + wob * colB[x]));
              const v = colLit[x] - (groove < 0.22 ? 0.3 : 0) + dth * 0.18;
              let col = barkP[v < 0.25 ? 0 : v < 0.5 ? 1 : v < 0.78 ? 2 : 3];
              // moss in patches up the shaded side, and pale flecks of lichen
              const mp = Math.sin(colM[x] + up * 0.6) + Math.sin(up * 1.9 + colM[x] * 1.7) * 0.5 - colS[x] * 0.9 + tr.moss * 0.9;
              if (mp + dth * 0.35 > 1.25) col = mixPacked(mossP, barkP[0], v < 0.45 ? 0.45 : 0.1);
              else if (mp + dth * 0.35 > 1.05) col = mixPacked(col, mossP, 0.5);
              else if (grain(colM[x] * 3, up * 5) > 0.992 - tr.moss * 0.01) col = mixPacked(col, lichenP, 0.7);
              if (colRim[x]) col = mixPacked(col, lightP, 0.3);
              const k = Math.max(0, Math.min(1, Math.floor(fogK * 10 + dth * 0.9 + 0.5) / 10));
              buf[row + x] = k > 0 ? mixPacked(col, fogRows[y], k) : col;
              zb[row + x] = rz;
            }
            continue;
          }
          // roots flare out where the trunk meets the ground, and moss creeps over them
          const w = hw * (1 + 0.95 * Math.exp(-up * 2.4));
          const x0 = Math.max(0, Math.floor(cx - w));
          const x1 = Math.min(W - 1, Math.ceil(cx + w));
          for (let x = x0; x <= x1; x++) {
            const u = (x + 0.5 - cx) / w;
            if (u < -1 || u > 1 || zb[row + x] <= rz) continue;
            const a = Math.asin(u);
            const lit = 0.45 + 0.42 * u * lightSide + 0.25 * Math.sqrt(1 - u * u);
            const groove = Math.abs(Math.sin(a * tr.grooves * 0.5 + tr.turn + wob * (1 + Math.sin(a * 5 + tr.turn))));
            const dth = BAYER[(y & 3) * 4 + (x & 3)];
            const v = lit - (groove < 0.22 ? 0.3 : 0) + dth * 0.18;
            let col = barkP[v < 0.25 ? 0 : v < 0.5 ? 1 : v < 0.78 ? 2 : 3];
            const mossy = up < mossLine + Math.max(0, Math.sin(a * 5 + tr.turn)) * 0.9 * (1 - up / 4) && u * lightSide < 0.4;
            if (mossy) col = mixPacked(col, mossP, v > 0.5 ? 0.75 : 0.45);
            if (u * lightSide > 0.86 && !m.night) col = mixPacked(col, lightP, 0.3);
            // the low mist wraps round the roots
            const mist = Math.floor(Math.max(0, 1 - up / 1.1) * m.mist * Math.min(1, rz / 6) * 5 + dth * 0.9 + 0.5) / 5;
            if (mist > 0) col = mixPacked(col, mistP, Math.min(0.8, mist));
            const k = Math.max(0, Math.min(1, Math.floor(fogK * 10 + dth * 0.9 + 0.5) / 10));
            buf[row + x] = k > 0 ? mixPacked(col, fogRows[y], k) : col;
            zb[row + x] = rz;
          }
        }
        // the stubs of old branches
        for (const st of tr.stubs) {
          const y = Math.round(base - st.h * scale);
          if (y < 0 || y >= H) continue;
          const x0 = cx + st.side * hw * 0.92;
          const len = st.len * scale;
          const col = mixPacked(barkP[1], fogY(y), fogAt(rz, Math.round(x0), y));
          const thick = Math.max(1, Math.round(scale * 0.09));
          for (let s = 0; s < len; s++) {
            const x = Math.round(x0 + st.side * s);
            const yy = Math.round(y + s * 0.3);
            // a hair nearer than the trunk, so they show on it
            for (let t = 0; t < thick; t++) plot(x, yy + t, rz - 0.01, col);
          }
        }
      }

      function spirit(s: Spirit, cx: number, base: number, rz: number) {
        const px = s.size * (f / rz);
        if (px < 3) return;
        // now and then one rattles its head; a click sets them all off, nearest first
        s.next -= dt;
        if (s.next <= 0) {
          s.rattle = 0;
          s.next = 5 + Math.random() * 12;
        }
        if (rattleWave) {
          const delay = Math.hypot(cx - rattleWave.x, base - rattleWave.y) * 0.006;
          if (rattleWave.t >= delay && rattleWave.t - dt < delay) s.rattle = 0;
        }
        let shake = 0;
        if (s.rattle >= 0) {
          s.rattle += dt;
          shake = Math.sin(s.rattle * 34) * Math.max(0, 1 - s.rattle / 1.2);
          if (s.rattle > 1.2) s.rattle = -1;
        }
        // they watch your pointer
        const look = Math.max(-1, Math.min(1, (lookPx - cx) / (W * 0.35))) * 0.8 + Math.sin(clock * 0.4 + s.ph) * 0.12;
        const turn = Math.max(-1, Math.min(1, look + shake * 0.5));
        const k = Math.min(0.75, fogAt(rz, Math.round(cx), Math.round(base)));
        const fy = fogY(Math.round(base));
        const tone = (i: number) => (k > 0 ? mixPacked(spiritP[i], fy, k) : spiritP[i]);
        const ink = k > 0 ? mixPacked(faceP, fy, k * 0.8) : faceP;

        // a thin little body on spindly legs, with arms hanging at its sides
        const legH = px * (s.sit ? 0.12 : 0.26);
        const torsoH = px * 0.26;
        const bw = Math.max(1, px * 0.12);
        const hip = base - legH;
        const shoulder = hip - torsoH;
        const sway = Math.sin(clock * 1.3 + s.ph) * 0.4;
        const lit = tone(0);
        const shade = tone(1);
        for (let y = Math.floor(shoulder); y <= Math.ceil(hip); y++) {
          const w = bw * (0.8 + ((y - shoulder) / torsoH) * 0.35);
          for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) plot(x, y, rz, (x + 0.5 - cx) * lightSide > 0 ? lit : shade);
        }
        if (px >= 9) {
          const spread = s.sit ? bw * 1.4 : bw * 0.7;
          for (const side of [-1, 1]) {
            for (let t = 0; t <= legH; t++) plot(cx + side * (bw * 0.3 + (spread * t) / Math.max(1, legH)), hip + t, rz, shade);
            // arms: from the shoulder, out and down
            const armL = px * 0.24;
            for (let t = 0; t <= armL; t++) plot(cx + side * (bw * 0.5 + t * 0.45), shoulder + 1 + t * 0.85 + side * sway * (t / armL), rz, side * lightSide > 0 ? lit : shade);
          }
        } else {
          for (let y = Math.round(hip); y <= Math.round(base); y++) plot(cx, y, rz, shade);
        }

        // the head: big, wide and a little lumpy, tipped to one side, and rattled on its neck
        const hw = px * s.headW * 0.5;
        const hh = px * s.headH * 0.5;
        const neck = shoulder + 1;
        const tilt = s.tilt + shake * 0.42 + Math.sin(clock * 0.7 + s.ph) * 0.04;
        const ct = Math.cos(tilt);
        const st = Math.sin(tilt);
        const reach = Math.ceil(Math.max(hw, hh * 2) + 2);
        for (let y = Math.floor(neck - hh * 2 - 2); y <= Math.ceil(neck + 1); y++) {
          for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
            // into the head's own frame, turning about the neck
            const dx = x + 0.5 - cx;
            const dy = y + 0.5 - neck;
            const lx = dx * ct + dy * st;
            const ly = -dx * st + dy * ct;
            const u = lx / hw;
            const v = (ly + hh * 0.95) / hh;
            // boxy-round, with a bump on top
            const top = v < 0 ? 1 + s.lump * Math.sin((u + 1) * Math.PI * 0.5 + s.ph) * 0.6 : 1;
            if (Math.abs(u) ** 2.4 + Math.abs(v / top) ** 2.1 > 1) continue;
            const sh = u * lightSide * 0.55 - v * 0.35 + BAYER[(y & 3) * 4 + (x & 3)] * 0.25;
            let col = tone(sh > 0.05 ? 0 : sh > -0.5 ? 1 : 2);
            // the face: three dark hollows, slid round toward where it's looking
            const fu = u - turn * 0.3;
            const eye = (eu: number) => ((fu - eu) / 0.17) ** 2 + ((v + 0.1) / 0.24) ** 2 < 1;
            const mouth = ((fu - s.mouth) / 0.15) ** 2 + ((v - 0.42) / 0.26) ** 2 < 1;
            if (px >= 7 && (eye(-s.eyeGap) || eye(s.eyeGap) || mouth)) col = ink;
            else if (px < 7 && Math.abs(fu) < 0.25 && Math.abs(v) < 0.25) col = ink;
            plot(x, y, rz - 0.001, col);
          }
        }
      }

      function prop(pr: Prop, cx: number, base: number, rz: number) {
        const scale = f / rz;
        const k = fogAt(rz, Math.round(cx), Math.round(base));
        const fyp = fogY(Math.round(base));
        const tint = (p: number) => (k > 0 ? mixPacked(p, fyp, k) : p);
        if (pr.kind === "fern") {
          // fronds fanning out from one root, drooping at the tips, swaying a little
          const L = pr.size * 1.1 * scale;
          if (L < 2) return;
          const fronds = 5 + Math.floor(pr.tone * 4);
          for (let n = 0; n < fronds; n++) {
            const a = -1.25 + (2.5 * n) / (fronds - 1) + Math.sin(clock * 1.1 + pr.ph + n) * 0.05;
            const col = tint(fernP[(n + Math.floor(pr.tone * 3)) % 3]);
            const steps = Math.ceil(L);
            for (let s = 0; s <= steps; s++) {
              const t = s / steps;
              const x = cx + Math.sin(a) * L * t;
              const y = base - Math.cos(a) * L * t * 0.8 + t * t * L * 0.45;
              plot(x, y, rz, col);
              // leaflets along the frond, shorter toward the tip
              if (L > 8 && s % 2 === 0) {
                const leaf = Math.max(1, (1 - t) * L * 0.12);
                for (let q = 1; q <= leaf; q++) {
                  plot(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.6 + q * 0.3, rz, col);
                  plot(x - Math.cos(a) * q, y - Math.sin(a) * q * 0.6 + q * 0.3, rz, col);
                }
              }
            }
          }
        } else if (pr.kind === "bush" && pr.blobs) {
          // leafy lumps heaped together: lit on top, dark underneath, ragged at the edges
          const S = pr.size * scale;
          if (S < 2) return;
          const wind = Math.sin(clock * 0.9 + pr.ph) * S * 0.015;
          let top = Infinity;
          let left = Infinity;
          let right = -Infinity;
          for (const b of pr.blobs) {
            top = Math.min(top, base - (b.y + b.r) * S);
            left = Math.min(left, cx + (b.x - b.r) * S);
            right = Math.max(right, cx + (b.x + b.r) * S);
          }
          const berries = pr.tone > 0.75;
          for (let y = Math.floor(top); y <= Math.ceil(base); y++) {
            const lift = (base - y) / S;
            for (let x = Math.floor(left - 1); x <= Math.ceil(right + 1); x++) {
              const wx = x + 0.5 - cx - wind * lift;
              // the nearest lump decides the shading here
              let best = Infinity;
              let ny = 0;
              let nx = 0;
              for (const b of pr.blobs) {
                const dx = wx / S - b.x;
                const dy = (base - y - 0.5) / S - b.y;
                const q = (dx * dx + dy * dy) / (b.r * b.r);
                if (q < best) {
                  best = q;
                  nx = dx / b.r;
                  ny = dy / b.r;
                }
              }
              const leaf = grain(x * 0.37 + pr.ph, y * 0.41 + pr.tone * 9);
              if (best > 1 - (leaf > 0.6 ? 0.25 : 0)) continue;
              const dth = BAYER[(y & 3) * 4 + (x & 3)];
              const light = ny * 0.7 + nx * lightSide * 0.35 - best * 0.25 + dth * 0.3 + (leaf - 0.5) * 0.35;
              let col = fernP[light > 0.3 ? 2 : light > -0.2 ? 1 : 0];
              if (light < -0.55) col = mixPacked(col, shadeP, 0.5);
              if (light > 0.62 && !m.night) col = mixPacked(col, lightP, 0.25);
              if (berries && leaf > 0.965 && ny > -0.2) col = c(pr.tone > 0.88 ? 0xf2f0e4 : 0xc8324a);
              plot(x, y, rz, tint(col));
            }
          }
        } else if (pr.kind === "rock") {
          const rw = pr.size * 0.9 * scale;
          const rh = pr.size * 0.55 * scale;
          if (rw < 1.5) return;
          for (let y = Math.floor(base - rh); y <= Math.ceil(base); y++) {
            for (let x = Math.floor(cx - rw); x <= Math.ceil(cx + rw); x++) {
              const u = (x + 0.5 - cx) / rw;
              const v = (base - y - 0.5) / rh;
              if (u * u + v * v > 1 || v < 0 || x < 0 || x >= W || y < 0 || y >= H) continue;
              const dth = BAYER[(y & 3) * 4 + (x & 3)];
              const lit = v * 0.6 + u * lightSide * 0.3 + dth * 0.2;
              const stone = lit > 0.45 ? 0x8a8a80 : lit > 0.1 ? 0x666660 : 0x46463f;
              const col = v > 0.55 + noise(u * 3, pr.ph, 2, 1) ? m.moss : mix(stone, m.bark[2], 0.45);
              plot(x, y, rz, tint(c(col)));
            }
          }
        } else {
          // a little cluster of mushrooms, glowing faintly after dark
          const s = pr.size * 0.35 * scale;
          if (s < 1.5) return;
          const cap = c(m.night ? [0x7af0d8, 0x9ad8ff, 0xc8f08a][Math.floor(pr.tone * 3)] : pr.tone < 0.5 ? 0xc8503a : 0xd8b890);
          for (let n = 0; n < 3; n++) {
            const ox = cx + (n - 1) * s * 0.9;
            const hgt = s * (0.6 + ((n * 7 + Math.floor(pr.tone * 10)) % 3) * 0.25);
            const stem = tint(c(0xe8e0d0));
            for (let y = Math.round(base - hgt); y < Math.round(base); y++) plot(ox, y, rz, stem);
            const cw = Math.max(1, Math.round(s * 0.55));
            const capCol = m.night ? cap : tint(cap);
            const capH = Math.max(1, Math.round(s * 0.3));
            for (let y = 0; y < capH; y++)
              for (let x = -cw; x <= cw; x++) plot(Math.round(ox) + x, Math.round(base - hgt - 1) + y, rz - 0.001, capCol);
          }
        }
      }

      function shaft(sh: Shaft, rz: number) {
        // a beam slanting down from a gap overhead: narrow up there, spreading as it falls,
        // fading out before the ground, where it leaves a soft pool of light
        const scale = f / rz;
        const strength = m.shafts * Math.min(1, rz / 3);
        const pulse = 0.85 + Math.sin(clock * 0.3 + sh.x) * 0.15;
        const smooth = (e0: number, e1: number, v: number) => {
          const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
          return t * t * (3 - 2 * t);
        };
        // the beam leans, so its middle slides across the picture as it climbs
        const [bx, bz] = toCam(sh.x, sh.z);
        const [lx, lz] = toCam(sh.x + lean, sh.z);
        for (let y = 0; y < H; y++) {
          const up = (horizon - y) / scale + EYE;
          if (up < 0.3 || up > CANOPY) continue;
          const rxu = bx + (lx - bx) * up;
          const rzu = bz + (lz - bz) * up;
          const p = { sx: W / 2 + (rxu * f) / rzu };
          const half = ((sh.w * scale) / 2) * (0.45 + 0.55 * (1 - up / CANOPY));
          const fade = smooth(0.3, 3.2, up) * smooth(CANOPY, CANOPY - 2.5, up);
          const x0 = Math.max(0, Math.floor(p.sx - half));
          const x1 = Math.min(W - 1, Math.ceil(p.sx + half));
          for (let x = x0; x <= x1; x++) {
            const u = Math.abs((x + 0.5 - p.sx) / half);
            if (u > 1 || zb[y * W + x] <= rzu) continue;
            const a = strength * pulse * fade * (1 - u * u) ** 2 + BAYER[(y & 3) * 4 + (x & 3)] * 0.04;
            const q = Math.floor(a * 12) / 12;
            if (q > 0) buf[y * W + x] = mixPacked(buf[y * W + x], lightP, q);
          }
        }
        // the pool on the ground
        const g = project(sh.x, 0, sh.z);
        const prx = sh.w * 1.1 * scale;
        const pry = Math.max(1, prx * (EYE / rz) * 0.9);
        for (let y = Math.floor(g.sy - pry); y <= Math.ceil(g.sy + pry); y++) {
          for (let x = Math.floor(g.sx - prx); x <= Math.ceil(g.sx + prx); x++) {
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const u = (x + 0.5 - g.sx) / prx;
            const v = (y + 0.5 - g.sy) / pry;
            const r = u * u + v * v;
            if (r > 1 || zb[y * W + x] < g.rz - 1) continue;
            const q = Math.floor((strength * 1.2 * (1 - r) + BAYER[(y & 3) * 4 + (x & 3)] * 0.06) * 10) / 10;
            if (q > 0) buf[y * W + x] = mixPacked(buf[y * W + x], lightP, q);
          }
        }
      }
    },
  };
};
