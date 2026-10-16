import { drawDrifters, type Drifter } from "./clouds";
import { puffCloud, puffTones } from "./puffs";
import { ball, bands, blit, c, dith, mix, mixPacked, mulberry32, sprite, type Frame, type Sprite } from "./frame";
import type { Place, PlaceMaker } from "./scene";
import { pick, pickTime } from "./time";
import { makeNoise3 } from "./world";

/**
 * a stretch of coast. the number decides almost everything: the hour, which side the land is
 * on, whether it's a grassy hill, a beach or a pier, what stands on it, what's out at sea and
 * what the sky is doing. the nearer something is, the more it moves when you look around.
 * click the water for ripples; click the sky to see the same coast at the other end of the day.
 */
export const seaside: PlaceMaker = (seed, W, H, night, hour) => {
  const rand = mulberry32(seed);
  const time = pickTime(rand, night, hour);
  const tone = time.tone;
  const horizon = Math.round(H * (0.56 + rand() * 0.12));
  const seaRows = H - horizon;
  const MARGIN = 10;
  const flipped = rand() < 0.5;
  const shore = pick(rand, ["hill", "hill", "beach", "pier"] as const);
  const landmark =
    shore === "hill"
      ? pick(rand, ["pole", "lighthouse", "tree", "pole"] as const)
      : shore === "pier"
        ? "lamps"
        : pick(rand, ["hut", "none"] as const);
  const offshore = pick(rand, ["island", "boats", "mountains", "island", "none"] as const);
  const skyKindRoll = pick(rand, ["towers", "towers", "scattered", "streaks", "clear"] as const);
  // mountains always get a proper sky of cloud to stand under
  const skyKind = offshore === "mountains" ? (skyKindRoll === "towers" ? "towers" : "scattered") : skyKindRoll;

  // where the sun or moon sits; decided up front because the lighthouse is lit from it
  const orbX = W * (flipped ? 0.6 + rand() * 0.3 : 0.1 + rand() * 0.3);
  const sky = bands(W, horizon, time.sky);
  const sea = bands(W, seaRows, time.sea);
  sea.fill(c(time.seam), 0, W);

  // ---- clouds, by kind ----
  const skyEdge = time.sky[time.sky.length - 1];
  const far: Drifter[] = [];
  const big: Drifter[] = [];
  {
    // even a clear day keeps a low bank of cloud sitting on the horizon
    const n = skyKind === "scattered" ? 8 : skyKind === "clear" ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const w = Math.round(W * (0.14 + rand() * 0.14));
      const h = Math.round(H * (0.1 + rand() * 0.07));
      far.push({
        s: puffCloud(rand, w, h, puffTones(time.name), 0.35, skyEdge),
        x: (i / n) * (W + w) + rand() * 20,
        y: skyKind === "scattered" ? horizon * (0.15 + rand() * 0.6) : horizon - h * 0.86,
        speed: 0.5 + rand() * 0.4,
        depth: 1,
      });
    }
  }
  if (skyKind === "towers") {
    for (let i = 0; i < 2; i++) {
      const w = Math.round(W * (0.55 + rand() * 0.25));
      const h = Math.round(H * (0.58 + rand() * 0.18));
      big.push({
        s: puffCloud(rand, w, h, puffTones(time.name)),
        x: (i / 2) * (W + w) + rand() * 30,
        y: Math.max(-h * 0.12, horizon - h * (0.92 + rand() * 0.12)),
        speed: 0.8 + rand() * 0.6,
        depth: 3,
      });
    }
  }
  // low cloud drifting across the face of the mountains
  const low: Drifter[] = [];
  if (offshore === "mountains")
    for (let i = 0; i < 3; i++) {
      const w = Math.round(W * (0.12 + rand() * 0.1));
      const h = Math.round(H * (0.08 + rand() * 0.05));
      low.push({ s: puffCloud(rand, w, h, puffTones(time.name), 0.15, skyEdge), x: rand() * W, y: horizon - H * (0.12 + rand() * 0.16), speed: 0.9 + rand() * 0.5, depth: 2 });
    }
  // long flat streaks of high cloud, the kind you get before the weather turns
  const streaks: Drifter[] = [];
  if (skyKind === "streaks") {
    for (let i = 0; i < 6; i++) {
      const w = Math.round(W * (0.3 + rand() * 0.4));
      const h = 3 + Math.floor(rand() * 3);
      const s = sprite(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const edge = Math.min(x, w - 1 - x) / (w * 0.5);
          const rim = y === 0 || y === h - 1 ? 0.25 : 0;
          if (edge + dith(x, y) * 0.6 > 0.25 + rim) {
            s.px[y * w + x] = c(y === 0 ? time.cloud[0] : y === h - 1 ? time.cloud[3] : time.cloud[1]);
          }
        }
      }
      streaks.push({ s, x: rand() * W, y: horizon * (0.1 + rand() * 0.7), speed: 1 + rand(), depth: 2 });
    }
  }

  // ---- out at sea ----
  const farLayer = sprite(W + MARGIN * 2, horizon + 1);
  if (offshore === "island") {
    const w = Math.round(W * (0.2 + rand() * 0.2));
    const x0 = Math.round(MARGIN + W * (flipped ? 0.5 + rand() * 0.2 : 0.04 + rand() * 0.2));
    const height = 4 + rand() * 5;
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const top = Math.round(
        horizon - Math.sin(t * Math.PI) ** 0.6 * (height + Math.sin(x * 0.9) * 0.8 + Math.sin(x * 0.37) * 1.2),
      );
      for (let y = Math.max(0, top); y <= horizon; y++) {
        farLayer.px[y * farLayer.w + x0 + x] = c(tone(y === top ? 0x5c9b5c : 0x3f7c4b));
      }
    }
  } else if (offshore === "mountains") {
    // two ranges. each ridge is jagged, with peaks and sub-peaks; down each face run ridges and
    // gullies, lit on the side toward the sun and shaded on the other; snow lies in the high
    // gullies with a ragged edge; the far range is hazed into the sky, the near one darker,
    // with a fringe of forest at its foot and mist where it meets the water
    const noise = makeNoise3(rand);
    const sunLeft = orbX < W / 2;
    const ranges = [
      { amp: 0.44, haze: 0.48, base: 0x6a7ca4, snow: true },
      { amp: 0.22, haze: 0.16, base: 0x3a5a5e, snow: false },
    ];
    for (const [ri, r] of ranges.entries()) {
      const ph = rand() * 100;
      // peaks with lopsided flanks, one steep and one long, then shoulders and notches from
      // noise at a few scales, so no two ridges come out alike
      const peaks = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({
        x: rand() * farLayer.w,
        h: 0.45 + rand() * 0.55,
        wl: farLayer.w * (0.07 + rand() * 0.16),
        wr: farLayer.w * (0.07 + rand() * 0.16),
        k: 0.8 + rand() * 0.8,
      }));
      const ridge = new Float32Array(farLayer.w);
      for (let x = 0; x < farLayer.w; x++) {
        let hh = 0;
        for (const pk of peaks) {
          const d = (x - pk.x) / (x < pk.x ? pk.wl : pk.wr);
          hh = Math.max(hh, pk.h * Math.max(0, 1 - Math.abs(d)) ** pk.k);
        }
        hh += noise(x * 0.012 + ph, ri, 1, 3) * 0.22;
        hh += (1 - Math.abs(noise(x * 0.06 + ph, ri + 3, 1, 2))) * 0.08 - 0.05;
        ridge[x] = Math.max(0, hh);
      }
      // greens for the slopes below the tree line, lit to shaded
      const greens = (ri === 0 ? [0x2a4a3e, 0x3a5e44, 0x4e7448, 0x6a8a52] : [0x1e3e2c, 0x2a5232, 0x3a6a38, 0x5a8a44]).map((g) => tone(mix(g, skyEdge, r.haze * 0.9)));
      const tone4 = (k: number) => tone(mix(mix(r.base, k > 0 ? 0xfff0d8 : 0x16203e, Math.abs(k)), skyEdge, r.haze));
      const cols = [tone4(-0.55), tone4(-0.3), tone4(0), tone4(0.3)];
      const snowLit = tone(mix(0xf8faff, skyEdge, r.haze * 0.5));
      const snowShade = tone(mix(0xb8c4e0, skyEdge, r.haze * 0.5));
      const pxH = H * r.amp;
      for (let x = 1; x < farLayer.w - 1; x++) {
        const top = Math.round(horizon - ridge[x] * pxH - 1);
        for (let y = Math.max(0, top); y <= horizon; y++) {
          const down = (y - top) / Math.max(1, pxH);
          // a height across the face: the crest, falling away, scored by ridges and gullies
          // that run down the slope
          const gully = noise(x * 0.09 + ph, y * 0.025, 4 + ri, 2);
          const h0 = (xx: number) => ridge[xx] - down * 0.9 + noise(xx * 0.09 + ph, y * 0.025, 4 + ri, 2) * 0.18;
          const grad = h0(Math.min(farLayer.w - 1, x + 1)) - h0(Math.max(0, x - 1));
          const toward = (sunLeft ? -grad : grad) * 40 + dith(x, y) * 0.4;
          let tone = toward > 0.6 ? 3 : toward > 0 ? 2 : toward > -0.6 ? 1 : 0;
          // the foot of the range sinks into shadow
          if (down > 0.55 + gully * 0.2) tone = Math.max(0, tone - 1);
          let col = cols[tone];
          // below the tree line, the slopes are green and forested
          const alt = (horizon - y) / Math.max(1, pxH);
          const treeLine = (ri === 0 ? 0.42 : 0.9) + gully * 0.25 + noise(x * 0.05, 7, ri, 1) * 0.12;
          if (alt < treeLine) {
            const crowns = noise(x * 0.5, y * 0.6, 11 + ri, 1) > 0.15 ? 1 : 0;
            col = greens[Math.max(0, Math.min(3, tone - crowns + (alt > treeLine - 0.05 ? -1 : 0)))];
          }
          // snow: high up, reaching further down the gullies, with a ragged lower edge
          if (r.snow && ridge[x] > 0.5) {
            const line = (ridge[x] - 0.5) * 0.9 + gully * 0.12 + dith(x, y) * 0.04;
            if (down < line) col = tone >= 2 ? snowLit : snowShade;
          }
          farLayer.px[y * farLayer.w + x] = c(col);
        }
        // the near range wears a fringe of forest at its foot
        if (ri === 1) {
          const treeTop = horizon - 2 - Math.round((1 - Math.abs(noise(x * 0.4, 9, 3, 1))) * 3);
          for (let y = Math.max(0, treeTop); y <= horizon; y++) farLayer.px[y * farLayer.w + x] = c(tone(y === treeTop ? 0x3a6a3e : 0x234a32));
        }
      }
    }
    // mist lying along the water's edge
    for (let y = horizon - 3; y <= horizon; y++)
      for (let x = 0; x < farLayer.w; x++) {
        const i = y * farLayer.w + x;
        if (farLayer.px[i] && dith(x, y) + (y - horizon + 3) * 0.15 > 0.1) farLayer.px[i] = mixPacked(farLayer.px[i], c(skyEdge), 0.35);
      }
  }

  const boats =
    offshore === "boats" || (offshore === "mountains" && rand() < 0.7)
      ? Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({
          x: rand() * W,
          y: horizon + 2 + rand() * seaRows * 0.35,
          size: 3 + Math.floor(rand() * 3),
          speed: (rand() < 0.5 ? -1 : 1) * (0.6 + rand()),
          sail: pick(rand, [0xffffff, 0xf3e3c3, 0xe2584a, 0xf0c64a]),
          p: rand() * 6,
        }))
      : [];

  // ---- the shore, drawn as if the land is on the right, then mirrored when it isn't ----
  const fg = sprite(W + MARGIN * 2, H);
  const put = (s: Sprite, x: number, y: number, rgb: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.px[y * s.w + x] = c(rgb);
  };
  const grass = [0xb6e86a, 0x96d64e, 0x7cc64a, 0x66b441, 0x52a03a].map(tone);
  const bushes = [0x6db55a, 0x4a9a48, 0x34793a, 0x255d2f].map(tone);
  let landTop = (x: number) => H + 0 * x;
  let lampsAt: { x: number; y: number }[] = [];
  let beam: { x: number; y: number } | null = null;
  let surfY = 0;

  if (shore === "hill") {
    const peak = H * (0.62 + rand() * 0.12);
    const start = 0.3 + rand() * 0.15;
    landTop = (x) => {
      const t = Math.min(Math.max((x / fg.w - start) / (1 - start), 0), 1);
      const e = t * t * (3 - 2 * t);
      return Math.round(H - (H - peak) * e - Math.sin(x * 0.21) * 0.8);
    };
    for (let x = 0; x < fg.w; x++) {
      const top = landTop(x);
      for (let y = top; y < H; y++) {
        const depth = (y - top) / Math.max(H - top, 1);
        let k = y === top ? 0 : depth < 0.25 ? 1 : depth < 0.6 ? 2 : 3;
        if (Math.sin(x * 1.7 + y * 0.9) * Math.cos(x * 0.6 - y * 1.3) + dith(x, y) * 0.6 > 0.62) k = Math.min(4, k + 1);
        fg.px[y * fg.w + x] = c(grass[k]);
      }
      if (top < H && rand() < 0.35) put(fg, x, top - 1, grass[2]);
    }
    for (let i = 0; i < 2 + Math.floor(rand() * 4); i++) {
      const bx = fg.w * (start + 0.25 + rand() * (0.7 - start));
      const r = 3 + rand() * 3;
      ball(fg, bx, landTop(Math.round(bx)) - r * 0.35, r, bushes);
    }
    // sand and scrub in the near corner
    for (let x = 0; x < fg.w * 0.2; x++) {
      const top = Math.round(H - 4 + (x / (fg.w * 0.2)) * 4);
      for (let y = Math.max(top, horizon + 2); y < H; y++) put(fg, x, y, tone(dith(x, y) > 0.3 ? 0xe3c98d : 0xf1dda5));
    }
  } else if (shore === "beach") {
    surfY = Math.round(H - seaRows * (0.32 + rand() * 0.15));
    landTop = (x) => Math.round(surfY + Math.sin(x * 0.05) * 1.5);
    for (let x = 0; x < fg.w; x++) {
      for (let y = landTop(x) + 2; y < H; y++) {
        const wet = y - landTop(x) < 4;
        const sand = wet
          ? dith(x, y) > 0
            ? 0xc9ad7a
            : 0xd7bc87
          : (x * 7 + y * 13) % 23 === 0
            ? 0xcdb27c
            : dith(x, y) > 0.35
              ? 0xe8cf98
              : 0xf2dca7;
        put(fg, x, y, tone(sand));
      }
    }
    // dune grass along the back of the beach, on the land side
    for (let x = Math.round(fg.w * 0.7); x < fg.w; x++) {
      const h = Math.round(4 + Math.sin(x * 0.3) * 2 + rand() * 2);
      for (let y = 0; y < h; y++) if ((x + y) % 2 === 0 || y < 2) put(fg, x, H - 1 - y, grass[y < 2 ? 3 : 1]);
    }
  } else {
    // a wooden pier on posts, running out from the near shore
    const deckY = Math.round(horizon + seaRows * (0.3 + rand() * 0.2));
    const from = Math.round(fg.w * (0.35 + rand() * 0.2));
    for (let x = from; x < fg.w; x++) {
      put(fg, x, deckY, tone(0xb98a5a));
      put(fg, x, deckY + 1, tone(0x8a5f3c));
      put(fg, x, deckY - 3, tone(0x7a5236));
      if ((x - from) % 12 === 0) {
        for (let y = deckY - 3; y < deckY; y++) put(fg, x, y, tone(0x7a5236));
        for (let y = deckY + 2; y < Math.min(H, deckY + 8); y++) put(fg, x, y, tone(0x5a3c28));
      }
    }
    for (let x = fg.w - 14; x < fg.w; x++) for (let y = deckY - 1; y < H; y++) put(fg, x, y, grass[y === deckY - 1 ? 0 : 3]);
    lampsAt = Array.from({ length: 3 }, (_, i) => ({
      x: from + 6 + i * Math.round((fg.w - from - 20) / 3),
      y: deckY - 10,
    }));
    for (const l of lampsAt) {
      for (let y = l.y; y < deckY; y++) put(fg, l.x, y, tone(0x2b2f42));
      put(fg, l.x - 1, l.y - 1, tone(0x2b2f42));
      put(fg, l.x + 1, l.y - 1, tone(0x2b2f42));
    }
  }

  const foot = (x: number) => landTop(Math.round(x)) + 1;
  if (landmark === "pole") {
    const poleX = Math.round(fg.w * (0.8 + rand() * 0.06));
    const poleTop = Math.round(H * 0.05);
    const steel = [0xb1b8c8, 0x8a93a6, 0x687187].map(tone);
    for (let y = poleTop; y < foot(poleX) + 1; y++) for (let k = 0; k < 3; k++) put(fg, poleX + k, y, steel[k]);
    const arms = [poleTop + 4, poleTop + 10];
    arms.forEach((ay, i) => {
      for (let x = poleX - 7; x <= poleX + 9; x++) {
        put(fg, x, ay, steel[0]);
        put(fg, x, ay + 1, steel[2]);
      }
      put(fg, poleX - 6, ay - 1, tone(0xdfe5ee));
      put(fg, poleX + 8, ay - 1, tone(0xdfe5ee));
      // the wire sags away toward the far edge
      const x0 = poleX - 6;
      const y1 = ay + H * (0.12 + i * 0.1);
      for (let x = x0; x >= 0; x--) {
        const t = (x0 - x) / x0;
        const y = Math.round(ay + (y1 - ay) * t + Math.sin(t * Math.PI) * H * 0.035);
        if (y >= 0 && y < H && !fg.px[y * fg.w + x]) put(fg, x, y, tone(0x2a3f6e));
      }
    });
  } else if (landmark === "lighthouse") {
    const lx = Math.round(fg.w * (0.8 + rand() * 0.08));
    const base = foot(lx);
    const height = Math.round(H * 0.42);
    const stripe = pick(rand, [0xd8433a, 0x2f5fa8, 0x2e8a57]);
    // which side the light comes from, in this sprite's own (unmirrored) coordinates
    const finalX = flipped ? fg.w - lx - MARGIN : lx - MARGIN;
    const fromLeft = (orbX < finalX) !== flipped;
    const cyl = (x: number, half: number, yy: number) => {
      // shade the tower as a cylinder: lit side, face, turning away, shadow
      const n = (x / Math.max(half, 1)) * (fromLeft ? 1 : -1);
      const lum = -n * 0.9 + 0.15 + dith(x, yy) * 0.25;
      return lum > 0.55 ? 0 : lum > 0 ? 1 : lum > -0.5 ? 2 : 3;
    };
    const white = [0xffffff, 0xeef0f4, 0xc9ccd6, 0x9aa0b0];
    const band = [mix(stripe, 0xffffff, 0.25), stripe, mix(stripe, 0x000000, 0.25), mix(stripe, 0x000000, 0.45)];
    for (let y = base - height; y < base; y++) {
      const t = (y - (base - height)) / height;
      const half = Math.round(2 + t * 2.5);
      const striped = Math.floor((y - (base - height)) / 5) % 2 === 0;
      for (let x = -half; x <= half; x++) put(fg, lx + x, y, tone((striped ? band : white)[cyl(x, half, y)]));
    }
    const top = base - height;
    // the gallery: a dark railing round the lantern room
    for (let x = -4; x <= 4; x++) put(fg, lx + x, top - 1, tone(0x2b2f42));
    for (let x = -4; x <= 4; x += 2) put(fg, lx + x, top - 2, tone(0x2b2f42));
    // the lantern room, glazed, with mullions; lit at night
    for (let y = top - 6; y < top - 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const mullion = x === 0 || x === (fromLeft ? 2 : -2);
        put(fg, lx + x, y, mullion ? tone(0x2b2f42) : time.lightsOn ? 0xfff3c4 : tone(cyl(x, 2, y) < 2 ? 0xbfe0f6 : 0x86b0d8));
      }
    }
    // a domed cap
    for (let x = -3; x <= 3; x++) put(fg, lx + x, top - 7, tone(mix(stripe, 0x000000, 0.2)));
    for (let x = -2; x <= 2; x++) put(fg, lx + x, top - 8, tone(stripe));
    put(fg, lx, top - 9, tone(0x2b2f42));
    put(fg, lx, top - 10, tone(0x2b2f42));
    if (time.lightsOn) beam = { x: lx, y: top - 4 };
  } else if (landmark === "tree") {
    const tx = Math.round(fg.w * (0.72 + rand() * 0.15));
    const base = foot(tx);
    const trunkH = Math.round(H * (0.14 + rand() * 0.1));
    for (let y = base - trunkH; y < base; y++) {
      put(fg, tx, y, tone(0x6b4a33));
      put(fg, tx + 1, y, tone(0x4a3224));
    }
    const crown = base - trunkH;
    for (let i = 0; i < 7; i++) ball(fg, tx + (rand() - 0.5) * 16, crown - rand() * 10, 4 + rand() * 4, bushes);
  } else if (landmark === "hut") {
    const hx = Math.round(fg.w * (0.75 + rand() * 0.1));
    const base = foot(hx) + 2;
    const col = pick(rand, [0x4f86c6, 0xe0654f, 0x5fb08a, 0xf2c14e]);
    for (let y = base - 10; y < base; y++) for (let x = 0; x < 12; x++) put(fg, hx + x, y, tone(x % 3 === 0 ? mix(col, 0x000000, 0.2) : col));
    for (let k = 0; k < 8; k++) for (let x = -1 + k; x <= 12 - k; x++) put(fg, hx + x, base - 10 - k * 0.6, tone(0x8a4e3a));
    for (let y = base - 7; y < base; y++) for (let x = 4; x < 8; x++) put(fg, hx + x, y, time.lightsOn ? 0xf6b24a : tone(0x3a2a2a));
  }

  if (flipped) {
    const out = new Uint32Array(fg.px.length);
    for (let y = 0; y < fg.h; y++) for (let x = 0; x < fg.w; x++) out[y * fg.w + x] = fg.px[y * fg.w + (fg.w - 1 - x)];
    fg.px = out;
    lampsAt = lampsAt.map((l) => ({ x: fg.w - 1 - l.x, y: l.y }));
    if (beam) beam = { x: fg.w - 1 - beam.x, y: beam.y };
  }

  const stars = time.stars
    ? Array.from({ length: Math.round((W * horizon) / (time.name === "night" ? 60 : 160)) }, () => ({
        x: Math.floor(rand() * W),
        y: Math.floor(rand() * horizon * 0.8),
        p: rand() * 6.28,
      }))
    : [];
  const orb = {
    x: orbX,
    y: time.sun ? horizon - H * time.sun.height - 4 : H * (0.12 + rand() * 0.1),
  };
  // on a plain day the sun is high, just out of frame in a top corner, and only its rays show
  const highSun = time.name === "day" ? { x: flipped ? W * 0.06 : W * 0.94, y: -H * 0.12 } : null;
  // a few broad shafts of light, not spokes: each a soft wedge that fades with distance
  const beams = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({
    off: (rand() - 0.5) * 1.6,
    width: 0.06 + rand() * 0.1,
    strength: 0.5 + rand() * 0.5,
    p: rand() * 6.28,
  }));

  const rays = (f: Frame, sx: number, sy: number, col: number, maxMix: number, reach: number) => {
    const packed = c(col);
    // the fan points from the sun into the frame
    const aim = Math.atan2(horizon * 0.7 - sy, W / 2 - sx);
    const glowR = reach * 0.35;
    for (let y = 0; y < horizon; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - sx;
        const dy = y - sy;
        const dist = Math.hypot(dx, dy);
        if (dist > reach) continue;
        const a = Math.atan2(dy, dx);
        let light = 0;
        for (const b2 of beams) {
          let d = a - (aim + b2.off);
          d = Math.atan2(Math.sin(d), Math.cos(d)) / b2.width;
          light += Math.exp(-d * d) * b2.strength * (0.8 + Math.sin(clock * 0.25 + b2.p) * 0.2);
        }
        light *= (1 - dist / reach) ** 1.6;
        light += Math.max(0, 1 - dist / glowR) ** 2;
        const step = Math.floor(Math.min(1, light) * 3 + dith(x, y) * 0.8) / 3;
        if (step > 0) f.buf[y * W + x] = mixPacked(f.buf[y * W + x], packed, step * maxMix);
      }
    }
  };

  const orbR = time.sun ? 5 + Math.round(rand() * 4) : 4;
  const sparkles = Array.from({ length: Math.round(W / 6) }, () => ({
    x: Math.floor(rand() * W),
    y: horizon + 2 + Math.floor(rand() ** 1.6 * (seaRows - 3)),
    len: 1 + Math.floor(rand() * 3),
    p: rand() * 6.28,
  }));
  const birdRate = pick(rand, [6, 12, 20, 999]);

  // now and then, at night, a star falls
  const meteors: { x: number; y: number; vx: number; vy: number; age: number }[] = [];
  let nextMeteor = 1.5 + rand() * 3;

  type Bird = { x: number; y: number; p: number; dir: number };
  let birds: Bird[] = [];
  let nextFlock = 2 + rand() * 4;
  const ripples: { x: number; y: number; age: number }[] = [];
  let clock = 0;
  let rush = 0;

  const flock = (y = H * (0.15 + Math.random() * 0.3)) => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    birds = Array.from({ length: 2 + Math.floor(Math.random() * 4) }, (_, i) => ({
      x: dir > 0 ? -6 - i * (4 + Math.random() * 4) : W + 6 + i * (4 + Math.random() * 4),
      y: y + (Math.random() - 0.5) * 6,
      p: Math.random() * 6,
      dir,
    }));
  };

  const place: Place = {
    bloom: { dawn: 0.2, day: 0, golden: 0.4, dusk: 0.75, night: 1 }[time.name],
    hour: time.name,
    draw(f: Frame, _t: number, dt: number, input) {
      for (const click of input.clicks) {
        if (click.y > horizon + 1) ripples.push({ ...click, age: 0 });
        else {
          // a click in the sky asks to see this same place at the other end of the day
          place.flip = true;
        }
      }
      const speed = rush > 0 ? 1 + Math.min(rush, 1.5) * 9 : 1;
      rush = Math.max(0, rush - dt);
      clock += dt * speed;
      const lx = input.lookX;
      // looking up or down: the shore holds still and the sky slides the other way, the nearer
      // clouds a little more than the far ones
      const ly = -input.lookY * 1.6;

      f.buf.set(sky, 0);
      for (const s of stars) {
        if (Math.sin(clock * 1.4 + s.p) > -0.3) f.set(s.x, s.y, c(Math.sin(clock + s.p) > 0.7 ? 0xe6eeff : 0x8090c0));
      }
      if (time.sun) {
        // a low sun, haloed in dithered rings
        const sun = time.sun;
        for (let y = -orbR * 3; y <= orbR * 3; y++) {
          for (let x = -orbR * 3; x <= orbR * 3; x++) {
            const d = Math.hypot(x, y) / orbR;
            const px = Math.round(orb.x - lx + x);
            const py = Math.round(orb.y + ly + y);
            if (py >= horizon || px < 0 || px >= W || py < 0) continue;
            if (d <= 1) f.set(px, py, c(sun.color));
            else if (d < 3 && (3 - d) / 2 + dith(px, py) * 0.6 > 0.55) {
              f.buf[py * W + px] = mixPacked(f.buf[py * W + px], c(sun.glow), 0.35);
            }
          }
        }
      }
      if (time.moon) {
        // a soft halo, then the moon itself
        for (let y = -orbR * 4; y <= orbR * 4; y++) {
          for (let x = -orbR * 4; x <= orbR * 4; x++) {
            const d = Math.hypot(x, y) / orbR;
            const px = Math.round(orb.x - lx + x);
            const py = Math.round(orb.y + ly + y);
            if (d < 1 || d > 4 || px < 0 || px >= W || py < 0 || py >= horizon) continue;
            if ((4 - d) / 3 + dith(px, py) * 0.5 > 0.6) f.buf[py * W + px] = mixPacked(f.buf[py * W + px], c(0x8a98c8), 0.25);
          }
        }
        ball(f, orb.x - lx, orb.y + ly, orbR, [0xfbf8ea, 0xece6cc, 0xcfc8a8, 0xb0a88c]);
      }
      if (time.name === "night") {
        nextMeteor -= dt;
        if (nextMeteor <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          meteors.push({ x: W * (0.15 + Math.random() * 0.7), y: horizon * Math.random() * 0.35, vx: dir * (90 + Math.random() * 60), vy: 40 + Math.random() * 30, age: 0 });
          nextMeteor = 2.5 + Math.random() * 5;
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.age += dt;
          if (m.age > 0.7) {
            meteors.splice(i, 1);
            continue;
          }
          const fade = 1 - m.age / 0.7;
          for (let k = 0; k < 10; k++) {
            const x = m.x + m.vx * (m.age - k * 0.012);
            const y = m.y + m.vy * (m.age - k * 0.012);
            if (y >= horizon || y < 0 || x < 0 || x >= W) continue;
            const amount = fade * (1 - k / 10);
            f.buf[Math.round(y) * W + Math.round(x)] = mixPacked(f.get(Math.round(x), Math.round(y)), c(0xffffff), Math.min(1, amount * 1.2));
          }
        }
      }

      // light first, so clouds and land stand in front of it
      if (time.sun) rays(f, orb.x - lx, orb.y + ly, time.sun.glow, 0.3, W * 0.9);
      else if (highSun) rays(f, highSun.x - lx, highSun.y, 0xfff6dc, 0.22, W * 0.8);
      for (const s of streaks) blit(f, s.s, ((s.x + clock * s.speed) % (W + s.s.w)) - s.s.w - lx * s.depth, s.y);
      drawDrifters(f, far, clock, lx, ly);
      // big clouds stand in front of islands, but behind mountains
      if (offshore === "mountains") drawDrifters(f, big, clock, lx, ly);
      blit(f, farLayer, -MARGIN - lx * 2, 0);
      if (offshore !== "mountains") drawDrifters(f, big, clock, lx, ly);
      drawDrifters(f, low, clock, lx, ly * 0.5);

      f.buf.set(sea, horizon * W);
      // the mountains, given back by the water: darker, and broken up by the swell
      if (offshore === "mountains") {
        const span = Math.round(H * 0.28);
        for (let k = 1; k < span && horizon + k < H; k++) {
          if ((k + Math.floor(clock * 2)) % 4 === 0) continue;
          const sy = horizon - k;
          if (sy < 0) break;
          const wob = Math.round(Math.sin(k * 0.8 + clock * 1.5) * (k * 0.06));
          for (let x = 0; x < W; x++) {
            const sx = x + MARGIN + Math.round(lx * 2) + wob;
            if (sx < 0 || sx >= farLayer.w) continue;
            const v = farLayer.px[sy * farLayer.w + sx];
            if (v) f.buf[(horizon + k) * W + x] = mixPacked(f.buf[(horizon + k) * W + x], v, 0.45 * (1 - k / span));
          }
        }
      }
      if (time.name === "night") {
        // the stars, faint and shaken, in the water
        for (const st of stars) {
          const ry = horizon + Math.round((horizon - st.y) * 0.5);
          if (ry >= H || Math.sin(clock * 2 + st.p) < 0.3) continue;
          f.set(st.x + Math.round(Math.sin(clock * 3 + ry) * 0.8) - lx * 2, ry, c(0x4c5f94));
        }
      }
      for (const s of sparkles) {
        if (Math.sin(clock * 2.2 + s.p) > 0.35) {
          for (let k = 0; k < s.len; k++) f.set((((s.x + k - lx * 2) % W) + W) % W, s.y, c(time.glint));
        }
      }
      if (time.sun || time.moon) {
        // its path across the water. a soft column of reflected light, and on top of it the
        // glints: they sit on the wave rows and drift with the swell, packed tight near the
        // horizon and spreading out as the water comes toward us
        const core = c(time.sun ? mix(time.sun.color, 0xffffff, 0.3) : 0xe6ebff);
        const bright = c(time.sun ? time.sun.color : 0xc9d0ea);
        const dim = c(time.sun ? time.sun.glow : 0x7d88b8);
        const cx = orb.x - lx * 2;
        for (let y = horizon + 1; y < H; y++) {
          const t = (y - horizon) / seaRows;
          const half = 1.5 + t * (time.sun ? W * 0.1 : W * 0.06);
          for (let x = Math.round(cx - half * 1.5); x <= cx + half * 1.5; x++) {
            if (x < 0 || x >= W) continue;
            const e = 1 - Math.abs(x - cx) / (half * 1.5);
            if (e + dith(x, y) * 0.45 > 0.5) f.buf[y * W + x] = mixPacked(f.buf[y * W + x], dim, 0.14 + e * 0.18);
          }
          if ((y - horizon) % 2 === 1) continue;
          const freq = 0.9 / (0.35 + t * 1.4);
          for (let x = Math.round(cx - half); x <= cx + half; x++) {
            if (x < 0 || x >= W) continue;
            const env = 1 - Math.abs(x - cx) / half;
            const wave = Math.sin(x * freq + clock * 2.2 + y * 1.9) * 0.6 + Math.sin(x * freq * 0.37 - clock * 1.3 + y * 0.7) * 0.4;
            if (wave > 1 - env * 0.95) f.buf[y * W + x] = env > 0.7 ? core : env > 0.35 ? bright : dim;
          }
        }
      }

      for (const b of boats) {
        b.x = (((b.x + b.speed * dt * speed) % (W + 20)) + W + 20) % (W + 20);
        const x = Math.round(b.x - 10 - lx * 2);
        const y = Math.round(b.y + Math.sin(clock * 1.5 + b.p) * 0.6);
        for (let k = -b.size; k <= b.size; k++) f.set(x + k, y, c(tone(0x6b3a2a)));
        for (let k = -b.size + 1; k < b.size; k++) f.set(x + k, y + 1, c(tone(0x4a2a20)));
        for (let k = 1; k <= b.size * 2; k++) {
          for (let j = 0; j <= Math.floor(k / 2); j++) f.set(x + j * Math.sign(b.speed), y - k, c(tone(b.sail)));
        }
        f.set(x, y + 2, c(time.glint));
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += dt;
        if (r.age > 2) {
          ripples.splice(i, 1);
          continue;
        }
        const rx = 1 + r.age * 9;
        const ry = Math.max(1, rx * 0.28);
        const n = Math.ceil(rx * 4);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = Math.round(r.x + Math.cos(a) * rx);
          const y = Math.round(r.y + Math.sin(a) * ry);
          if (y > horizon && dith(x, y) + 0.5 > r.age / 2) f.set(x, y, c(mix(time.seam, 0xffffff, 0.4)));
        }
      }

      nextFlock -= dt * speed;
      if (nextFlock <= 0 && birds.length === 0) {
        flock();
        nextFlock = birdRate + Math.random() * 8;
      }
      const birdCol = c(time.name === "day" || time.name === "golden" ? 0xf5faff : 0x1a2348);
      birds = birds.filter((b) => b.x > -12 && b.x < W + 12);
      for (const b of birds) {
        b.x += b.dir * dt * 11 * Math.min(speed, 3);
        b.y += Math.sin(clock * 2 + b.p) * dt * 1.5;
        const up = Math.floor(clock * 5 + b.p) % 2 === 0;
        const x = b.x - lx * 3;
        f.set(x, b.y, birdCol);
        f.set(x - 1, b.y + (up ? 1 : -1), birdCol);
        f.set(x + 1, b.y + (up ? 1 : -1), birdCol);
      }

      // the lighthouse lamp turns. two beams on opposite sides of it sweep round the tower:
      // seen side on they reach far across the sky, coming toward us they flare and widen,
      // and going away they dim and the tower hides their root.
      let flare = 0;
      if (beam) {
        const bx = beam.x - MARGIN - lx * 7;
        const reach = W * 0.95;
        const turn = clock * 1.15;
        for (const phi of [turn, turn + Math.PI]) {
          const ex = Math.cos(phi);
          const ez = Math.sin(phi);
          flare = Math.max(flare, ez);
          const dir = ex >= 0 ? 1 : -1;
          const len = reach * Math.abs(ex) ** 0.8 + 4;
          const strength = ez > 0 ? 0.22 + ez * 0.2 : 0.12 + ez * 0.06;
          const spread = 0.08 + Math.max(0, ez) * 0.22;
          for (let k = ez < 0 ? 5 : 1; k < len; k++) {
            const x = Math.round(bx + dir * k);
            if (x < 0 || x >= W) continue;
            const half = Math.max(1, Math.round(1 + k * spread));
            const fade = 1 - k / len;
            for (let y = beam.y - half; y <= beam.y + half; y++) {
              if (y < 0 || y >= horizon) continue;
              const edge = 1 - Math.abs(y - beam.y) / (half + 1);
              if (fade * edge + dith(x, y) * 0.4 > 0.3) f.buf[y * W + x] = mixPacked(f.buf[y * W + x], c(0xfff0b8), strength * fade * (0.5 + edge * 0.5));
            }
          }
        }
      }

      blit(f, fg, -MARGIN - lx * 7, 0);
      if (beam && flare > 0.6) {
        // the lamp looking straight at us: a burst of light, and a streak on the water below
        const bx = beam.x - MARGIN - lx * 7;
        const k = (flare - 0.6) / 0.4;
        const r = 3 + k * 9;
        for (let y = Math.floor(beam.y - r); y <= beam.y + r; y++) {
          for (let x = Math.floor(bx - r * 1.6); x <= bx + r * 1.6; x++) {
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const d = Math.hypot((x - bx) / 1.6, y - beam.y) / r;
            if (d < 1 && (1 - d) * k + dith(x, y) * 0.3 > 0.25) f.buf[y * W + x] = mixPacked(f.buf[y * W + x], c(0xfff3c4), (1 - d) * 0.8 * k + 0.1);
          }
        }
        for (let y = horizon + 2; y < H; y += 1) {
          if (Math.sin(clock * 5 + y * 1.3) > 0.1) f.set(bx + Math.round(Math.sin(y + clock * 3) * (1 + (y - horizon) * 0.08)), y, mixPacked(f.get(Math.round(bx), y), c(0xffe6a0), 0.6 * k));
        }
      }

      if (shore === "beach") {
        // the waterline creeps up the sand and back
        const reachY = surfY + 2 + Math.round((Math.sin(clock * 0.8) + 1) * 1.5);
        for (let x = 0; x < W; x++) {
          const y = reachY + Math.round(Math.sin(x * 0.15 + clock) * 0.8);
          f.set(x, y, c(mix(time.seam, 0xffffff, 0.5)));
          if (dith(x, y + 1) > 0) f.set(x, y + 1, c(mix(time.seam, 0xffffff, 0.2)));
        }
      }
      if (time.lightsOn) {
        for (const l of lampsAt) {
          const x = Math.round(l.x - MARGIN - lx * 7);
          f.set(x, l.y - 1, c(0xffe6a0));
          for (let k = 0; k < H - l.y - 14; k += 2) if (Math.sin(clock * 4 + k) > 0) f.set(x, l.y + 14 + k, c(0xe8b060));
        }
      }
    },
  };
  return place;
};
