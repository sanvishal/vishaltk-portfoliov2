import { BAYER, bloom, c, mix, mixPacked, mulberry32, type Frame } from "./frame";
import type { PlaceMaker } from "./scene";
import { makeNoise3 } from "./world";

/**
 * now and then, low orbit finds something that isn't a planet. a separate roll from the seed
 * decides, so ordinary planets stay exactly as they were.
 */
export function oddity(seed: number): "bagel" | "gargantua" | null {
  const r = mulberry32(seed * 131 + 7)();
  return r < 0.05 ? "bagel" : r < 0.3 ? "gargantua" : null;
}

const rotX = (v: number[], a: number) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const rotZ = (v: number[], a: number) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];

/** each universe the void can be: five tones from deepest to brightest, and how hard it pulls */
const UNIVERSES: { tones: number[]; pull: number }[] = [
  { tones: [0x0c0612, 0x3a0f4a, 0xd0287a, 0xff9a3a, 0xfff2c8], pull: 1 },
  { tones: [0x3a0a24, 0xa8205e, 0xff6fae, 0xffb3d4, 0xffffff], pull: 1 },
  { tones: [0x05201e, 0x0f5a54, 0x2aa8a0, 0xa0f0e0, 0xfffff0], pull: 1.1 },
  { tones: [0x6a5a40, 0x8a7a5a, 0xa8966e, 0xc8b68a, 0xe8dcbc], pull: 0.35 },
  { tones: [0xb8b0c8, 0xd0cadc, 0xe4e0ec, 0xf4f2f8, 0xffffff], pull: 0.7 },
  { tones: [0x101020, 0x2050ff, 0x20e0a0, 0xffe040, 0xff3060], pull: 1.3 },
];

/**
 * a black bagel with everything on it, and the void around it falling into its hole: spiral
 * arms and rings of colour rushing inward, googly eyes, rocks with googly eyes, seeds and
 * crumbs streaking in after them. the light follows your pointer. click, and you're thrown
 * into another universe; every so often it happens on its own.
 */
export const bagel: PlaceMaker = (seed, W, H) => {
  const rand = mulberry32(seed * 977 + 13);
  const cx = W * (0.46 + rand() * 0.08);
  const cy = H * 0.52;
  const R0 = H * 0.3;
  const r0 = R0 * 0.55;
  const tilt = 1.0 + rand() * 0.18;
  const roll = (rand() - 0.5) * 0.45;
  const toTorus = (v: number[]) => rotX(rotZ(v, -roll), -tilt);
  const toView = (v: number[]) => rotZ(rotX(v, tilt), roll);
  const sdf = (p: number[]) => Math.hypot(Math.hypot(p[0], p[2]) - R0, p[1]) - r0;

  // the bagel turns about its own middle, which leaves its shape on screen unchanged, so
  // where it is, which way each bit faces and where that bit sits on the bagel is found once
  const hit = new Uint8Array(W * H);
  const nX = new Float32Array(W * H);
  const nY = new Float32Array(W * H);
  const nZ = new Float32Array(W * H);
  const tu = new Float32Array(W * H);
  const tv = new Float32Array(W * H);
  const reach = R0 + r0 + 2;
  const far = reach * 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x + 0.5 - cx;
      const sy = -(y + 0.5 - cy);
      if (Math.hypot(sx, sy) > reach) continue;
      let t = 0;
      for (let k = 0; k < 80 && t < far * 2; k++) {
        const q = toTorus([sx, sy, far - t]);
        const d = sdf(q);
        if (d < 0.02) {
          const i = y * W + x;
          const ring = Math.hypot(q[0], q[2]);
          const n = [q[0] - (q[0] / ring) * R0, q[1], q[2] - (q[2] / ring) * R0];
          const nl = Math.hypot(n[0], n[1], n[2]);
          const nv = toView([n[0] / nl, n[1] / nl, n[2] / nl]);
          hit[i] = 1;
          nX[i] = nv[0];
          nY[i] = nv[1];
          nZ[i] = nv[2];
          tu[i] = Math.atan2(q[2], q[0]);
          tv[i] = Math.atan2(q[1], ring - R0);
          break;
        }
        t += d;
      }
    }
  }

  // everything on it: sesame, poppy, garlic, onion and salt, on the top of the bagel
  const TU = 260;
  const TV = 90;
  const tex = new Uint8Array(TU * TV);
  for (let k = 0; k < TU * TV * 0.08; k++) {
    const u = Math.floor(rand() * TU);
    const v = Math.floor(TV * (0.55 + rand() * 0.4));
    const kind = 1 + Math.floor(rand() * 5);
    tex[v * TU + u] = kind;
    if (kind === 1) tex[v * TU + ((u + 1) % TU)] = kind;
  }
  const TOPPING = [0, c(0xf2e6c4), c(0x4a4a5c), c(0xe8a24a), c(0xfcfcff), c(0x9a6a34)];
  const CRUST = [0x07060a, 0x141118, 0x26222e, 0x3e3848].map(c);
  const SHINE = [c(0xc8c2d8), c(0xffffff)];

  // the void, measured from the hole in the bagel's own tilted plane: which way round, and
  // how far out on a log scale, so rings can rush inward forever
  const ang = new Float32Array(W * H);
  const lr = new Float32Array(W * H);
  const squash = Math.max(0.35, Math.cos(tilt));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) / squash;
      ang[y * W + x] = Math.atan2(dy, dx);
      lr[y * W + x] = Math.log(Math.hypot(dx, dy) / R0 + 0.05);
    }

  // the things being pulled in
  type Thing = {
    kind: "eye" | "rock" | "seed" | "speck";
    r: number;
    a: number;
    y: number;
    size: number;
    px: number;
    py: number;
    vx: number;
    vy: number;
    lx: number;
    ly: number;
    lvx: number;
    lvy: number;
    col: number;
  };
  const spawn = (fresh: boolean): Thing => {
    const roll2 = rand();
    return {
      kind: roll2 < 0.48 ? "eye" : roll2 < 0.58 ? "rock" : roll2 < 0.8 ? "seed" : "speck",
      r: fresh ? 0.7 + rand() * 2.2 : 2.6 + rand() * 0.8,
      a: rand() * Math.PI * 2,
      y: (rand() - 0.5) * 0.7,
      size: 0.5 + rand() * 0.9,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      lx: NaN,
      ly: NaN,
      lvx: 0,
      lvy: 0,
      col: TOPPING[1 + Math.floor(rand() * 5)],
    };
  };
  const things = Array.from({ length: 150 }, () => spawn(true));

  let universe = rand() < 0.5 ? 0 : Math.floor(rand() * UNIVERSES.length);
  let jump = 0;
  let nextJump = 9 + rand() * 8;
  let spin = 0;
  let flow = 0;
  const light = [-0.4, 0.6, 0.7];
  const shot = new Uint32Array(W * H);

  const disc = (f: Frame, x0: number, y0: number, r: number, col: number) => {
    for (let y = Math.floor(y0 - r); y <= Math.ceil(y0 + r); y++)
      for (let x = Math.floor(x0 - r); x <= Math.ceil(x0 + r); x++) if ((x + 0.5 - x0) ** 2 + (y + 0.5 - y0) ** 2 <= r * r) f.set(x, y, col);
  };
  const googly = (f: Frame, x: number, y: number, r: number, t: Thing, ink: number) => {
    disc(f, x, y, r + 0.7, ink);
    disc(f, x, y, r, c(0xfdfdfd));
    const pr = r * 0.55;
    disc(f, x + t.px * (r - pr), y + t.py * (r - pr), pr, ink);
  };

  const leap = () => {
    jump = 0.45;
    let next = universe;
    while (next === universe) next = Math.floor(Math.random() * UNIVERSES.length);
    universe = next;
    for (const t of things) {
      t.vx += (Math.random() - 0.5) * 40;
      t.vy -= Math.random() * 40;
    }
  };

  return {
    bloom: 0.55,
    draw(f: Frame, _t: number, dt: number, input) {
      spin += dt * 0.18;
      nextJump -= dt;
      if (input.clicks.length || nextJump <= 0) {
        leap();
        nextJump = 10 + Math.random() * 10;
      }
      // the jump flickers through other universes on the way
      let u = universe;
      if (jump > 0) {
        jump -= dt;
        u = Math.floor(Math.random() * UNIVERSES.length);
      }
      const uni = UNIVERSES[u];
      const tones = uni.tones.map(c);
      // the void is muted so the bagel and its eyes stay the loudest things in the picture
      const calm = uni.tones.map((t, k) => c(mix(t, uni.tones[0], k === 0 ? 0 : 0.42)));
      const ink = c(0x0a0810);
      // the pull surges when you land somewhere new
      flow += dt * uni.pull * (1 + Math.max(0, jump) * 8);
      const { buf } = f;

      // the void falling into the hole: spiral arms over rings that rush inward
      for (let i = 0; i < W * H; i++) {
        const x = i % W;
        const y = (i / W) | 0;
        const dth = BAYER[(y & 3) * 4 + (x & 3)];
        const arm = Math.sin(ang[i] * 2 + lr[i] * 4 - flow * 2.4);
        let band = lr[i] * 1.3 + flow * 0.55 + ang[i] / Math.PI + arm * 0.22;
        band -= Math.floor(band);
        // deeper toward the hole, as if down a tunnel
        const depth = Math.max(0, Math.min(1, (lr[i] + 1.6) / 2.2));
        const lvl = band * 4 * (0.35 + 0.65 * depth) + dth * 0.7;
        buf[i] = calm[Math.max(0, Math.min(4, Math.floor(lvl)))];
      }

      const target = [-0.4 + input.lookX * 1.4, 0.6 - input.lookY * 1.2, 0.7];
      for (let k = 0; k < 3; k++) light[k] += (target[k] - light[k]) * Math.min(1, dt * 5);
      const ll = Math.hypot(light[0], light[1], light[2]);
      const L = [light[0] / ll, light[1] / ll, light[2] / ll];
      const hl = Math.hypot(L[0], L[1], L[2] + 1);
      const Hh = [L[0] / hl, L[1] / hl, (L[2] + 1) / hl];

      // things spiral round and in, faster and faster, and streak as they go
      const placed: { t: Thing; x: number; y: number; z: number; s: number; ox: number; oy: number }[] = [];
      for (const t of things) {
        const pull = uni.pull * (1 + Math.max(0, jump) * 6);
        t.a += dt * pull * (0.7 / t.r ** 1.6);
        t.r -= dt * pull * (0.12 / Math.sqrt(t.r));
        if (t.r < 0.4) Object.assign(t, spawn(false));
        const v = toView([Math.cos(t.a) * t.r * R0, t.y * R0 * Math.min(1, t.r - 0.35), Math.sin(t.a) * t.r * R0]);
        const x = cx + v[0];
        const y = cy - v[1];
        const ox = Number.isNaN(t.lx) ? x : t.lx;
        const oy = Number.isNaN(t.ly) ? y : t.ly;
        // googly pupils: heavy, sagging to the bottom, thrown about when the eye swerves
        const ax = (x - ox) / Math.max(dt, 1e-3);
        const ay = (y - oy) / Math.max(dt, 1e-3);
        const jx = (ax - t.lvx) * 0.02;
        const jy = (ay - t.lvy) * 0.02;
        t.lvx = ax;
        t.lvy = ay;
        t.lx = x;
        t.ly = y;
        t.vx += (-jx * 3 - t.vx * 1.5) * dt * 4;
        t.vy += (5 - jy * 3 - t.vy * 1.5) * dt * 4;
        t.px += t.vx * dt;
        t.py += t.vy * dt;
        const m = Math.hypot(t.px, t.py);
        if (m > 1) {
          t.px /= m;
          t.py /= m;
          const dot = t.vx * t.px + t.vy * t.py;
          t.vx -= 1.6 * dot * t.px;
          t.vy -= 1.6 * dot * t.py;
        }
        // nearer things are bigger, and everything shrinks into the hole
        const s = t.size * Math.min(1, (t.r - 0.4) * 2.2) * (1 + v[2] / (R0 * 2.5));
        placed.push({ t, x, y, z: v[2], s, ox, oy });
      }
      placed.sort((a, b) => a.z - b.z);
      const drawThing = (p: (typeof placed)[number]) => {
        const { t, x, y, s } = p;
        if (s <= 0.05) return;
        // a streak behind anything moving fast
        const sx = x - p.ox;
        const sy = y - p.oy;
        const sl = Math.hypot(sx, sy);
        if (sl > 0.6) {
          const n = Math.min(10, Math.ceil(sl * 4));
          const trail = mixPacked(t.kind === "eye" ? c(0xffffff) : t.col || TOPPING[1], tones[2], 0.45);
          for (let k = 1; k <= n; k++) f.set(x - (sx / sl) * k, y - (sy / sl) * k, trail);
        }
        if (t.kind === "eye") googly(f, x, y, 1.6 + s * 3.4, t, ink);
        else if (t.kind === "rock") {
          const r = 2.2 + s * 3.2;
          disc(f, x, y, r, c(0x8a8478));
          disc(f, x - r * 0.25, y - r * 0.3, r * 0.55, c(0xa8a294));
          googly(f, x - r * 0.38, y - r * 0.15, Math.max(1, r * 0.26), t, ink);
          googly(f, x + r * 0.32, y - r * 0.2, Math.max(1, r * 0.22), t, ink);
        } else if (t.kind === "seed") {
          f.set(x, y, TOPPING[1]);
          f.set(x + 1, y, TOPPING[1]);
        } else f.set(x, y, t.col);
      };
      for (const p of placed) if (p.z < 0) drawThing(p);

      // the bagel: glossy black crust, everything on top, lit hard round the edge by the void
      const su = (spin / (Math.PI * 2)) * TU;
      const rimCol = tones[3];
      for (let i = 0; i < W * H; i++) {
        if (!hit[i]) continue;
        const d = nX[i] * L[0] + nY[i] * L[1] + nZ[i] * L[2];
        const sp = nX[i] * Hh[0] + nY[i] * Hh[1] + nZ[i] * Hh[2];
        const x = i % W;
        const y = (i / W) | 0;
        const dth = BAYER[(y & 3) * 4 + (x & 3)];
        const lvl = d + dth * 0.3;
        let col = CRUST[lvl > 0.8 ? 3 : lvl > 0.4 ? 2 : lvl > -0.1 ? 1 : 0];
        const tuI = ((((tu[i] / (Math.PI * 2)) * TU + su) % TU) + TU) % TU | 0;
        const tvI = Math.min(TV - 1, Math.max(0, Math.floor(((tv[i] + Math.PI) / (Math.PI * 2)) * TV)));
        const top = tex[tvI * TU + tuI];
        if (nZ[i] + dth * 0.08 < 0.16) col = rimCol;
        else if (nZ[i] + dth * 0.08 < 0.3) col = mixPacked(col, rimCol, 0.5);
        else if (top) col = d > -0.2 ? TOPPING[top] : mixPacked(TOPPING[top], CRUST[0], 0.6);
        else if (sp + dth * 0.02 > 0.985) col = SHINE[1];
        else if (sp + dth * 0.03 > 0.95) col = SHINE[0];
        buf[i] = col;
      }
      for (const p of placed) if (p.z >= 0) drawThing(p);

      // landing in a new universe: the picture splits into its colours for a moment
      if (jump > 0) {
        shot.set(buf);
        const off = Math.round(1 + jump * 6);
        for (let y = 0; y < H; y++) {
          const row = y * W;
          for (let x = 0; x < W; x++) {
            const r = shot[row + Math.max(0, x - off)] & 0xff;
            const g = (shot[row + x] >>> 8) & 0xff;
            const b = (shot[row + Math.min(W - 1, x + off)] >>> 16) & 0xff;
            buf[row + x] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
          }
        }
      }
    },
  };
};

/** the disc's light, brightest first: cream at the hot inner edge down to smoky brown */
const DISC = [0xfffaf0, 0xfde9d2, 0xf6d3b0, 0xe8b48a, 0xc88a60, 0x8a5a3c, 0x4a3022, 0x221812];
const SKY_TONES = [0x030304, 0x08080a, 0x0e0e12, 0x16161a, 0x1e1e24];

/**
 * a black hole, close up and enormous: its shadow off to one side, cut by the edge of the
 * picture, the disc of gas tipped across the frame and sweeping in toward us, churning round
 * fast. nothing here is painted to look bent: each pixel's ray of light is traced back
 * through the hole's gravity once, when the place is made, to find whether it fell in,
 * struck the disc (and how fast that bit of disc was rushing toward or away from it), or got
 * away to the sky. so the far side of the disc climbs up and over the hole, a thin ring of
 * light hugs the dark, and the stars behind slide round it. after that each frame only turns
 * the disc and moves the sky. a small world hangs in silhouette. click, and time slows here
 * while the universe outside races on.
 */
export const gargantua: PlaceMaker = (seed, W, H) => {
  const rand = mulberry32(seed * 733 + 29);
  const noise = makeNoise3(rand);
  const discP = DISC.map(c);
  // units: the hole's radius is 1; its shadow is about 2.6 across the middle
  const rin = 2.6;
  const rout = 24 + rand() * 6;
  const D = 15 + rand() * 4;
  const incl = 0.05 + rand() * 0.05;
  const roll = -(0.22 + rand() * 0.14);
  const hx0 = W * (0.72 + rand() * 0.06);
  const hy0 = H * (0.38 + rand() * 0.08);
  // radians per pixel: the shadow fills about two thirds of the height
  const kpx = 2.6 / D / (H * (0.3 + rand() * 0.05));
  const turn = rand() < 0.5 ? 1 : -1;

  // what each pixel sees
  const SKY = 0;
  const DISCHIT = 1;
  const HOLE = 2;
  const kind = new Uint8Array(W * H);
  const hitR = new Float32Array(W * H);
  const hitA = new Float32Array(W * H);
  const shift = new Float32Array(W * H);
  const skyU = new Float32Array(W * H);
  const skyV = new Float32Array(W * H);
  // how close a ray came to the sphere where light can orbit: those glow
  const halo = new Float32Array(W * H);
  const ci = Math.cos(incl);
  const si = Math.sin(incl);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // the camera sits just above the disc, looking at the hole, rolled so the disc tips
      const ox = x + 0.5 - hx0;
      const oy = -(y + 0.5 - hy0);
      const rx = (ox * cr - oy * sr) * kpx;
      const ry = (ox * sr + oy * cr) * kpx;
      let vx = rx;
      let vy = -si + ry * ci;
      let vz = ci + ry * si;
      const vl0 = Math.hypot(vx, vy, vz);
      vx /= vl0;
      vy /= vl0;
      vz /= vl0;
      let px = 0;
      let py = D * si;
      let pz = -D * ci;
      const hx = py * vz - pz * vy;
      const hy = pz * vx - px * vz;
      const hz = px * vy - py * vx;
      const h2 = hx * hx + hy * hy + hz * hz;
      let rmin = Infinity;
      kind[i] = SKY;
      for (let k = 0; k < 900; k++) {
        const r = Math.hypot(px, py, pz);
        rmin = Math.min(rmin, r);
        if (r < 1.01) {
          kind[i] = HOLE;
          break;
        }
        if (r > D * 1.6 && px * vx + py * vy + pz * vz > 0) break;
        // light bends toward the hole, pulled by 1.5 h^2 / r^5; long strides where it's weak
        const step = Math.min(3, Math.max(0.03, (r - 1) * 0.1));
        const acc = (-1.5 * h2) / r ** 5;
        vx += px * acc * step;
        vy += py * acc * step;
        vz += pz * acc * step;
        const ny = py + vy * step;
        // crossing the plane of the disc
        if (py > 0 !== ny > 0) {
          const f = py / (py - ny);
          const qx = px + vx * step * f;
          const qz = pz + vz * step * f;
          const rr = Math.hypot(qx, qz);
          if (rr > rin && rr < rout) {
            kind[i] = DISCHIT;
            hitR[i] = rr;
            hitA[i] = Math.atan2(qz, qx);
            // the gas orbits fast; light from the side coming at us is boosted, the other dimmed
            const speed = Math.min(0.6, Math.sqrt(0.5 / (rr - 1)));
            const gx = (-qz / rr) * turn;
            const gz = (qx / rr) * turn;
            const vl = Math.hypot(vx, vy, vz);
            const toward = -(gx * vx + gz * vz) / vl;
            const gamma = 1 / Math.sqrt(1 - speed * speed);
            shift[i] = (1 / (gamma * (1 - speed * toward))) * Math.sqrt(1 - 1 / rr);
            break;
          }
        }
        px += vx * step;
        py = ny;
        pz += vz * step;
      }
      if (kind[i] === SKY) {
        const vl = Math.hypot(vx, vy, vz);
        skyU[i] = Math.atan2(vx, vz) / (Math.PI * 2) + 0.5;
        skyV[i] = Math.asin(Math.max(-1, Math.min(1, vy / vl))) / Math.PI + 0.5;
        halo[i] = Math.exp(-Math.max(0, rmin - 1.5) * 7);
      }
    }
  }

  // a pale veil of scattered light over everything near the hole
  const veil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - hx0, y + 0.5 - hy0) / H;
      veil[y * W + x] = Math.max(0, Math.min(4, Math.floor(Math.exp(-d * 1.6) * 4.2 + BAYER[(y & 3) * 4 + (x & 3)] * 0.9)));
    }
  const veilP = c(0x8a8680);
  const glowP = [c(0x5a4a3e), c(0xa88a6a), c(0xf6e2c8), c(0xfffaf2)];

  // the sky, all the way round: almost black, and sparse with stars
  const SW = 1024;
  const SH = 512;
  const sky = new Uint32Array(SW * SH);
  const skyP = SKY_TONES.map(c);
  const nz = rand() * 40;
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const n = noise((x / SW) * 10, (y / SH) * 5, nz, 3) + BAYER[(y & 3) * 4 + (x & 3)] * 0.08;
      sky[y * SW + x] = skyP[Math.max(0, Math.min(4, Math.floor((n + 0.15) * 4)))];
    }
  for (let k = 0; k < (SW * SH) / 260; k++) {
    const i = Math.floor(rand() * SW * SH);
    sky[i] = c(rand() > 0.85 ? 0xfff6e8 : 0x8a8890);
  }

  // a small world, dark against the glow, lit along one edge by the disc
  const planet = { x: W * (0.2 + rand() * 0.12), y: H * (0.3 + rand() * 0.15), r: Math.max(3, H * 0.035) };

  // the disc's churn, worked out once as a ring-by-angle table, and turned each frame:
  // each ring turns at its own speed, quickest near the hole
  const RB = 192;
  const AB = 512;
  const churn = new Float32Array(RB * AB);
  for (let rb = 0; rb < RB; rb++) {
    const r = rin + ((rb + 0.5) / RB) * (rout - rin);
    for (let ab = 0; ab < AB; ab++) {
      const a = (ab / AB) * Math.PI * 2;
      const streak = noise(Math.cos(a) * 2.2, Math.sin(a) * 2.2, r * 1.6, 2);
      const clump = noise(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, r * 0.2 + 9, 1);
      churn[rb * AB + ab] = 0.55 + streak * 1.6 + clump * 0.8;
    }
  }
  const ringOf = new Uint8Array(W * H);
  const angleOf = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (kind[i] !== DISCHIT) continue;
    ringOf[i] = Math.min(RB - 1, Math.floor(((hitR[i] - rin) / (rout - rin)) * RB));
    angleOf[i] = ((hitA[i] / (Math.PI * 2)) * AB + AB) % AB;
  }
  const turnBy = new Float32Array(RB);

  // time dilation: close to the hole an hour is years outside. a click lets you feel it:
  // the disc whirls, the sky pours past, and its stars draw rings round the dark
  let dilate = -1;
  const trail = new Uint32Array(W * H);
  const cold = c(0xd6e4ff);
  let clock = rand() * 100;
  let discClock = clock;
  let drift = 0;

  return {
    bloom: 1.3,
    draw(f: Frame, _t: number, dt: number, input) {
      clock += dt;
      if (input.clicks.length && dilate < 0) dilate = 0;
      let surge = 0;
      if (dilate >= 0) {
        dilate += dt;
        surge = Math.sin(Math.min(1, dilate / 5) * Math.PI) ** 2;
        if (dilate > 5) dilate = -1;
      }
      const pace = 1 + surge * 70;
      discClock += dt * (1 + surge * 12);
      // the sky slides behind the hole, a little faster when you lean that way
      drift += dt * (0.004 + input.lookX * 0.01) * pace;
      for (let rb = 0; rb < RB; rb++) {
        const r = rin + ((rb + 0.5) / RB) * (rout - rin);
        turnBy[rb] = (turn * discClock * 7 * r ** -1.5 * AB) / (Math.PI * 2);
      }
      const { buf } = f;
      const lift = input.lookY * 0.02;
      // the whole disc throbs a little as it churns
      const throb = 1 + Math.sin(clock * 1.7) * 0.06 + Math.sin(clock * 3.1) * 0.04;
      const trails = surge > 0.02;
      for (let i = 0; i < W * H; i++) {
        const k = kind[i];
        const x = i % W;
        const y = (i / W) | 0;
        const dth = BAYER[(y & 3) * 4 + (x & 3)];
        let col: number;
        if (k === HOLE) col = 0xff000000;
        else if (k === SKY) {
          let u = Math.floor((skyU[i] + drift) * SW) % SW;
          if (u < 0) u += SW;
          const v = Math.max(0, Math.min(SH - 1, Math.floor((skyV[i] + lift) * SH)));
          col = sky[v * SW + u];
          // while time races, the stars leave trails, bent into rings round the hole
          if (trails) {
            const old = mixPacked(trail[i], skyP[0], 0.06);
            if (((old >>> 8) & 255) > ((col >>> 8) & 255)) col = old;
          }
          trail[i] = col;
          // light that skimmed the photon sphere: a thin bright ring, and a glow round it
          const h = halo[i] + dth * 0.05;
          if (h > 0.82) col = glowP[3];
          else if (h > 0.6) col = glowP[2];
          else if (h > 0.4) col = mixPacked(col, glowP[1], 0.45);
          else {
            // and a wider, softer warmth round all of it
            const soft = Math.floor(halo[i] ** 0.32 * 4 + dth * 0.9) / 4;
            if (soft > 0) col = mixPacked(col, glowP[soft > 0.5 ? 1 : 0], soft * 0.55);
          }
        } else {
          // the disc: hottest and brightest inward, streaked along its orbits and racing
          // round, quickest near the hole, beamed brighter on the side coming toward us
          const r = hitR[i];
          const t = (r - rin) / (rout - rin);
          const rb = ringOf[i];
          let ab = Math.floor(angleOf[i] - turnBy[rb]) % AB;
          if (ab < 0) ab += AB;
          const g = shift[i];
          const edge = Math.max(0, Math.min(1, (rout - r) / (rout * 0.5)));
          const b = (1 - t) ** 1.7 * g ** 2.6 * churn[rb * AB + ab] * 1.05 * throb * edge;
          const idx = Math.floor((1 - Math.min(1, b)) * 6 + t * 1.5 + dth * 0.9);
          col = b + dth * 0.03 < 0.04 ? skyP[1] : discP[Math.max(0, Math.min(7, idx))];
        }
        // the veil of scattered light lies over the dark, not the bright
        if (veil[i] && k !== DISCHIT) col = mixPacked(col, veilP, veil[i] * 0.09);
        // light falling in from a sped-up universe arrives bluer
        if (surge > 0.05) col = mixPacked(col, cold, Math.floor(surge * 4) * 0.04);
        buf[i] = col;
      }

      // the hot gas bleeds light into everything round it, like it does through a lens
      bloom(f, 0.7, 0.5);

      // the world in silhouette, with a thin lit edge toward the hole
      for (let y = Math.floor(planet.y - planet.r); y <= Math.ceil(planet.y + planet.r); y++)
        for (let x = Math.floor(planet.x - planet.r); x <= Math.ceil(planet.x + planet.r); x++) {
          const u = (x + 0.5 - planet.x) / planet.r;
          const v = (y + 0.5 - planet.y) / planet.r;
          if (u * u + v * v > 1 || x < 0 || x >= W || y < 0 || y >= H) continue;
          const lit = u * 0.9 + v * 0.3 > 0.55 + BAYER[(y & 3) * 4 + (x & 3)] * 0.2;
          buf[y * W + x] = c(lit ? 0xc8b49a : 0x0c0b0c);
        }

    },
  };
};
