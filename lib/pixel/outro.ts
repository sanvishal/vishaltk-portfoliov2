import { BAYER, bands, blit, c, mix, mixPacked, mulberry32, type Frame, type Sprite } from "./frame";
import { PUFF_DAY, PUFF_DUSK, PUFF_GOLD, PUFF_NIGHT, puffCloud } from "./puffs";
import { TREE_AUTUMN, TREE_GREEN, TREE_OLIVE, TREE_TEAL, drawTree, makeTree } from "./trees";
import { pickTime } from "./time";
import { makeNoise3 } from "./world";

/** where the pointer is over the scene, in its pixels, and how fast it's moving; null when away */
export type OutroInput = {
  x: number | null;
  y: number | null;
  vx: number;
  vy: number;
  clicks: { x: number; y: number }[];
  /** on a phone, how far it's leaned left or right; the wind blows that way */
  tilt?: number;
};

type Perch = { x: number; y: number };
type Bird = { x: number; y: number; vx: number; vy: number; state: "perched" | "flying" | "landing" | "gone"; perch: number; p: number; wait: number; look: number };

/**
 * the end of the page: a patch of countryside, different every visit. big clouds, a hazy line
 * of trees far off, and close by a tree in blossom with a bench or a lamp or a little pier
 * beside it, grass and wildflowers all along the ground. it notices you: the grass leans out
 * of your way, the leaves rustle and shed petals as you pass through them, and the birds
 * sitting about take off if you come too close. click for a gust of wind.
 */
export function outro(seed: number, W: number, H: number, night: boolean) {
  const rand = mulberry32(seed);
  const noise = makeNoise3(rand);
  const time = pickTime(rand, night);
  const s = H / 100;
  const ground = Math.round(H * 0.8);
  const tones = { dawn: PUFF_GOLD, day: PUFF_DAY, golden: PUFF_GOLD, dusk: PUFF_DUSK, night: PUFF_NIGHT }[time.name];
  const tint = time.tone;

  // ---- the sky and what's far away, painted once ----
  const base = new Uint32Array(W * H);
  const sky = bands(W, H, time.sky);
  base.set(sky.subarray(0, W * H));
  const stars = time.stars ? Array.from({ length: Math.round(W * 0.4) }, () => ({ i: Math.floor(rand() * ground * 0.8) * W + Math.floor(rand() * W), p: rand() * 6 })) : [];
  if (time.moon) {
    // the moon: a soft halo, a seeded phase with a curved edge to its shadow, the rim a
    // shade darker, a few craters with lit edges, and its dark side faintly there
    const mx = W * (0.15 + rand() * 0.7);
    const my = H * (0.3 + rand() * 0.06);
    const mr = 6.5 * s;
    const phase = -0.9 + rand() * 1.3;
    const craters = Array.from({ length: 5 }, () => ({ x: (rand() - 0.5) * 1.2, y: (rand() - 0.5) * 1.2, r: 0.12 + rand() * 0.14 }));
    const reach = mr * 2.6;
    for (let y = Math.floor(my - reach); y <= my + reach; y++)
      for (let x = Math.floor(mx - reach); x <= mx + reach; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const i = y * W + x;
        const dth = BAYER[(y & 3) * 4 + (x & 3)];
        const nx = (x + 0.5 - mx) / mr;
        const ny = (y + 0.5 - my) / mr;
        const d = Math.hypot(nx, ny);
        if (d > 1) {
          // the halo, stepped and dithered
          const g = Math.max(0, 1 - (d - 1) / 1.6) ** 2 * 0.32 + dth * 0.04;
          const q = Math.floor(g * 8) / 8;
          if (q > 0) base[i] = mixPacked(base[i], c(0xc8d4ff), q);
          continue;
        }
        const edge = phase * Math.sqrt(Math.max(0, 1 - ny * ny));
        if (nx < edge + dth * 0.06) {
          // the dark side: just the sky, lit a little by the earth
          base[i] = mixPacked(base[i], c(0x9aa4cc), 0.16);
          continue;
        }
        let col = 0xf6f2dc;
        if (d > 0.82) col = 0xe4dcc4;
        if (nx - edge < 0.18) col = 0xd8d0b8;
        for (const cr of craters) {
          const cd = Math.hypot(nx - cr.x, ny - cr.y) / cr.r;
          if (cd < 1) col = cd > 0.7 && nx - cr.x > 0 ? 0xfffbe8 : 0xcfc6ac;
        }
        base[i] = c(col);
      }
  }
  // two lines of hills and trees far off, hazy blue
  for (let layer = 0; layer < 2; layer++) {
    const tone = tint(mix(layer ? 0x5a7a6a : 0x8aa4b4, time.sky[time.sky.length - 1], layer ? 0.35 : 0.55));
    for (let x = 0; x < W; x++) {
      let top = ground - (layer ? 6 : 12) * s + noise(x * 0.02, layer * 7, 1, 2) * 8 * s;
      // a fringe of treetops along the ridge
      top -= Math.max(0, noise(x * 0.25, layer * 5 + 3, 2, 1)) * (layer ? 5 : 3) * s;
      for (let y = Math.max(0, Math.round(top)); y < ground; y++) base[y * W + x] = c(tone);
    }
  }
  // the ground: a band of grass, then earth going down into the page
  for (let y = ground; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = y - ground;
      const dth = BAYER[(y & 3) * 4 + (x & 3)];
      const col = d < 2 * s ? 0x4a9a3a : d < 4 * s + dth * 2 ? 0x2e6a2e : mix(0x3a3040, 0x24202c, Math.min(1, (d - 4 * s) / (H - ground)));
      base[y * W + x] = c(tint(col));
    }

  // ---- clouds: the new kind, drifting ----
  const clouds: { s: Sprite; x: number; y: number; v: number }[] = [];
  const nClouds = 2 + Math.floor(rand() * 2);
  for (let k = 0; k < nClouds; k++) {
    const cw = Math.round(W * (0.22 + rand() * 0.18));
    const ch = Math.round(H * (0.42 + rand() * 0.2));
    // their flat bases ride a little above the far trees
    clouds.push({ s: puffCloud(rand, cw, ch, tones), x: (k / nClouds) * W + rand() * W * 0.2, y: ground - 12 * s - ch * 0.84 - H * (0.04 + rand() * 0.14), v: 0.6 + rand() * 1.2 });
  }

  // ---- the tree: drawn the way pixel artists draw them ----
  const left = rand() < 0.5;
  const tx = W * (left ? 0.12 + rand() * 0.14 : 0.74 + rand() * 0.14);
  const R = H * (0.19 + rand() * 0.05);
  const treeTones = [TREE_GREEN, TREE_GREEN, TREE_OLIVE, TREE_AUTUMN, TREE_TEAL][Math.floor(rand() * 5)].map(tint);
  const blooming = treeTones !== null && rand() < 0.4;
  const blossom = [0xffb0c8, 0xfff0f4, 0xffd0e0].map(tint);
  const tree = makeTree(rand, R, treeTones, { light: left ? 1 : -1, trunk: 1 + rand() * 0.3, blossom: blooming ? blossom : null, bark: [0x2a1a1e, 0x5a3a2c, 0x8a5e3e].map(tint) });
  const petalCols = (blooming ? blossom : treeTones.slice(3)).map(c);

  // ---- props beside the tree: a bench, a lamp, a fence, a signpost, some rocks ----
  const perches: Perch[] = [];
  for (const cl of tree.clumps) if (cl.y < tree.top + R * 0.9) perches.push({ x: tx + cl.x + (rand() - 0.5) * cl.r * 0.6, y: ground + cl.y - cl.r * 0.85 });
  const propsLayer = new Uint32Array(W * H);
  const pput = (x: number, y: number, rgb: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) propsLayer[y * W + x] = c(tint(rgb));
  };
  const prect = (x: number, y: number, w: number, h: number, rgb: number) => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) pput(x + xx, y + yy, rgb);
  };
  const free: [number, number][] = [];
  const claim = (w: number) => {
    for (let tries = 0; tries < 30; tries++) {
      const x = W * (0.05 + rand() * 0.88);
      if (Math.abs(x + w / 2 - tx) < R * 1.5) continue;
      if (free.some(([a, b]) => x < b + 6 && x + w > a - 6)) continue;
      free.push([x, x + w]);
      return x;
    }
    return -1;
  };
  let lamp: { x: number; y: number } | null = null;
  const pool = ["bench", "lamp", "fence", "sign", "rocks"].sort(() => rand() - 0.5).slice(0, 3);
  for (const kind of pool) {
    if (kind === "bench") {
      const w = Math.round(16 * s);
      const x = claim(w);
      if (x < 0) continue;
      prect(x, ground - 7 * s, w, 2, 0x8a5a3a);
      prect(x, ground - 5 * s, w, 1, 0x5a3a26);
      prect(x, ground - 4 * s, w, 2, 0x9a6a42);
      prect(x + 1, ground - 2 * s, 1, 2 * s, 0x3a2a20);
      prect(x + w - 2, ground - 2 * s, 1, 2 * s, 0x3a2a20);
      perches.push({ x: x + w * 0.3, y: ground - 7 * s - 1 }, { x: x + w * 0.75, y: ground - 7 * s - 1 });
    } else if (kind === "lamp") {
      const x = claim(5);
      if (x < 0) continue;
      prect(x + 2, ground - 26 * s, 1, 26 * s, 0x2a2a34);
      prect(x, ground - 28 * s, 5, 2, 0x2a2a34);
      prect(x + 1, ground - 27 * s, 3, 2, night ? 0xfff0b0 : 0xd8e0e8);
      lamp = { x: x + 2, y: ground - 26 * s };
      perches.push({ x: x + 2, y: ground - 29 * s });
    } else if (kind === "fence") {
      const w = Math.round(30 * s);
      const x = claim(w);
      if (x < 0) continue;
      for (let k = 0; k <= w; k += Math.round(6 * s)) prect(x + k, ground - 8 * s, 2, 8 * s, 0x8a6a4a);
      prect(x, ground - 7 * s, w + 2, 1, 0x9a7a52);
      prect(x, ground - 4 * s, w + 2, 1, 0x9a7a52);
      perches.push({ x: x + w * 0.2, y: ground - 9 * s }, { x: x + w * 0.6, y: ground - 9 * s });
    } else if (kind === "sign") {
      const x = claim(10 * s);
      if (x < 0) continue;
      prect(x + 4 * s, ground - 14 * s, 2, 14 * s, 0x5a3a26);
      prect(x, ground - 15 * s, 10 * s, 5 * s, 0x9a6a42);
      prect(x + 2, ground - 13 * s, 6 * s, 1, 0x5a3a26);
      perches.push({ x: x + 5 * s, y: ground - 16 * s });
    } else {
      for (let k = 0; k < 3; k++) {
        const x = claim(6 * s);
        if (x < 0) continue;
        const r = (2 + rand() * 3) * s;
        for (let yy = -r; yy <= 0; yy++)
          for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy * 2 < r * r) pput(x + xx + r, ground + yy, xx < 0 && yy < -r * 0.4 ? 0xa8a0a0 : 0x6a6470);
      }
    }
  }

  // ---- grass and flowers along the ground ----
  const blades = Array.from({ length: Math.round(W * 1.3) }, () => {
    const x = rand() * W;
    // now and then a tall tuft among the short grass
    const tall = Math.sin(x * 0.07 + seed) > 0.85 && rand() < 0.6;
    return {
      x,
      h: (tall ? 8 + rand() * 7 : 2 + rand() * 5) * s,
      col: c(tint([0x2e7a3a, 0x4a9a3a, 0x6ab040, 0x8ac848][Math.floor(rand() * 4)])),
      flower: rand() < 0.08 ? c(tint([0xff8aa8, 0xfff07a, 0xffffff, 0xb08aff, 0xff7a4a][Math.floor(rand() * 5)])) : 0,
      p: rand() * 6,
      lean: 0,
    };
  });

  // ---- birds: some flying over, some sitting about ----
  // a few spots in the grass where small birds come down to peck
  const groundSpots = perches.length;
  for (let k = 0; k < 5; k++) perches.push({ x: W * (0.05 + rand() * 0.9), y: ground - 1 });
  const birds: Bird[] = [];
  for (let k = 0; k < 10; k++) {
    const perch = k < 6 ? Math.floor(rand() * groundSpots) : groundSpots + Math.floor(rand() * (perches.length - groundSpots));
    birds.push({ x: perches[perch].x, y: perches[perch].y, vx: 0, vy: 0, state: "perched", perch, p: rand() * 6, wait: 0, look: rand() < 0.5 ? -1 : 1 });
  }
  const fliers = Array.from({ length: 3 }, () => ({ x: rand() * W, y: H * (0.1 + rand() * 0.35), v: (rand() < 0.5 ? -1 : 1) * (10 + rand() * 10), p: rand() * 6, far: rand() < 0.5 }));
  // a flock now and then, in a loose V
  const flock = { x: -40, y: H * 0.2, v: 16, n: 6, wait: 3 + rand() * 6, dir: 1 };
  // bees over the flowers, fluff on the wind, and a rabbit that comes by
  const bees = time.lightsOn ? [] : Array.from({ length: 5 }, () => ({ x: rand() * W, y: ground - 3 - rand() * 6 * s, p: rand() * 6 }));
  const fluff = Array.from({ length: 14 }, () => ({ x: rand() * W, y: ground - rand() * H * 0.5, p: rand() * 6 }));
  const rabbit = { x: -10, dir: 1, wait: 4 + rand() * 10, pause: 0, hop: 0 };
  const flutter = Array.from({ length: time.lightsOn ? 14 : 7 }, () => ({ x: rand() * W, y: ground - rand() * 20 * s, p: rand() * 6, col: c(time.lightsOn ? 0xd8ff8a : [0xfff07a, 0xffffff, 0xffa040][Math.floor(rand() * 3)]) }));
  const petals: { x: number; y: number; vx: number; vy: number; col: number; age: number }[] = [];

  let clock = rand() * 100;
  let gust = 0;
  const birdInk = c(tint(0x1a1620));

  return {
    draw(f: Frame, dt: number, input: OutroInput) {
      clock += dt;
      if (input.clicks.length) gust = 1;
      gust = Math.max(0, gust - dt * 0.6);
      // wind as a travelling wave: gusts roll across the scene from one side, so they reach the
      // grass in one place and the tree a moment later, rather than everything swaying at once
      const breeze = 0.35 + Math.sin(clock * 0.23) * 0.25;
      const gustAt = (x: number) => Math.max(0, noise(x * 0.018 - clock * 0.55, 3, clock * 0.07, 2) * 2.2 + 0.1);
      const lean = input.tilt ?? 0;
      const windAt = (x: number) => breeze + gustAt(x) * 2.2 + gust * 3 + lean * 2.5;
      const { buf } = f;
      buf.set(base);
      for (const st of stars) if (Math.sin(clock * 1.3 + st.p) > -0.2) buf[st.i] = c(0xdfe6ff);

      for (const cl of clouds) {
        const span = W + cl.s.w;
        const x = ((((cl.x + clock * cl.v) % span) + span) % span) - cl.s.w;
        blit(f, cl.s, x, cl.y);
      }

      // the sky dissolves into the page: a dither, along a line that wanders with slow noise,
      // the way the picture at the top of the page meets it. everything near is drawn after,
      // so the tree and the birds can rise out over the page
      const fade = Math.round(H * 0.14);
      for (let x = 0; x < W; x++) {
        const edge = (noise(x * 0.035, 41, clock * 0.12, 2) * 1.4 + 0.5) * fade * 1.4;
        const end = Math.min(H, Math.ceil(edge + fade));
        for (let y = 0; y < end; y++) {
          const t = (y - edge) / fade;
          if (t < BAYER[(y & 3) * 4 + (x & 3)] + 0.5) buf[y * W + x] = 0;
        }
      }

      // props, then the tree
      for (let i = 0; i < W * H; i++) if (propsLayer[i]) buf[i] = propsLayer[i];
      if (lamp && time.lightsOn) {
        // a soft halo round the lamp, and a warm pool of light on the grass beneath it
        const hy = lamp.y - 1;
        const hr = 9 * s;
        for (let y = Math.round(hy - hr); y <= Math.round(hy + hr); y++)
          for (let x = Math.round(lamp.x - hr); x <= Math.round(lamp.x + hr); x++) {
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const d = Math.hypot(x - lamp.x, y - hy) / hr;
            if (d >= 1) continue;
            const q = Math.floor(((1 - d) ** 2 * 0.5 + BAYER[(y & 3) * 4 + (x & 3)] * 0.04) * 8) / 8;
            if (q > 0) buf[y * W + x] = mixPacked(buf[y * W + x], c(0xffe0a0), q);
          }
        const pr = 14 * s;
        for (let y = ground - 2; y < ground + 4 * s; y++)
          for (let x = Math.round(lamp.x - pr); x <= Math.round(lamp.x + pr); x++) {
            if (x < 0 || x >= W || y >= H) continue;
            const d = Math.hypot((x - lamp.x) / pr, (y - ground) / (3 * s));
            if (d >= 1) continue;
            const q = Math.floor(((1 - d) * 0.35 + BAYER[(y & 3) * 4 + (x & 3)] * 0.05) * 6) / 6;
            if (q > 0) buf[y * W + x] = mixPacked(buf[y * W + x], c(0xffd890), q);
          }
      }
      // the crown's clumps sit on springs the pointer can ruffle; the wind itself bends the
      // whole tree (below), so the springs only take a little of it
      for (const cl of tree.clumps) {
        const sway = Math.sin(clock * 1.3 + cl.seed) * 0.25;
        if (input.x !== null && input.y !== null) {
          const d = Math.hypot(input.x - (tx + cl.x + cl.ox), input.y - (ground + cl.y + cl.oy));
          if (d < cl.r + 4) {
            cl.vx += input.vx * 0.08;
            cl.vy += input.vy * 0.05;
            if (Math.hypot(input.vx, input.vy) > 30 && Math.random() < 0.12 && petals.length < 40)
              petals.push({ x: tx + cl.x + (Math.random() - 0.5) * cl.r, y: ground + cl.y + (Math.random() - 0.5) * cl.r, vx: input.vx * 0.2, vy: -5, col: petalCols[Math.floor(Math.random() * petalCols.length)], age: 0 });
          }
        }
        if (gust > 0.5 && Math.random() < dt * 1.5 && petals.length < 40) petals.push({ x: tx + cl.x, y: ground + cl.y, vx: 20, vy: -4, col: petalCols[0], age: 0 });
        cl.vx += (-cl.ox * 40 - cl.vx * 7 + sway * 6) * dt;
        cl.vy += (-cl.oy * 40 - cl.vy * 7) * dt;
        cl.ox = Math.max(-3, Math.min(3, cl.ox + cl.vx * dt));
        cl.oy = Math.max(-2, Math.min(2, cl.oy + cl.vy * dt));
      }
      // the tree bows with the gust passing over it, and its leaves shiver while it does
      const atTree = windAt(tx);
      drawTree(f, tree, tx, ground, Math.min(4, atTree * 1.1) * s, Math.min(1, gustAt(tx) * 0.9 + gust), clock);

      // grass: swaying, flowers on some, leaning out of the pointer's way
      const near = input.x !== null && input.y !== null && input.y > ground - 22 * s;
      for (const b of blades) {
        // each blade leans with the wind where it stands, and its tip flutters faster when a
        // gust is passing through it
        const here = windAt(b.x);
        let target = here * 0.9 + Math.sin(clock * (5 + here * 3) + b.p) * (0.15 + gustAt(b.x) * 0.35);
        if (near) {
          const d = b.x - input.x!;
          if (Math.abs(d) < 14 * s) target += Math.sign(d || 1) * (1 - Math.abs(d) / (14 * s)) * 4 * s;
        }
        b.lean += (target - b.lean) * Math.min(1, dt * 8);
        const steps = Math.ceil(b.h);
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          f.set(b.x + b.lean * t * t, ground - t * b.h, k === steps && b.flower ? b.flower : b.col);
        }
      }

      // petals adrift
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.age += dt;
        p.vx += (windAt(p.x) * 6 - p.vx) * dt;
        p.vy = Math.min(10, p.vy + dt * 12);
        p.x += (p.vx + Math.sin(p.age * 5) * 4) * dt;
        p.y += p.vy * dt;
        if (p.y > ground + 2 || p.age > 6) {
          petals.splice(i, 1);
          continue;
        }
        f.set(p.x, p.y, p.col);
      }

      // birds sitting about: they hop and look around, and take off when you come close
      for (const b of birds) {
        if (b.state === "perched") {
          if (Math.random() < dt * 0.4) b.look = -b.look;
          if (input.x !== null && input.y !== null && Math.hypot(input.x - b.x, input.y - b.y) < 14 * s) {
            b.state = "flying";
            b.vx = (b.x < input.x ? -1 : 1) * (25 + Math.random() * 15);
            b.vy = -20 - Math.random() * 10;
          }
          const hop = Math.sin(clock * 9 + b.p) > 0.97 ? 1 : 0;
          // the ones on the ground peck about and shuffle along
          const onGround = b.perch >= groundSpots;
          const peck = onGround && Math.sin(clock * 6 + b.p * 3) > 0.6 ? 1 : 0;
          if (onGround && hop) b.x += b.look * 0.5;
          f.set(b.x, b.y - hop, birdInk);
          f.set(b.x + 1, b.y - hop, birdInk);
          f.set(b.x + (b.look > 0 ? 2 : -1), b.y - 1 - hop + peck, birdInk);
          f.set(b.x + (b.look > 0 ? -1 : 2), b.y - hop, birdInk);
        } else if (b.state === "flying") {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vy += dt * 4;
          const up = Math.sin(clock * 18 + b.p) > 0;
          f.set(b.x, b.y, birdInk);
          f.set(b.x - 1, b.y + (up ? -1 : 1), birdInk);
          f.set(b.x + 1, b.y + (up ? -1 : 1), birdInk);
          if (b.x < -10 || b.x > W + 10 || b.y < -10) {
            b.state = "gone";
            b.wait = 6 + Math.random() * 10;
          }
        } else if (b.state === "gone") {
          b.wait -= dt;
          if (b.wait <= 0) {
            b.perch = Math.floor(Math.random() * perches.length);
            b.state = "landing";
            b.x = Math.random() < 0.5 ? -6 : W + 6;
            b.y = H * 0.1;
          }
        } else {
          const p = perches[b.perch];
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < 1) {
            b.state = "perched";
            b.x = p.x;
            b.y = p.y;
          } else {
            const sp = Math.min(d, 30 * dt);
            b.x += (dx / d) * sp;
            b.y += (dy / d) * sp;
            const up = Math.sin(clock * 16 + b.p) > 0;
            f.set(b.x, b.y, birdInk);
            f.set(b.x - 1, b.y + (up ? -1 : 0), birdInk);
            f.set(b.x + 1, b.y + (up ? -1 : 0), birdInk);
          }
        }
      }
      // birds crossing far off
      for (const fl of fliers) {
        fl.x += fl.v * dt * (fl.far ? 0.5 : 1);
        if (fl.x < -8) fl.x = W + 8;
        if (fl.x > W + 8) fl.x = -8;
        const up = Math.sin(clock * (fl.far ? 10 : 14) + fl.p) > 0;
        const ink = c(tint(fl.far ? mix(0x1a1620, time.sky[1], 0.5) : 0x1a1620));
        f.set(fl.x, fl.y + Math.sin(clock + fl.p) * 2, ink);
        if (!fl.far) {
          f.set(fl.x - 1, fl.y + Math.sin(clock + fl.p) * 2 + (up ? -1 : 1), ink);
          f.set(fl.x + 1, fl.y + Math.sin(clock + fl.p) * 2 + (up ? -1 : 1), ink);
        }
      }
      // a flock passing over in a loose V, wings beating out of step
      if (flock.wait > 0) flock.wait -= dt;
      else {
        flock.x += flock.v * flock.dir * dt;
        for (let k = 0; k < flock.n; k++) {
          const row = Math.ceil(k / 2);
          const side = k % 2 === 0 ? 1 : -1;
          const x = flock.x - flock.dir * row * 5 * s;
          const y = flock.y + side * row * 2.5 * s + Math.sin(clock * 2 + k) * 0.8;
          const up = Math.sin(clock * 12 + k * 1.7) > 0;
          f.set(x, y, birdInk);
          f.set(x - 1, y + (up ? -1 : 1), birdInk);
          f.set(x + 1, y + (up ? -1 : 1), birdInk);
        }
        if (flock.x < -60 || flock.x > W + 60) {
          flock.dir = Math.random() < 0.5 ? 1 : -1;
          flock.x = flock.dir > 0 ? -20 : W + 20;
          flock.y = H * (0.12 + Math.random() * 0.2);
          flock.n = 4 + Math.floor(Math.random() * 5);
          flock.wait = 12 + Math.random() * 18;
        }
      }

      // a rabbit: hops in, stops to look about, hops on; bolts if you come near
      if (rabbit.wait > 0) rabbit.wait -= dt;
      else {
        const scared = input.x !== null && input.y !== null && Math.abs(input.x - rabbit.x) < 16 * s && input.y > ground - 20 * s;
        if (scared) {
          rabbit.dir = input.x! < rabbit.x ? 1 : -1;
          rabbit.pause = 0;
        }
        if (rabbit.pause > 0) rabbit.pause -= dt;
        else {
          rabbit.hop += dt * (scared ? 9 : 5);
          rabbit.x += rabbit.dir * dt * (scared ? 40 : 14) * s;
          if (Math.random() < dt * 0.3 && !scared) rabbit.pause = 1 + Math.random() * 2;
        }
        const lift = rabbit.pause > 0 ? 0 : Math.abs(Math.sin(rabbit.hop * Math.PI)) * 2;
        const rx = Math.round(rabbit.x);
        const ry = Math.round(ground - lift);
        const fur = c(tint(0x8a7a6a));
        const pale = c(tint(0xd8ccc0));
        f.rect(rx - 2, ry - 3, 5, 3, fur);
        f.rect(rx + rabbit.dir * 2, ry - 5, 2, 2, fur);
        f.set(rx + rabbit.dir * 2, ry - 7, fur);
        f.set(rx + rabbit.dir * 2, ry - 6, fur);
        f.set(rx - rabbit.dir * 3, ry - 3, pale);
        if (rabbit.x < -12 || rabbit.x > W + 12) {
          rabbit.wait = 15 + Math.random() * 25;
          rabbit.dir = Math.random() < 0.5 ? 1 : -1;
          rabbit.x = rabbit.dir > 0 ? -10 : W + 10;
        }
      }

      // bees busy over the flowers, and fluff riding the wind
      for (const b of bees) {
        b.x += (Math.sin(clock * 7 + b.p) * 8 + Math.sin(clock * 0.4 + b.p) * 3) * dt;
        b.y += Math.cos(clock * 9 + b.p) * 6 * dt;
        b.y = Math.max(ground - 10 * s, Math.min(ground - 2, b.y));
        b.x = (b.x + W) % W;
        f.set(b.x, b.y, c(0xffd23a));
        f.set(b.x + 1, b.y, c(0x2a2420));
      }
      for (const fl of fluff) {
        fl.x += (windAt(fl.x) * 10 + 2 + Math.sin(clock + fl.p) * 3) * dt;
        fl.y += Math.sin(clock * 0.8 + fl.p) * 3 * dt - dt * 0.6;
        if (fl.x > W + 4) fl.x = -4;
        if (fl.x < -4) fl.x = W + 4;
        if (fl.y < H * 0.25) fl.y = ground - 2;
        f.set(fl.x, fl.y, mixPacked(f.get(Math.max(0, Math.min(W - 1, Math.round(fl.x))), Math.max(0, Math.min(H - 1, Math.round(fl.y)))), c(0xffffff), 0.7));
      }

      // butterflies by day, fireflies at night; both keep a little away from the pointer
      for (const b of flutter) {
        b.x += Math.sin(clock * 1.3 + b.p) * dt * 8;
        b.y += Math.cos(clock * 1.7 + b.p) * dt * 5;
        if (input.x !== null && input.y !== null) {
          const d = Math.hypot(b.x - input.x, b.y - input.y);
          if (d < 12 * s && d > 0) {
            b.x += ((b.x - input.x) / d) * dt * 30;
            b.y += ((b.y - input.y) / d) * dt * 30;
          }
        }
        b.x = (b.x + W) % W;
        b.y = Math.max(ground - 30 * s, Math.min(ground - 2, b.y));
        if (time.lightsOn) {
          if (Math.sin(clock * 2.2 + b.p) > 0.1) f.set(b.x, b.y, b.col);
        } else {
          const open = Math.sin(clock * 14 + b.p) > 0;
          f.set(b.x, b.y, b.col);
          if (open) {
            f.set(b.x - 1, b.y - 1, b.col);
            f.set(b.x + 1, b.y - 1, b.col);
          }
        }
      }

    },
  };
}
