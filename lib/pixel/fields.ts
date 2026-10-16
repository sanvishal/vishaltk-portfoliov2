import { drawDrifters, type Drifter } from "./clouds";
import { puffCloud, puffTones } from "./puffs";
import { ball, bands, c, dith, mix, mixPacked, mulberry32, sprite, type Frame, type Sprite } from "./frame";
import { erdtree, isErdtree } from "./erdtree";
import type { PlaceMaker } from "./scene";
import { pick, pickTime } from "./time";
import { makeNoise3 } from "./world";

/** the main colour of each kind of flower, for drifts seen from a distance */
const BLOOM_BASE: Record<string, number> = {
  daisy: 0xffffff,
  poppy: 0xe8402e,
  cornflower: 0x3f7ad8,
  buttercup: 0xf6d23a,
  lavender: 0x9a7ad8,
  cosmos: 0xf08ab0,
};

/** hill greens, lit to deep, and the trees that grow on them */
const SEASONS = [
  { hill: [0xc4e47a, 0x9fd25a, 0x7dbd48, 0x5a9e3c, 0x3d7d34], tree: [0x5aa04a, 0x3f8a3e, 0x2f6e34, 0x22552a] },
  { hill: [0xd8e078, 0xb4cc56, 0x8fb444, 0x6a9638, 0x4a7630], tree: [0x6a9a3a, 0x4f8034, 0x3a662c, 0x2a4e24] },
  { hill: [0xf0d488, 0xdcb45a, 0xc4943e, 0x9c7234, 0x6e5230], tree: [0xd88a3a, 0xb8642e, 0x8a4a2a, 0x5e3424] },
];

type Bloom = "daisy" | "poppy" | "cornflower" | "buttercup" | "lavender" | "cosmos";
const MEADOWS: Bloom[][] = [
  ["daisy", "daisy", "buttercup", "poppy", "cornflower"],
  ["poppy", "poppy", "daisy", "cornflower"],
  ["lavender", "lavender", "daisy", "buttercup"],
  ["cosmos", "cosmos", "daisy", "cornflower", "buttercup"],
];

type Plant = { x: number; y: number; h: number; kind: Bloom | "blade"; size: number; shade: number; p: number; stiff: number };

/**
 * rolling hills going back into the haze, a meadow in front. the hills are layers that slide
 * past each other as you look around; each has a lit crest, a shaded underside and mown
 * stripes that follow its curve. up close there are hundreds of grass blades and flowers on
 * their own stems, and the wind moves through them in waves. the pointer steers the wind;
 * a click sends a gust.
 */
export const fields: PlaceMaker = (seed, W, H, night, hour) => {
  // one field in four lies under a golden tree instead
  if (isErdtree(seed)) return erdtree(seed, W, H, night, hour);
  const rand = mulberry32(seed);
  const time = pickTime(rand, night, hour);
  const tone = time.tone;
  const noise = makeNoise3(rand);
  const season = pick(rand, SEASONS);
  const meadow = pick(rand, MEADOWS);
  const MARGIN = 28;

  const horizon = Math.round(H * (0.26 + rand() * 0.08));
  const skyEdge = time.sky[time.sky.length - 1];
  const sky = bands(W, horizon + 4, time.sky);
  const clouds: Drifter[] = Array.from({ length: 2 + Math.floor(rand() * 3) }, (_, i) => {
    const w = Math.round(W * (0.14 + rand() * 0.18));
    const h = Math.round(H * (0.1 + rand() * 0.1));
    return {
      s: puffCloud(rand, w, h, puffTones(time.name), 0.1, skyEdge),
      x: (i / 3) * W + rand() * 40,
      y: horizon - h * (0.7 + rand() * 0.8),
      speed: 0.5 + rand() * 0.5,
      depth: 1,
    };
  });
  const stars = time.stars
    ? Array.from({ length: 70 }, () => ({ x: Math.floor(rand() * W), y: Math.floor(rand() * horizon * 0.9), p: rand() * 6.28 }))
    : [];

  // ---- the hills: one sprite per layer, far to near ----
  const nLayers = 5 + Math.floor(rand() * 3);
  type Layer = { s: Sprite; depth: number; crest: Float32Array };
  const layers: Layer[] = [];
  const pathLayer = 1 + Math.floor(rand() * (nLayers - 2));
  const lakeAt = rand() < 0.6 ? MARGIN + W * (0.2 + rand() * 0.6) : -1;
  for (let i = 0; i < nLayers; i++) {
    const t = i / (nLayers - 1);
    const s = sprite(W + MARGIN * 2, H);
    const crest = new Float32Array(s.w);
    const baseY = horizon + 2 + (H * 0.74 - horizon) * Math.pow(t, 1.25);
    const amp = H * (0.05 + t * 0.12) * (0.7 + rand() * 0.6);
    const f1 = 0.008 + rand() * 0.01;
    const f2 = f1 * (2 + rand());
    const ph1 = rand() * 6.28;
    const ph2 = rand() * 6.28;
    for (let x = 0; x < s.w; x++) {
      const hill = Math.sin(x * f1 + ph1) * 0.65 + Math.sin(x * f2 + ph2) * 0.35;
      crest[x] = baseY - amp * (0.5 + 0.5 * hill);
    }
    // distance hazes the far hills into the sky
    const haze = (1 - t) * 0.5;
    const pal = season.hill.map((col) => tone(mix(col, skyEdge, haze)));
    const thick = Math.max(4, H * (0.06 + t * 0.14));
    const stripe = 1.5 + t * 4;
    for (let x = 0; x < s.w; x++) {
      const top = Math.round(crest[x]);
      const slope = crest[Math.min(s.w - 1, x + 2)] - crest[Math.max(0, x - 2)];
      for (let y = Math.max(0, top); y < H; y++) {
        // lit along the crest, darker into the valley below; a slope turned from the light
        // pulls the darker bands up it, so the shading follows the hill instead of stepping
        const d = (y - top) / thick + slope * 0.35 + dith(x, y) * 0.05;
        const k = d < 0.1 ? 0 : d < 0.42 ? 1 : d < 0.8 ? 2 : d < 1.25 ? 3 : 4;
        // mown stripes that follow the curve of the hill
        const band = (Math.floor((y - crest[x]) / stripe + noise(x * 0.03, i, 1, 2) * 2) & 1) === 0;
        let col = pal[Math.min(4, k)];
        if (band && k > 0) col = mix(col, pal[k - 1], 0.45);
        // short strokes of grass
        const hsh = Math.sin(x * 12.9898 + y * 78.233 + i) * 43758.5453;
        const r = hsh - Math.floor(hsh);
        if (r < 0.05 * (0.5 + t)) col = pal[Math.max(0, k - 1)];
        else if (r > 0.97) col = pal[Math.min(4, k + 1)];
        s.px[y * s.w + x] = c(col);
      }
    }
    // flowers carry on into the distance: drifts of single pixels in the meadow's colours,
    // thinning and hazing as the hills go back
    if (i > 0) {
      const tints = meadow.map((m) => tone(mix(BLOOM_BASE[m], skyEdge, haze * 0.8)));
      for (let x = 0; x < s.w; x++) {
        for (let y = Math.max(0, Math.round(crest[x]) + 1); y < H; y++) {
          const drift = noise(x * 0.05 + i * 7, y * 0.12, 6, 2);
          const hsh = Math.sin(x * 91.7 + y * 47.3 + i * 13) * 43758.5453;
          const r = hsh - Math.floor(hsh);
          if (drift > 0.08 && r < (0.08 + t * 0.3) * (drift + 0.2)) s.px[y * s.w + x] = c(tints[Math.floor(r * 997) % tints.length]);
        }
      }
    }
    // a winding dirt path across one of the middle hills
    if (i === pathLayer) {
      const ph = rand() * 6;
      for (let x = 0; x < s.w; x++) {
        const y = Math.round(crest[x] + thick * (0.35 + Math.sin(x * 0.02 + ph) * 0.2));
        const w2 = Math.max(1, Math.round(1 + t * 2));
        for (let k = 0; k < w2; k++) {
          if (y + k < H) s.px[(y + k) * s.w + x] = c(tone(mix(k === 0 ? 0xdcb48a : 0xb88a5e, skyEdge, haze)));
        }
      }
    }
    // clumps of trees along some crests
    if (i > 0 && rand() < 0.75) {
      const tpal = season.tree.map((col) => tone(mix(col, skyEdge, haze)));
      for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) {
        const tx = MARGIN + rand() * W;
        const r0 = (1.5 + t * 4) * (0.8 + rand() * 0.6);
        const ty = crest[Math.round(tx)] + r0 * 0.6;
        for (let j = 0; j < 3 + Math.floor(rand() * 4); j++) {
          ball(s, tx + (rand() - 0.5) * r0 * 4, ty - rand() * r0, r0 * (0.6 + rand() * 0.5), tpal);
        }
      }
    }
    // a glimpse of a lake between the far hills
    if (i === 0 && lakeAt > 0) {
      const cy = crest[Math.round(lakeAt)];
      for (let y = Math.round(cy + 2); y < cy + 5; y++) {
        for (let x = Math.round(lakeAt) - 10; x < lakeAt + 10; x++) {
          if (x >= 0 && x < s.w && y < H && Math.abs(x - lakeAt) < 10 - (y - cy) * 1.5) {
            s.px[y * s.w + x] = c(tone(mix(0x8ac2e8, skyEdge, 0.3)));
          }
        }
      }
    }
    layers.push({ s, depth: 1.5 + t * t * 16, crest });
  }

  // ---- the foreground: a fence, a rock or two, and the meadow ----
  const near = layers[layers.length - 1];
  const hasFence = rand() < 0.55;
  const fenceY = H * (0.8 + rand() * 0.06);
  const posts: number[] = [];
  if (hasFence) for (let x = -MARGIN + rand() * 20; x < W + MARGIN; x += W * (0.18 + rand() * 0.06)) posts.push(x);
  const rocks = Array.from({ length: Math.floor(rand() * 3) }, () => ({ x: rand() * W, y: H * (0.78 + rand() * 0.18), r: 2 + rand() * 4 }));

  const plants: Plant[] = [];
  const meadowTop = (x: number) => near.crest[Math.min(near.s.w - 1, Math.max(0, Math.round(x + MARGIN)))] + 2;
  const spanX = () => -MARGIN + rand() * (W + MARGIN * 2);
  for (let k = 0; k < Math.round(W * 8); k++) {
    const x = spanX();
    const top = meadowTop(x);
    const y = top + Math.pow(rand(), 0.7) * (H - top);
    const nearness = (y - top) / (H - top);
    plants.push({ x, y, h: (2 + rand() * 4) * (0.6 + nearness * 1.6), kind: "blade", size: 1, shade: Math.floor(rand() * 3), p: rand() * 6.28, stiff: 0.7 + rand() * 0.6 });
  }
  for (let k = 0; k < Math.round(W * 2.8); k++) {
    const x = spanX();
    const top = meadowTop(x);
    // flowers grow in drifts
    if (noise(x * 0.04, 3, 4, 2) < -0.1 && rand() < 0.7) continue;
    const y = top + Math.pow(rand(), 0.6) * (H - top);
    const nearness = (y - top) / (H - top);
    plants.push({
      x,
      y,
      h: (3 + rand() * 5) * (0.6 + nearness * 1.5),
      kind: pick(rand, meadow),
      size: nearness > 0.7 ? 3 : nearness > 0.35 ? 2 : 1,
      shade: Math.floor(rand() * 3),
      p: rand() * 6.28,
      stiff: 0.6 + rand() * 0.6,
    });
  }
  plants.sort((a, b) => a.y - b.y);

  const bladeCols = [season.hill[1], season.hill[2], season.hill[3]].map((x) => c(tone(x)));
  const bladeLit = c(tone(mix(season.hill[0], 0xffffff, 0.35)));
  const stemCols = [0x4f9a3e, 0x3f8a3a, 0x5aa84a].map((x) => c(tone(x)));
  const BLOOM: Record<Bloom, number[]> = {
    daisy: [0xffffff, 0xeef0f4, 0xf6d23a],
    poppy: [0xe8402e, 0xff7a5a, 0x2a1a1a],
    cornflower: [0x3f7ad8, 0x7aa8f0, 0x23468a],
    buttercup: [0xf6d23a, 0xfff2a0, 0xd8a820],
    lavender: [0x9a7ad8, 0xc4a8f0, 0x6a4ea8],
    cosmos: [0xf08ab0, 0xffc4d8, 0xf6d23a],
  };
  const bloomCols = Object.fromEntries(Object.entries(BLOOM).map(([k, v]) => [k, v.map((x) => c(tone(x)))])) as Record<Bloom, number[]>;

  const drawBloom = (f: Frame, kind: Bloom, x: number, y: number, size: number, sway: number) => {
    const [a, b2, d] = bloomCols[kind];
    const X = Math.round(x);
    const Y = Math.round(y);
    if (kind === "lavender") {
      for (let k = 0; k < size + 2; k++) f.set(X + Math.round(sway * k * 0.15), Y - k, k === size + 1 ? b2 : k % 2 ? a : d);
      return;
    }
    if (size === 1) {
      f.set(X, Y, a);
      return;
    }
    if (kind === "poppy") {
      // a red cup, open toward the sky
      for (let k = -1; k <= 1; k++) f.set(X + k, Y, a);
      f.set(X - 1, Y - 1, a);
      f.set(X + 1, Y - 1, b2);
      f.set(X, Y - 1, d);
      if (size === 3) {
        f.set(X - 2, Y - 1, a);
        f.set(X + 2, Y - 1, a);
        f.set(X - 1, Y + 1, a);
        f.set(X + 1, Y + 1, a);
        f.set(X, Y + 1, a);
      }
      return;
    }
    // star-ish flowers: petals round a centre
    const centre = kind === "daisy" || kind === "cosmos" ? d : b2;
    f.set(X - 1, Y, a);
    f.set(X + 1, Y, a);
    f.set(X, Y - 1, a);
    f.set(X, Y + 1, a);
    if (size === 3) {
      f.set(X - 1, Y - 1, b2);
      f.set(X + 1, Y - 1, b2);
      f.set(X - 1, Y + 1, b2);
      f.set(X + 1, Y + 1, b2);
      f.set(X - 2, Y, a);
      f.set(X + 2, Y, a);
    }
    f.set(X, Y, centre);
  };

  const petals: { x: number; y: number; vx: number; vy: number; col: number; age: number }[] = [];
  // glints across the meadow: tiny, everywhere, catching the light by turns
  const GLINT = [0xfffbe8, 0xfffbe8, 0xfffbe8, 0xbff4ff, 0xffd6f0, 0xffe08a];
  const glints = Array.from({ length: time.lightsOn ? 50 : 140 }, () => {
    const y = horizon + 3 + rand() ** 0.8 * (H - horizon - 3);
    return { x: rand() * W, y, p: rand() * 6.28, sp: 1.2 + rand() * 2.4, col: c(GLINT[Math.floor(rand() * GLINT.length)]), near: (y - horizon) / (H - horizon) };
  });
  // and a few soft, out-of-focus orbs drifting close by
  const orbs = Array.from({ length: time.lightsOn ? 2 : 4 }, () => ({
    x: rand() * W,
    y: H * (0.72 + rand() * 0.26),
    r: 2 + rand() * 2.5,
    p: rand() * 6.28,
    col: c(GLINT[Math.floor(rand() * GLINT.length)]),
  }));
  const fireflies = time.lightsOn ? Array.from({ length: 16 }, () => ({ x: rand() * W, y: H * (0.5 + rand() * 0.45), p: rand() * 6.28 })) : [];
  let gust = 0;
  let clock = 0;
  // the wind is one signed number: which way and how hard. it eases toward where the pointer
  // asks, so it never snaps, and the gust waves ride a phase that only ever moves forward.
  let wind = 0.55;
  let phase = 0;

  // how hard a gust is pushing at x right now: waves of it travel across the field
  const windAt = (x: number, depth: number) => {
    const travel = x * 0.035 - phase - depth * 0.4;
    return Math.max(0, Math.sin(travel) * 0.6 + Math.sin(travel * 0.43 + 1.3) * 0.4) + 0.15;
  };

  return {
    bloom: { dawn: 0.3, day: 0.22, golden: 0.45, dusk: 0.6, night: 0.9 }[time.name],
    hour: time.name,
    draw(f: Frame, _t: number, dt: number, input) {
      clock += dt;
      if (input.clicks.length) {
        gust = 2.5;
        for (const click of input.clicks) {
          for (let k = 0; k < 24; k++) {
            const kind = pick(Math.random, meadow);
            petals.push({ x: click.x, y: click.y, vx: (wind < 0 ? -1 : 1) * (20 + Math.random() * 30), vy: -12 - Math.random() * 18, col: bloomCols[kind][0], age: 0 });
          }
        }
      }
      gust = Math.max(0, gust - dt);
      // a gentle breeze by default; the pointer leans it left or right and makes it stronger
      const target = 0.5 + input.lookX * 0.9;
      const strength = target + Math.sign(target || 1) * gust * 0.5;
      wind += (strength - wind) * Math.min(1, dt * 1.2);
      // the waves travel with the wind, faster when it's stronger, and never run backwards
      // in a jump: only their speed changes
      phase += dt * 1.8 * wind;
      const windDir = wind < 0 ? -1 : 1;
      const windPow = Math.abs(wind) + 0.15;
      const lx = input.lookX;

      f.buf.set(sky, 0);
      for (const s of stars) if (Math.sin(clock + s.p) > -0.2) f.set(s.x, s.y, c(0xd8e2ff));
      drawDrifters(f, clouds, clock, lx);

      // the hills, far to near, each sliding by its depth; a gust lightens the grass it passes
      const sheenTo = c(tone(mix(season.hill[0], 0xffffff, 0.3)));
      const ly = input.lookY;
      for (const L of layers) {
        const ox = Math.round(-MARGIN - lx * L.depth);
        const oy = Math.round(-ly * L.depth * 0.25);
        for (let y = 0; y < H; y++) {
          const syy = y - oy;
          if (syy < 0 || syy >= H) continue;
          const row = syy * L.s.w;
          for (let x = 0; x < W; x++) {
            const sx = x - ox;
            if (sx < 0 || sx >= L.s.w) continue;
            const v = L.s.px[row + sx];
            if (!v) continue;
            const w = windAt(sx, L.depth) * windPow;
            f.buf[y * W + x] = w > 0.62 + dith(x, y) * 0.12 ? mixPacked(v, sheenTo, Math.min(0.35, (w - 0.55) * 0.6)) : v;
          }
        }
      }

      // the fence: posts and two sagging wires
      if (hasFence) {
        const post = c(tone(0x8a6a4a));
        const postDark = c(tone(0x5e4632));
        const wire = c(tone(0x6a5a4a));
        const ox = -lx * 16;
        for (let i = 0; i < posts.length; i++) {
          const x = Math.round(posts[i] + ox);
          for (let y = Math.round(fenceY - 13); y < fenceY; y++) {
            f.set(x, y, post);
            f.set(x + 1, y, postDark);
          }
          if (i < posts.length - 1) {
            const x2 = Math.round(posts[i + 1] + ox);
            for (const hy of [9, 4]) {
              for (let xx = x + 2; xx < x2; xx++) {
                const u = (xx - x) / (x2 - x);
                f.set(xx, fenceY - hy + Math.sin(u * Math.PI) * 1.5, wire);
              }
            }
          }
        }
      }
      for (const r of rocks) {
        ball(f, r.x - lx * 16, r.y, r.r, [0xc8c4bc, 0xa8a49c, 0x86827a, 0x66625c].map(tone));
        ball(f, r.x - lx * 16 - r.r * 0.3, r.y - r.r * 0.5, r.r * 0.4, [0x9ac06a, 0x7aa04a, 0x5a8040].map(tone));
      }

      // the meadow: every blade and stem bends from its root, more toward the tip, as the
      // wave of wind passes; blades leaning hard turn their paler side to us
      for (const p of plants) {
        const w = windAt(p.x, 9) * wind;
        const flutter = Math.sin(clock * (p.kind === "blade" ? 5 : 3.2) + p.p) * 0.18;
        const bend = ((w + flutter) * p.h * 0.55) / p.stiff;
        // nearer plants (lower on screen) slide further than the ones at the back of the meadow
        const bx = p.x - lx * (10 + ((p.y - horizon) / (H - horizon)) * 8);
        let tx = bx;
        let ty = p.y;
        const stem = p.kind === "blade" ? (Math.abs(bend) > p.h * 0.32 ? bladeLit : bladeCols[p.shade]) : stemCols[p.shade];
        const steps = Math.ceil(p.h);
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          tx = bx + bend * t * t;
          ty = p.y - p.h * t * (1 - 0.18 * Math.min(1, Math.abs(bend) / p.h));
          f.set(tx, ty, stem);
        }
        if (p.kind !== "blade") drawBloom(f, p.kind, tx, ty - 1, p.size, bend);
      }

      // petals torn loose, riding the wind
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.age += dt;
        p.vx += wind * 30 * dt;
        p.vy += 14 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt + Math.sin(p.age * 9) * 0.3;
        if (p.age > 4 || p.x < -4 || p.x > W + 4 || p.y > H) {
          petals.splice(i, 1);
          continue;
        }
        f.set(p.x, p.y, p.col);
      }
      if (Math.random() < dt * 2.5 * windPow) {
        const kind = pick(Math.random, meadow);
        petals.push({ x: windDir > 0 ? -2 : W + 2, y: horizon + Math.random() * (H - horizon), vx: windDir * 25, vy: -4, col: bloomCols[kind][0], age: 0 });
      }

      // the meadow sparkles
      for (const g of glints) {
        const tw = Math.sin(clock * g.sp + g.p);
        if (tw < 0.55) continue;
        const k = (tw - 0.55) / 0.45;
        f.buf[Math.round(g.y) * W + Math.round(g.x)] = mixPacked(f.get(Math.round(g.x), Math.round(g.y)), g.col, 0.5 + k * 0.5);
        // the nearer ones flash into little stars at their brightest
        if (tw > 0.9 && g.near > 0.3) {
          const arm = g.near > 0.75 ? 2 : 1;
          for (let a = 1; a <= arm; a++)
            for (const [dx, dy] of [[a, 0], [-a, 0], [0, a], [0, -a]]) {
              const x = Math.round(g.x + dx);
              const y = Math.round(g.y + dy);
              if (x >= 0 && x < W && y >= 0 && y < H) f.buf[y * W + x] = mixPacked(f.buf[y * W + x], g.col, a === 1 ? 0.6 : 0.3);
            }
        }
      }
      for (const o of orbs) {
        o.x += Math.sin(clock * 0.3 + o.p) * dt * 2;
        o.y -= dt * 0.6;
        if (o.y < H * 0.7) o.y = H + o.r;
        const k = 0.12 + Math.sin(clock * 0.9 + o.p) * 0.05;
        for (let y = Math.floor(o.y - o.r); y <= Math.ceil(o.y + o.r); y++)
          for (let x = Math.floor(o.x - o.r); x <= Math.ceil(o.x + o.r); x++) {
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const d = Math.hypot(x + 0.5 - o.x, y + 0.5 - o.y) / o.r;
            if (d <= 1) f.buf[y * W + x] = mixPacked(f.buf[y * W + x], o.col, d > 0.7 ? k * 1.6 : k);
          }
      }

      for (const fl of fireflies) {
        fl.x += Math.sin(clock * 0.7 + fl.p) * dt * 5;
        fl.y += Math.cos(clock * 0.5 + fl.p) * dt * 3;
        if (Math.sin(clock * 2 + fl.p) > 0.2) f.set(fl.x, fl.y, c(0xfff3a0));
      }
    },
  };
};
