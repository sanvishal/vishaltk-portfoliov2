import { ball, c, dith, mix, mixPacked, mulberry32, type Frame } from "./frame";
import type { PlaceMaker } from "./scene";
import { pick, pickTime } from "./time";
import { makeNoise3 } from "./world";

/**
 * how a fish is coloured along its body, head first. each returns one colour per segment.
 * the big and medium fish are koi; the small ones are goldfish, minnows and the like.
 */
type Pattern = (n: number, rand: () => number) => number[];

const patches = (base: number, spot: number, rand: () => number, n: number, count = 1 + Math.floor(rand() * 3)) => {
  const out = Array.from({ length: n }, () => base);
  for (let k = 0; k < count; k++) {
    const a = Math.floor(rand() * n * 0.75);
    for (let i = a; i < Math.min(n, a + 2 + Math.floor(rand() * 3)); i++) out[i] = spot;
  }
  return out;
};

const KOI: { fin: number; pattern: Pattern; longFin?: boolean }[] = [
  { fin: 0xf8f4ec, pattern: (n, r) => patches(0xf4f1e8, 0xd9432f, r, n) }, // kohaku
  { fin: 0xf8f4ec, pattern: (n) => Array.from({ length: n }, (_, i) => (i === 1 ? 0xd9432f : 0xf4f1e8)) }, // tancho
  { fin: 0xf0e4d4, pattern: (n, r) => patches(patches(0xf4f1e8, 0xd9432f, r, n)[0], 0x22202a, r, n, 1).map((c0, i, all) => (i % 4 === 2 ? 0xd9432f : all[i] === 0x22202a ? 0x22202a : c0)) }, // sanke
  { fin: 0xe8e2d4, pattern: (n, r) => patches(0x22202a, 0xd9432f, r, n, 2).map((c0, i) => (i === 0 ? 0xf2eee4 : c0)) }, // showa
  { fin: 0xf0d07a, pattern: (n) => Array.from({ length: n }, (_, i) => (i < 2 ? 0xf2c45a : 0xe2a63a)) }, // ogon
  { fin: 0xf6e48a, pattern: (n) => Array.from({ length: n }, () => 0xf0d24a) }, // yamabuki
  { fin: 0xe89a5a, pattern: (n) => Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 0xe8843a : 0xd2652a)) }, // chagoi
  { fin: 0xb8c8d8, pattern: (n) => Array.from({ length: n }, (_, i) => (i > n * 0.6 ? 0xe0703a : 0x8aa0b8)) }, // asagi
  { fin: 0xf8f4ec, pattern: (n, r) => patches(0xf4f1e8, 0xe8843a, r, n), longFin: true }, // butterfly
];

const SMALL: { body: number; fin: number }[] = [
  { body: 0xf08a2a, fin: 0xf6b46a }, // goldfish
  { body: 0xb8c4cc, fin: 0xdfe6ea }, // minnow
  { body: 0xd8c890, fin: 0xeee2b4 }, // medaka
  { body: 0x2a2a34, fin: 0x4a4a58 }, // black moor
  { body: 0xe85a3a, fin: 0xf6a07a }, // red cap
];

type Fish = {
  pts: { x: number; y: number }[];
  colors: number[];
  fin: number;
  longFin: boolean;
  /** body size relative to a full-grown koi */
  size: number;
  small: boolean;
  /** who it follows, if anyone, and where it likes to sit relative to them */
  leader: Fish | null;
  slot: { back: number; side: number };
  goal: { x: number; y: number };
  /** the part of the pond a leader likes to keep to */
  home: { x: number; y: number } | null;
  heading: number;
  speed: number;
  phase: number;
};

/**
 * a koi pond from above. the fish are chains of points: the head steers and every segment
 * follows the one in front, so their bodies bend like the real thing. big koi lead, smaller
 * koi trail them, and little schools of goldfish and minnows follow scouts of their own.
 * light ripples across the bottom, lily pads float over them. click the water to feed them.
 */
export const koi: PlaceMaker = (seed, W, H, night) => {
  const rand = mulberry32(seed);
  const time = pickTime(rand, night);
  const tone = time.tone;
  const fbm = makeNoise3(rand);
  // one unit of fish, so they read at any frame size
  const u = Math.max(1.2, W / 170);

  // how deep the pond is at each pixel, which sets its colour
  const water = [0x2c827a, 0x216d6a, 0x175a5a, 0x10494d].map((x) => c(tone(x)));
  const glint = [0x4fae9f, 0x3a958a, 0x2c7c78, 0x226a6a].map((x) => c(tone(x)));
  const depth = new Uint8Array(W * H);
  const dcx = W * (0.4 + rand() * 0.2);
  const dcy = H * (0.4 + rand() * 0.2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot((x - dcx) / (W * 0.45), (y - dcy) / (H * 0.55));
      const n = fbm(x * 0.03, y * 0.03, 3, 3) * 0.6;
      const d = 1 - r + n + dith(x, y) * 0.12;
      depth[y * W + x] = d > 0.7 ? 3 : d > 0.45 ? 2 : d > 0.2 ? 1 : 0;
    }
  }

  // drifting cells for the caustics
  const CELL = Math.max(14, Math.round(W / 14));
  // where the light is gathering more, and where less
  const bright = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) bright[y * W + x] = fbm(x * 0.02 + 9, y * 0.02, 7, 3);
  const gw = Math.ceil(W / CELL) + 2;
  const gh = Math.ceil(H / CELL) + 2;
  const seeds = Array.from({ length: gw * gh }, () => ({ ox: rand(), oy: rand(), p: rand() * 6.28, s: 0.3 + rand() * 0.4 }));

  // lily pads, some flowering
  const pads = Array.from({ length: 3 + Math.floor(rand() * 5) }, () => ({
    x: rand() * W,
    y: rand() * H,
    r: 4 + rand() * 6,
    notch: rand() * Math.PI * 2,
    flower: rand() < 0.35 ? pick(rand, [0xf6b3cf, 0xfaf3f6, 0xf7d36a]) : 0,
  }));
  const padTones = [0x8fd06a, 0x62b04c, 0x4a9640, 0x34763a].map((x) => c(tone(x)));

  const stones = Array.from({ length: Math.floor(rand() * 3) }, () => ({
    x: rand() < 0.5 ? rand() * W * 0.2 : W - rand() * W * 0.2,
    y: rand() * H,
    r: 5 + rand() * 6,
  }));

  const leaves = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => ({
    x: rand() * W,
    y: rand() * H,
    a: rand() * 6.28,
    col: pick(rand, [0xe2682a, 0xd94a2a, 0xf2a03a]),
  }));

  const spawn = (x: number, y: number, size: number, len: number, colors: number[], fin: number, small: boolean, longFin = false): Fish => {
    const heading = rand() * Math.PI * 2;
    const gap = u * size * 0.9;
    return {
      pts: Array.from({ length: len }, (_, i) => ({ x: x - Math.cos(heading) * i * gap, y: y - Math.sin(heading) * i * gap })),
      colors,
      fin,
      longFin,
      size,
      small,
      leader: null,
      slot: { back: 0, side: 0 },
      goal: { x: W * (0.1 + rand() * 0.8), y: H * (0.1 + rand() * 0.8) },
      home: null,
      heading,
      speed: (small ? 9 + rand() * 5 : 5 + rand() * 4) * u,
      phase: rand() * 6.28,
    };
  };
  const koiAt = (x: number, y: number, size: number) => {
    const kind = pick(rand, KOI);
    const len = 11 + Math.floor(rand() * 6);
    return spawn(x, y, size, len, kind.pattern(len, rand), kind.fin, false, kind.longFin);
  };

  const fish: Fish[] = [];
  // the big ones lead
  // each big koi keeps to its own part of the pond, so they don't all end up in the middle
  const nLeaders = 3 + Math.floor(rand() * 3);
  const leaders = Array.from({ length: nLeaders }, (_, i) => {
    const home = { x: W * ((i + 0.5) / nLeaders), y: H * (0.3 + rand() * 0.4) };
    const k = koiAt(home.x, home.y, 1 + rand() * 0.45);
    k.home = home;
    return k;
  });
  fish.push(...leaders);
  // smaller koi fall in behind them
  for (const lead of leaders) {
    for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) {
      // they start anywhere in the pond and find their leader on their own
      const f2 = koiAt(W * (0.1 + rand() * 0.8), H * (0.1 + rand() * 0.8), 0.55 + rand() * 0.25);
      f2.leader = lead;
      f2.slot = { back: (6 + k * 5) * u, side: (rand() - 0.5) * 10 * u };
      fish.push(f2);
    }
  }
  // and little schools of small fish, each following one scout
  for (let sIdx = 0; sIdx < 3 + Math.floor(rand() * 3); sIdx++) {
    const kind = pick(rand, SMALL);
    const sx = W * (0.15 + rand() * 0.7);
    const sy = H * (0.15 + rand() * 0.7);
    const scout = spawn(sx, sy, 0.38 + rand() * 0.12, 5, Array(5).fill(kind.body), kind.fin, true);
    fish.push(scout);
    for (let k = 0; k < 4 + Math.floor(rand() * 7); k++) {
      const m = spawn(sx + (rand() - 0.5) * W * 0.4, sy + (rand() - 0.5) * H * 0.4, 0.3 + rand() * 0.15, 4 + Math.floor(rand() * 2), Array(6).fill(kind.body), kind.fin, true);
      m.leader = scout;
      m.slot = { back: (3 + rand() * 9) * u, side: (rand() - 0.5) * 12 * u };
      fish.push(m);
    }
  }
  // the biggest are drawn last, on top
  fish.sort((a2, b2) => a2.size - b2.size);

  const fireflies =
    time.lightsOn
      ? Array.from({ length: 10 }, () => ({ x: rand() * W, y: rand() * H, p: rand() * 6.28 }))
      : [];

  const food: { x: number; y: number }[] = [];
  const ripples: { x: number; y: number; age: number }[] = [];
  let clock = 0;
  let nextBug = 2;

  const width = (i: number, n: number) => (i < 2 ? 1.4 + i * 0.5 : Math.max(0.5, 2.3 * (1 - (i - 2) / (n - 2)) ** 0.8));

  const drawFish = (f: Frame, k: Fish, shadow: boolean) => {
    const n = k.pts.length;
    const shade = c(tone(0x0b3a3e));
    const s = u * k.size;
    for (let i = n - 1; i >= 0; i--) {
      const p = k.pts[i];
      const w = Math.max(0.6, width(i, n) * s * 0.85);
      const col = shadow ? shade : c(tone(k.colors[i] ?? k.colors[k.colors.length - 1]));
      const ox = shadow ? Math.round(2 * s) : 0;
      const oy = shadow ? Math.round(3 * s) : 0;
      for (let y = Math.floor(p.y - w); y <= Math.ceil(p.y + w); y++) {
        for (let x = Math.floor(p.x - w); x <= Math.ceil(p.x + w); x++) {
          if ((x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2 <= w * w + 0.3) f.set(x + ox, y + oy, col);
        }
      }
    }
    if (shadow) return;
    // fins and tail beat with the swim
    const beat = Math.sin(clock * (k.small ? 14 : 8) + k.phase);
    const fin = c(tone(k.fin));
    const at = (i: number) => k.pts[Math.min(i, n - 1)];
    const dir = (i: number) => Math.atan2(at(i).y - at(i + 1).y, at(i).x - at(i + 1).x);
    const tail = at(n - 1);
    const ta = dir(n - 2) + Math.PI;
    const tailLen = (k.longFin ? 5 : 3) * s;
    for (const side of [-1, 1]) {
      const a2 = ta + side * (0.5 + beat * 0.25);
      for (let r = 1; r <= Math.max(1, tailLen); r += 0.7) f.set(tail.x + Math.cos(a2) * r, tail.y + Math.sin(a2) * r, fin);
    }
    if (k.small) return;
    const pf = at(3);
    const pa = dir(3);
    for (const side of [-1, 1]) {
      const a2 = pa + side * (Math.PI / 2 + 0.5 + beat * 0.2);
      for (let r = 2 * k.size; r <= (2 + (k.longFin ? 2.6 : 1.6)) * s; r += 0.7) f.set(pf.x + Math.cos(a2) * r, pf.y + Math.sin(a2) * r, fin);
    }
    const head = at(0);
    const ha = dir(0);
    f.set(head.x + Math.cos(ha + 0.8) * 1.3 * s, head.y + Math.sin(ha + 0.8) * 1.3 * s, c(0x1a1a20));
    f.set(head.x + Math.cos(ha - 0.8) * 1.3 * s, head.y + Math.sin(ha - 0.8) * 1.3 * s, c(0x1a1a20));
  };

  const drawPad = (f: Frame, p: (typeof pads)[number]) => {
    for (let y = Math.floor(p.y - p.r); y <= p.y + p.r; y++) {
      for (let x = Math.floor(p.x - p.r); x <= p.x + p.r; x++) {
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        const d = Math.hypot(dx, dy) / p.r;
        if (d > 1) continue;
        let a = Math.atan2(dy, dx) - p.notch;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) < 0.35 && d > 0.15) continue;
        f.set(x + 1, y + 2, c(tone(0x0b3a3e)));
      }
    }
    for (let y = Math.floor(p.y - p.r); y <= p.y + p.r; y++) {
      for (let x = Math.floor(p.x - p.r); x <= p.x + p.r; x++) {
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        const d = Math.hypot(dx, dy) / p.r;
        if (d > 1) continue;
        let a = Math.atan2(dy, dx) - p.notch;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) < 0.35 && d > 0.15) continue;
        const lit = -dx * 0.5 - dy * 0.6 + dith(x, y) * p.r * 0.3;
        const vein = Math.abs(Math.sin(a * 3)) < 0.12 && d > 0.25;
        const k = d > 0.86 ? 3 : vein ? 2 : lit > p.r * 0.35 ? 0 : 1;
        f.set(x, y, padTones[k]);
      }
    }
    if (p.flower) {
      ball(f, p.x - p.r * 0.2, p.y - p.r * 0.2, Math.max(2, p.r * 0.35), [mix(p.flower, 0xffffff, 0.4), p.flower, mix(p.flower, 0x000000, 0.2)].map(tone));
      f.set(p.x - p.r * 0.2, p.y - p.r * 0.2, c(0xf7d36a));
    }
  };

  return {
    bloom: { dawn: 0.3, day: 0, golden: 0.45, dusk: 0.75, night: 1 }[time.name],
    hour: time.name,
    draw(f: Frame, _t: number, dt: number, input) {
      clock += dt;

      for (const click of input.clicks) {
        ripples.push({ ...click, age: 0 });
        for (let k = 0; k < 9; k++) food.push({ x: click.x + (Math.random() - 0.5) * 8, y: click.y + (Math.random() - 0.5) * 8 });
      }

      // water and caustics: light gathers along the edges between drifting cells
      for (let y = 0; y < H; y++) {
        const cy = Math.floor(y / CELL);
        for (let x = 0; x < W; x++) {
          const cx = Math.floor(x / CELL);
          let f1 = 1e9;
          let f2 = 1e9;
          for (let j = -1; j <= 1; j++) {
            for (let i = -1; i <= 1; i++) {
              const gx = cx + i + 1;
              const gy = cy + j + 1;
              if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
              const s = seeds[gy * gw + gx];
              const px = (cx + i + 0.5 + Math.sin(clock * s.s + s.p) * 0.35 + (s.ox - 0.5) * 0.4) * CELL;
              const py = (cy + j + 0.5 + Math.cos(clock * s.s * 0.8 + s.p) * 0.35 + (s.oy - 0.5) * 0.4) * CELL;
              const d = (x - px) ** 2 + (y - py) ** 2;
              if (d < f1) {
                f2 = f1;
                f1 = d;
              } else if (d < f2) f2 = d;
            }
          }
          const edge = Math.sqrt(f2) - Math.sqrt(f1);
          const dd = depth[y * W + x];
          const strength = bright[y * W + x] + 0.15 + Math.sin(clock * 0.3 + x * 0.01) * 0.05;
          f.buf[y * W + x] = edge < 0.6 + strength * 2.2 + dith(x, y) * 0.9 && strength > -0.05 ? glint[dd] : water[dd];
        }
      }

      for (const s of stones) {
        ball(f, s.x + 1, s.y + 2, s.r, [0x0b3a3e, 0x0b3a3e].map(tone));
        ball(f, s.x, s.y, s.r, [0xa8a49c, 0x86827a, 0x66625c, 0x4a4844].map(tone));
        ball(f, s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.45, [0x8fc06a, 0x6a9a4a, 0x4f7a3a].map(tone));
      }

      // the fish. leaders wander between spots; followers hold a loose place behind their
      // leader, keep their distance from each other and match its heading, like boids.
      for (const k of fish) {
        const head = k.pts[0];
        let target: { x: number; y: number } | null = null;
        let best = (k.small ? 40 : 60) ** 2;
        for (const fd of food) {
          const d = (fd.x - head.x) ** 2 + (fd.y - head.y) ** 2;
          if (d < best) {
            best = d;
            target = fd;
          }
        }

        let vx: number;
        let vy: number;
        let pace = 1;
        if (target) {
          vx = target.x - head.x;
          vy = target.y - head.y;
          pace = 1.9;
        } else if (k.leader) {
          const L = k.leader;
          const lh = L.pts[0];
          const bx = lh.x - Math.cos(L.heading) * k.slot.back - Math.sin(L.heading) * k.slot.side;
          const by = lh.y - Math.sin(L.heading) * k.slot.back + Math.cos(L.heading) * k.slot.side;
          const dist = Math.hypot(bx - head.x, by - head.y);
          vx = (bx - head.x) / (dist || 1) + Math.cos(L.heading) * 0.6;
          vy = (by - head.y) / (dist || 1) + Math.sin(L.heading) * 0.6;
          pace = Math.min(1.8, Math.max(0.6, dist / (6 * u)));
        } else {
          if (Math.hypot(k.goal.x - head.x, k.goal.y - head.y) < 8 * u) {
            k.goal = k.home
              ? {
                  x: Math.min(W * 0.92, Math.max(W * 0.08, k.home.x + (Math.random() - 0.5) * W * 0.45)),
                  y: Math.min(H * 0.92, Math.max(H * 0.08, k.home.y + (Math.random() - 0.5) * H * 0.7)),
                }
              : { x: W * (0.08 + Math.random() * 0.84), y: H * (0.08 + Math.random() * 0.84) };
          }
          const wob = Math.sin(clock * 0.7 + k.phase) * 0.35;
          const ga = Math.atan2(k.goal.y - head.y, k.goal.x - head.x) + wob;
          vx = Math.cos(ga);
          vy = Math.sin(ga);
        }
        // keep a little space from everyone nearby of a similar size
        for (const o of fish) {
          if (o === k || Math.abs(o.size - k.size) > 0.5) continue;
          const dx = head.x - o.pts[0].x;
          const dy = head.y - o.pts[0].y;
          const d2 = dx * dx + dy * dy;
          const room = (3 + k.size * 4) * u;
          if (d2 > 0 && d2 < room * room) {
            vx += (dx / d2) * room * 0.8;
            vy += (dy / d2) * room * 0.8;
          }
        }
        // and turn back from the edges
        const margin = 10 * u;
        if (head.x < margin) vx += (margin - head.x) / margin * 2;
        if (head.x > W - margin) vx -= (head.x - (W - margin)) / margin * 2;
        if (head.y < margin) vy += (margin - head.y) / margin * 2;
        if (head.y > H - margin) vy -= (head.y - (H - margin)) / margin * 2;

        const want = Math.atan2(vy, vx);
        let diff = Math.atan2(Math.sin(want - k.heading), Math.cos(want - k.heading));
        const turn = (k.small ? 4 : 1.8) * dt;
        diff = Math.max(-turn, Math.min(turn, diff));
        k.heading += diff;
        const v = k.speed * pace * (0.85 + Math.sin(clock * 1.3 + k.phase) * 0.15);
        head.x += Math.cos(k.heading) * v * dt;
        head.y += Math.sin(k.heading) * v * dt;
        const gap = u * k.size * 0.9;
        for (let i = 1; i < k.pts.length; i++) {
          const p0 = k.pts[i - 1];
          const p1 = k.pts[i];
          const d = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
          p1.x = p0.x + ((p1.x - p0.x) / d) * gap;
          p1.y = p0.y + ((p1.y - p0.y) / d) * gap;
        }
        if (target && best < (3 * u * k.size + 1) ** 2) {
          food.splice(food.indexOf(target), 1);
          ripples.push({ x: head.x, y: head.y, age: 0.3 });
        }
      }
      for (const k of fish) drawFish(f, k, true);
      for (const k of fish) drawFish(f, k, false);

      for (const fd of food) {
        fd.x += Math.sin(clock + fd.y) * dt * 0.5;
        f.set(fd.x, fd.y, c(tone(0xe0b46a)));
        f.set(fd.x + 1, fd.y + 1, c(tone(0x0b3a3e)));
      }

      for (const p of pads) drawPad(f, p);
      for (const l of leaves) {
        l.x = (l.x + dt * 1.2 + W) % W;
        l.y += Math.sin(clock * 0.3 + l.a) * dt * 0.8;
        l.a += dt * 0.2;
        const col = c(tone(l.col));
        const dark = c(tone(mix(l.col, 0x000000, 0.3)));
        for (let k = 0; k < 5; k++) {
          const a = l.a + (k / 5) * Math.PI * 2;
          f.set(l.x + Math.cos(a) * 2, l.y + Math.sin(a) * 2, col);
          f.set(l.x + Math.cos(a), l.y + Math.sin(a), col);
        }
        f.set(l.x, l.y, dark);
        f.set(l.x + 1, l.y + 3, c(tone(0x0b3a3e)));
      }

      // now and then something touches the surface
      nextBug -= dt;
      if (nextBug <= 0) {
        ripples.push({ x: Math.random() * W, y: Math.random() * H, age: 0 });
        nextBug = 2 + Math.random() * 4;
      }
      const ring = c(tone(0x9fe0d0));
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += dt;
        if (r.age > 1.8) {
          ripples.splice(i, 1);
          continue;
        }
        const rad = 1 + r.age * 8;
        const n = Math.ceil(rad * 5);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = Math.round(r.x + Math.cos(a) * rad);
          const y = Math.round(r.y + Math.sin(a) * rad);
          if (x >= 0 && y >= 0 && x < W && y < H && dith(x, y) + 0.5 > r.age / 1.8) f.buf[y * W + x] = mixPacked(f.buf[y * W + x], ring, 0.6);
        }
      }

      for (const fl of fireflies) {
        fl.x += Math.sin(clock * 0.7 + fl.p) * dt * 4;
        fl.y += Math.cos(clock * 0.5 + fl.p) * dt * 3;
        if (Math.sin(clock * 2 + fl.p) > 0.2) {
          f.set(fl.x, fl.y, c(0xfff3a0));
          if (dith(fl.x | 0, fl.y | 0) > 0) f.set(fl.x + 1, fl.y, c(0xb8c050));
        }
      }
    },
  };
};
