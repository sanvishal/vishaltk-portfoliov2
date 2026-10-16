import { BAYER, bands, c, mix, mixPacked, mulberry32, type Frame } from "./frame";
import type { PlaceMaker } from "./scene";
import { pick } from "./time";
import { KINDS, TEX_H, TEX_W, makeNoise3, makeWorld, shades } from "./world";
import { bagel, gargantua, oddity } from "./oddities";

const STARS = [0xfff8dc, 0xffd9a0, 0xffb08a, 0xdfe8ff];
const NEBULAE = [0x5a2a6a, 0x1f4a6a, 0x6a2a3a, 0x2a3a7a, 0x2a5a4a];
const MOON_ROCK = [0xbab6c9, 0xc9a27a, 0xd9eef8, 0xb5654a, 0x9a9488];

/**
 * a planet seen from orbit. the number picks what kind of world it is, how big, its star's
 * colour, its moons, whether it wears rings or a belt of dust, and the nebula behind it.
 * the sun sits wherever your pointer is, so the night side follows you round. click to spin it.
 */
export const orbit: PlaceMaker = (seed, W, H, night, hour) => {
  // once in a while it isn't a planet at all
  const odd = oddity(seed);
  if (odd) return { bagel, gargantua }[odd](seed, W, H, night, hour);
  const rand = mulberry32(seed);
  const kind = pick(rand, KINDS);
  const star = pick(rand, STARS);
  const world = makeWorld(seed, kind, star);
  const hasRings = kind === "gas" ? rand() < 0.9 : rand() < 0.3;
  // a ringed planet is drawn smaller so its rings fit in the frame
  const R = Math.floor(Math.min(H * (hasRings ? 0.17 + rand() * 0.06 : 0.22 + rand() * 0.1), W * (hasRings ? 0.15 : 0.26)));
  const cx = Math.round(W * (hasRings ? 0.44 + rand() * 0.12 : 0.38 + rand() * 0.24));
  const cy = Math.round(H * (0.44 + rand() * 0.08));
  const roll = world.tilt * (rand() < 0.5 ? -1 : 1);
  const ratio = 0.2 + rand() * 0.15;
  const [cr, sr] = [Math.cos(roll), Math.sin(roll)];

  // ---- the backdrop: deep space, a faint nebula, stars ----
  const bg = bands(W, H, [0x05081a, 0x080d24, 0x0b122d, 0x0e1735]);
  const neb = pick(rand, NEBULAE);
  const nfbm = makeNoise3(rand);
  const nz = rand() * 50;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = nfbm(x * 0.018, y * 0.03, nz, 4) + BAYER[(y & 3) * 4 + (x & 3)] * 0.08;
      if (n > 0.12) bg[y * W + x] = mixPacked(bg[y * W + x], c(neb), n > 0.24 ? 0.45 : 0.22);
    }
  }
  const stars = Array.from({ length: Math.round((W * H) / 45) }, () => ({
    i: Math.floor(rand() * H) * W + Math.floor(rand() * W),
    p: rand() * 6.28,
    big: rand() < 0.04,
  }));

  // ---- rings ----
  const ringIn = R * (1.25 + rand() * 0.2);
  const ringOut = ringIn + R * (0.35 + rand() * 0.45);
  const ringTones =
    kind === "gas"
      ? [world.palette[0][2], world.palette[3][2], world.palette[1][2]]
      : [c(0xb8b2a8), c(0x8c867c), c(0xd8d2c8)];
  // per ring pixel: where it is, its tone, and its position in the ring plane for lighting
  const ringPx: { i: number; col: number; dark: number; front: boolean; x: number; y: number }[] = [];
  if (hasRings) {
    const reach = Math.ceil(ringOut) + 1;
    for (let y = -reach; y <= reach; y++) {
      for (let x = -reach; x <= reach; x++) {
        const X = cx + x;
        const Y = cy + y;
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const rx = x * cr + y * sr;
        const ry = -x * sr + y * cr;
        const r = Math.hypot(rx, ry / ratio);
        if (r < ringIn || r > ringOut) continue;
        const t = (r - ringIn) / (ringOut - ringIn);
        // a couple of gaps, like the cassini division
        if (Math.abs(t - 0.62) < 0.05 || Math.abs(t - 0.2) < 0.02) continue;
        const band = Math.floor(t * 7) % 3;
        const col = BAYER[(Y & 3) * 4 + (X & 3)] > 0.3 ? ringTones[(band + 1) % 3] : ringTones[band];
        ringPx.push({ i: Y * W + X, col, dark: mixPacked(col, c(0x05081a), 0.7), front: ry > 0, x, y });
      }
    }
  }

  // ---- moons ----
  const moons = Array.from({ length: Math.floor(rand() * 4) }, (_, k) => ({
    r: Math.max(2, Math.round(R * (0.07 + rand() * 0.13))),
    dist: (hasRings ? ringOut + 6 : R * 1.45) + k * R * 0.35 + rand() * R * 0.2,
    tilt: 0.12 + rand() * 0.25,
    speed: (0.12 + rand() * 0.35) * (rand() < 0.85 ? 1 : -1),
    a: rand() * Math.PI * 2,
    tones: shades(pick(rand, MOON_ROCK), star),
    pits: Array.from({ length: 3 }, () => ({ x: rand() * 1.2 - 0.6, y: rand() * 1.2 - 0.6, r: 0.15 + rand() * 0.15 })),
  }));

  // ---- a belt of dust and rocks ----
  const dust =
    rand() < 0.3
      ? Array.from({ length: 160 }, () => {
          const r = R * (1.6 + rand() * 1.1);
          return {
            r,
            a: rand() * Math.PI * 2,
            w: 0.25 * Math.pow(R / r, 1.5),
            col: c(pick(rand, [0x8a8070, 0x6a6258, 0xa89880, 0x5a5048])),
          };
        })
      : [];

  // ---- the disc: everything about each pixel that doesn't change while it spins ----
  const pitch = 0.32;
  const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)];
  const idx: number[] = [];
  const lon: number[] = [];
  const row: number[] = [];
  const nx: number[] = [];
  const ny: number[] = [];
  const nzs: number[] = [];
  const dither: number[] = [];
  const rim: { i: number; x: number; y: number; d: number }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / R;
      const dy = -(y + 0.5 - cy) / R;
      const r2 = dx * dx + dy * dy;
      if (r2 <= 1) {
        const dz = Math.sqrt(1 - r2);
        const mx = dx * cr + dy * sr;
        const my = -dx * sr + dy * cr;
        const my2 = my * cp - dz * sp;
        const mz2 = my * sp + dz * cp;
        const lat = Math.asin(Math.max(-1, Math.min(1, my2)));
        idx.push(y * W + x);
        lon.push(((Math.atan2(mx, mz2) / (Math.PI * 2)) * TEX_W + TEX_W) % TEX_W);
        row.push(Math.min(TEX_H - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * TEX_H))));
        nx.push(dx);
        ny.push(dy);
        nzs.push(dz);
        dither.push(BAYER[(y & 3) * 4 + (x & 3)]);
      } else if (world.atmosphere !== null && r2 <= (1 + 1.4 / R) ** 2) {
        const r = Math.sqrt(r2);
        rim.push({ i: y * W + x, x: dx / r, y: dy / r, d: BAYER[(y & 3) * 4 + (x & 3)] });
      }
    }
  }

  const STAR_PX = c(mix(star, 0xffffff, 0.5));
  const STAR_DIM = c(0x5f6c96);
  const CITY_PX = c(0xffd468);
  const RIM_PX = world.atmosphere !== null ? c(world.atmosphere) : 0;
  const GLINT = c(mix(star, 0xd9f0ff, 0.6));

  let spin = rand() * 6;
  let clock = 0;
  let rush = 0;
  const light = [-0.55, 0.5, 0.62];

  const drawMoons = (f: Frame, front: boolean, L: number[]) => {
    for (const m of moons) {
      if (Math.sin(m.a) > 0 !== front) continue;
      const ex = Math.cos(m.a) * m.dist;
      const ey = Math.sin(m.a) * m.dist * m.tilt;
      const mx = Math.round(cx + ex * cr - ey * sr);
      const my = Math.round(cy + ex * sr + ey * cr);
      for (let y = -m.r; y <= m.r; y++) {
        for (let x = -m.r; x <= m.r; x++) {
          const dx = (x + 0.5) / m.r;
          const dy = -(y + 0.5) / m.r;
          const r2 = dx * dx + dy * dy;
          if (r2 > 1) continue;
          const X = mx + x;
          const Y = my + y;
          if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
          const d = dx * L[0] + dy * L[1] + Math.sqrt(1 - r2) * L[2] + BAYER[(Y & 3) * 4 + (X & 3)] * 0.2;
          let level = d > 0.5 ? 3 : d > 0.15 ? 2 : d > -0.05 ? 1 : 0;
          if (level > 0 && m.pits.some((p) => (dx - p.x) ** 2 + (dy - p.y) ** 2 < p.r * p.r)) level--;
          f.buf[Y * W + X] = m.tones[level];
        }
      }
    }
  };

  const drawDust = (f: Frame, front: boolean) => {
    for (const d of dust) {
      if (Math.sin(d.a) > 0 !== front) continue;
      const ex = Math.cos(d.a) * d.r;
      const ey = Math.sin(d.a) * d.r * ratio;
      const X = Math.round(cx + ex * cr - ey * sr);
      const Y = Math.round(cy + ex * sr + ey * cr);
      if (X >= 0 && X < W && Y >= 0 && Y < H) f.buf[Y * W + X] = d.col;
    }
  };

  return {
    bloom: 0.7,
    draw(f: Frame, _t: number, dt: number, input) {
      if (input.clicks.length) rush = 4;
      const speed = rush > 0 ? 1 + Math.min(rush, 1) * 22 : 1;
      rush = Math.max(0, rush - dt);
      clock += dt;
      spin += dt * 0.16 * speed;
      for (const m of moons) m.a += dt * m.speed * Math.min(speed, 4);
      for (const d of dust) d.a += dt * d.w * Math.min(speed, 4);

      const target = [-0.55 + input.lookX * 1.4, 0.5 - input.lookY * 1.4, 0.62];
      for (let k = 0; k < 3; k++) light[k] += (target[k] - light[k]) * Math.min(1, dt * 6);
      const len = Math.hypot(light[0], light[1], light[2]);
      const L = [light[0] / len, light[1] / len, light[2] / len];
      const hl = Math.hypot(L[0], L[1], L[2] + 1);
      const Hv = [L[0] / hl, L[1] / hl, (L[2] + 1) / hl];

      f.buf.set(bg);
      for (const s of stars) {
        const tw = Math.sin(clock * 1.3 + s.p);
        if (tw <= -0.2) continue;
        f.buf[s.i] = tw > 0.75 ? STAR_PX : STAR_DIM;
        if (s.big && tw > 0.5) {
          const x = s.i % W;
          const y = (s.i / W) | 0;
          f.set(x - 1, y, STAR_DIM);
          f.set(x + 1, y, STAR_DIM);
          f.set(x, y - 1, STAR_DIM);
          f.set(x, y + 1, STAR_DIM);
        }
      }

      // the planet's shadow falls across the rings on the side away from the sun
      const lx2 = -L[0];
      const ly2 = L[1];
      const ll = Math.hypot(lx2, ly2) || 1;
      const ringCol = (p: (typeof ringPx)[number]) => {
        const along = (p.x * lx2 + p.y * ly2) / ll;
        const across = Math.abs(p.x * ly2 - p.y * lx2) / ll;
        return along > 0 && across < R * Math.max(0.6, 1 - L[2] * 0.4) ? p.dark : p.col;
      };
      drawDust(f, false);
      for (const p of ringPx) if (!p.front) f.buf[p.i] = ringCol(p);
      drawMoons(f, false, L);

      const groundShift = (spin / (Math.PI * 2)) * TEX_W;
      const cloudShift = groundShift * (1 + world.wind) + clock * 0.6;
      const twinkle = Math.floor(clock * 3);
      for (let k = 0; k < idx.length; k++) {
        const d = nx[k] * L[0] + ny[k] * L[1] + nzs[k] * L[2] + dither[k] * 0.18;
        let level = d > 0.55 ? 3 : d > 0.16 ? 2 : d > -0.06 ? 1 : 0;
        // the limb turns away from the sun, so the edge loses a step of light: that's the roundness
        if (nzs[k] < 0.2 && level > 1) level--;
        const rowOff = row[k] * TEX_W;
        const gu = (((lon[k] - groundShift) % TEX_W) + TEX_W) % TEX_W | 0;
        const cu = (((lon[k] - cloudShift) % TEX_W) + TEX_W) % TEX_W | 0;
        const cl = world.cloud[rowOff + cu];
        let col: number;
        if (cl) col = world.cloudShades[cl === 2 ? 0 : 1][level];
        else {
          const ti = rowOff + gu;
          const g = world.ground[ti];
          // clouds throw a shadow a few pixels off
          if (level >= 2 && world.cloud[rowOff + ((cu + 3) % TEX_W)]) level--;
          if (world.glows[g]) col = world.palette[g][Math.max(level, 2)];
          else if (level === 0 && world.city[ti] && (ti + twinkle) % 9 !== 0) col = CITY_PX;
          else {
            col = world.palette[g][level];
            if (level >= 2 && world.water[g] && nx[k] * Hv[0] + ny[k] * Hv[1] + nzs[k] * Hv[2] > 0.985) col = GLINT;
          }
        }
        f.buf[idx[k]] = col;
      }
      for (const r of rim) if (r.x * L[0] + r.y * L[1] + r.d * 0.35 > 0.05) f.buf[r.i] = RIM_PX;

      for (const p of ringPx) if (p.front) f.buf[p.i] = ringCol(p);
      drawMoons(f, true, L);
      drawDust(f, true);
    },
  };
};
