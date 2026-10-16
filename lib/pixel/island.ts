import { c, dith, mix, mixPacked, mulberry32, type Frame } from "./frame";
import type { Place, PlaceMaker } from "./scene";
import { makeNoise3 } from "./world";

/** hsl (0..360, 0..1, 0..1) to 0xrrggbb */
function hsl(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

/**
 * a ramp of six tones from one hue: shadows lean cool, highlights lean warm, the way pixel
 * artists build palettes, so any hue the seed lands on still looks considered
 */
function ramp(hue: number, sat: number, dark: number, light: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const t = i / 5;
    return hsl(hue + (0.5 - t) * 34, sat * (0.75 + Math.sin(t * Math.PI) * 0.35), dark + (light - dark) * Math.pow(t, 0.9));
  });
}

/**
 * an island seen from above, drawn like an old map: a dark coastline ringed by contour lines
 * out in the shallows, the sea hatched in drifting dashes, forests as bubbly clumps full of
 * little trees, a river finding its way down, a village, a path, a dock, and something buried.
 * it can sit anywhere in the frame, and the big ones run off the edges.
 * every island gets its own palette. waves rise and sink out at sea and the surf laps the
 * shore. the ship follows the pointer; a click draws a whole new island.
 */
export const island: PlaceMaker = (seed, W, H, night) => {
  const rand = mulberry32(seed);
  const noise = makeNoise3(rand);

  // ---- the palette ----
  // one of three schemes, all of which keep the sea quieter than the land: the same hue
  // throughout (like an old printed map), a neighbouring hue, or a muted opposite
  const hue = rand() * 360;
  const scheme = Math.floor(rand() * 3);
  const sat = 0.24 + rand() * 0.22;
  const landRamp = ramp(hue, sat, night ? 0.1 : 0.18, night ? 0.62 : 0.88);
  const seaHue = scheme === 0 ? hue : scheme === 1 ? hue - 45 - rand() * 30 : hue + 165 + (rand() - 0.5) * 30;
  const seaSat = scheme === 2 ? sat * 0.55 : sat * 0.75;
  const seaRamp = ramp(seaHue, seaSat, night ? 0.12 : 0.22, night ? 0.48 : 0.72);
  const L = landRamp.map(c);
  const S = seaRamp.map(c);
  const ink = c(mix(landRamp[0], 0x000000, 0.25));
  const glow = c(hsl(hue + 30, 0.8, 0.72));

  // ---- the shape: noise lifted in the middle and sunk at the edges ----
  // a big island, placed anywhere: often it runs off the edges and you only see part of it.
  // the shape is retried until land takes up a pleasing share of the frame.
  const height = new Float32Array(W * H);
  const land = new Uint8Array(W * H);
  const shapeRand = mulberry32(seed * 3 + 1);
  let cx = W / 2;
  let cy = H / 2;
  let rx = W * 0.5;
  let ry = H * 0.6;
  for (let attempt = 0; attempt < 8; attempt++) {
    const partial = shapeRand() < 0.5;
    cx = W * (partial ? -0.05 + shapeRand() * 1.1 : 0.3 + shapeRand() * 0.4);
    cy = H * (partial ? -0.05 + shapeRand() * 1.1 : 0.35 + shapeRand() * 0.3);
    rx = W * (0.42 + shapeRand() * 0.35);
    ry = H * (0.5 + shapeRand() * 0.4);
    const ox = shapeRand() * 100;
    let count = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        const h = noise(x * 0.03 + ox, y * 0.03, 1, 5) * 0.9 + (1 - d * d) * 0.75 - 0.35;
        height[y * W + x] = h;
        land[y * W + x] = h > 0 ? 1 : 0;
        count += land[y * W + x];
      }
    }
    const share = count / (W * H);
    if (share > 0.32 && share < 0.72) break;
  }
  // a little islet or two off the coast
  for (let k = 0; k < Math.floor(rand() * 3); k++) {
    const ix = rand() * W;
    const iy = rand() * H;
    const r = 3 + rand() * 5;
    for (let y = Math.floor(iy - r); y <= iy + r; y++) {
      for (let x = Math.floor(ix - r); x <= ix + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (Math.hypot(x - ix, y - iy) + noise(x * 0.3, y * 0.3, 9, 2) * 3 < r) land[y * W + x] = 1;
      }
    }
  }

  // how far every pixel is from the coast, on its own side of it
  const far = 255;
  const dist = new Uint8Array(W * H).fill(far);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const me = land[i];
      if ((x > 0 && land[i - 1] !== me) || (x < W - 1 && land[i + 1] !== me) || (y > 0 && land[i - W] !== me) || (y < H - 1 && land[i + W] !== me)) dist[i] = 0;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const fwd = pass === 0;
    for (let yy = 0; yy < H; yy++) {
      const y = fwd ? yy : H - 1 - yy;
      for (let xx = 0; xx < W; xx++) {
        const x = fwd ? xx : W - 1 - xx;
        const i = y * W + x;
        const nx = fwd ? x - 1 : x + 1;
        const ny = fwd ? y - 1 : y + 1;
        if (nx >= 0 && nx < W && land[y * W + nx] === land[i]) dist[i] = Math.min(dist[i], dist[y * W + nx] + 1);
        if (ny >= 0 && ny < H && land[ny * W + x] === land[i]) dist[i] = Math.min(dist[i], dist[ny * W + x] + 1);
      }
    }
  }

  // ---- forests: clumps of circles where the forest noise is high, so their edges bubble ----
  // the island's own idea of "high": its top fifth of land, whatever its absolute heights
  const landHeights: number[] = [];
  for (let i = 0; i < W * H; i += 3) if (land[i]) landHeights.push(height[i]);
  landHeights.sort((a2, b2) => a2 - b2);
  const highAt = (q: number) => landHeights[Math.min(landHeights.length - 1, Math.floor(landHeights.length * q))] ?? 1;
  const hill = highAt(0.8);
  const peak = highAt(0.95);
  const forest = new Uint8Array(W * H);
  for (let k = 0; k < 900; k++) {
    const x = rand() * W;
    const y = rand() * H;
    const i = Math.floor(y) * W + Math.floor(x);
    // forests keep to the lower slopes; the high ground is left bare for the mountains
    if (!land[i] || dist[i] < 3 || height[i] > hill || noise(x * 0.05 + 30, y * 0.05, 4, 3) < 0.1) continue;
    const r = 2.5 + rand() * 3;
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) {
      for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (land[j] && dist[j] > 1 && height[j] < hill && Math.hypot(xx - x, yy - y) <= r) forest[j] = 1;
      }
    }
  }

  // ---- rivers: each from its own high place, winding downhill to the sea ----
  const river = new Uint8Array(W * H);
  const carve = (bx: number, by: number) => {
    let x = bx;
    let y = by;
    let angle = rand() * Math.PI * 2;
    for (let step = 0; step < 500; step++) {
      const i = Math.round(y) * W + Math.round(x);
      if (i < 0 || i >= W * H || !land[i]) break;
      // lean toward lower ground, wander a little
      let lowest = Infinity;
      let la = angle;
      for (let a2 = -1; a2 <= 1; a2 += 0.5) {
        const tx = Math.round(x + Math.cos(angle + a2) * 2);
        const ty = Math.round(y + Math.sin(angle + a2) * 2);
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const hh = height[ty * W + tx] + (rand() - 0.5) * 0.05;
        if (hh < lowest) {
          lowest = hh;
          la = angle + a2;
        }
      }
      angle = angle * 0.6 + la * 0.4;
      x += Math.cos(angle) * 0.7;
      y += Math.sin(angle) * 0.7;
      const wdt = 0.8 + Math.min(1.4, step / 140);
      for (let yy = Math.floor(y - wdt); yy <= y + wdt; yy++) {
        for (let xx = Math.floor(x - wdt); xx <= x + wdt; xx++) {
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && Math.hypot(xx - x, yy - y) <= wdt) river[yy * W + xx] = 1;
        }
      }
    }
  };
  const sources: { x: number; y: number }[] = [];
  const nRivers = 2 + Math.floor(rand() * 3);
  for (let r = 0; r < nRivers; r++) {
    let best = -Infinity;
    let bx = -1;
    let by = -1;
    for (let k = 0; k < 500; k++) {
      const x = Math.floor(rand() * W);
      const y = Math.floor(rand() * H);
      const i = y * W + x;
      if (!land[i] || dist[i] < 8) continue;
      if (sources.some((s2) => Math.hypot(s2.x - x, s2.y - y) < W * 0.22)) continue;
      if (height[i] > best) {
        best = height[i];
        bx = x;
        by = y;
      }
    }
    if (bx < 0) break;
    sources.push({ x: bx, y: by });
    carve(bx, by);
  }

  // ---- the static map ----
  const map = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) {
        // shallows lighter near the coast
        map[i] = dist[i] < 9 + dith(x, y) * 5 ? S[2] : S[1];
        continue;
      }
      if (dist[i] === 0) {
        map[i] = ink;
        continue;
      }
      let col = dist[i] < 3 ? L[5] : L[4];
      // elevation: higher ground a shade darker, with a dotted contour line at each step
      const h = height[i];
      const lvl = Math.floor(h * 7);
      if (lvl >= 2) col = L[3];
      const right = x < W - 1 ? Math.floor(height[i + 1] * 7) : lvl;
      const down = y < H - 1 ? Math.floor(height[i + W] * 7) : lvl;
      if ((right !== lvl || down !== lvl) && lvl >= 1 && (x + y) % 2 === 0) col = L[2];
      map[i] = col;
    }
  }
  // forests over the land: darker, outlined, full of little trees
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!forest[i]) continue;
      const edge = !forest[i - 1] || !forest[i + 1] || !forest[i - W] || !forest[i + W];
      map[i] = edge ? ink : L[2];
    }
  }
  for (let y = 2; y < H - 2; y += 4) {
    for (let x = 2 + ((y / 4) % 2) * 3; x < W - 2; x += 6) {
      const jx = x + Math.round((rand() - 0.5) * 2);
      const jy = y + Math.round((rand() - 0.5) * 2);
      if (!forest[jy * W + jx] || !forest[(jy + 1) * W + jx - 1] || !forest[(jy + 1) * W + jx + 1]) continue;
      map[jy * W + jx] = L[1];
      map[(jy + 1) * W + jx - 1] = L[1];
      map[(jy + 1) * W + jx + 1] = L[1];
      map[(jy - 1) * W + jx] = L[3];
    }
  }
  // the river, outlined like the coast
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!river[i] || !land[i]) continue;
      const edge = !river[i - 1] || !river[i + 1] || !river[i - W] || !river[i + W];
      map[i] = edge ? ink : S[3];
    }
  }

  // ---- the island stands up out of the sea: wherever the coast faces us, a cliff drops from
  // the land to the water, banded like rock, with a shadow at its foot. where the river
  // reaches such a coast it falls down the face. ----
  const cliff = new Uint8Array(W * H);
  const fall = new Uint8Array(W * H);
  {
    const tall = Math.max(3, Math.round(W / 60));
    const rockTop = L[1];
    const rock = c(mix(landRamp[0], landRamp[1], 0.55));
    const rockDeep = c(mix(landRamp[0], 0x000000, 0.2));
    const shade = c(mix(seaRamp[0], 0x000000, 0.15));
    for (let x = 0; x < W; x++) {
      // cliff height wanders a little along the coast
      const hgt = tall + Math.round(noise(x * 0.08, 5, 5, 2) * 2);
      for (let y = 0; y < H - 1; y++) {
        const i = y * W + x;
        if (!land[i] || land[i + W]) continue;
        const pouring = river[i] === 1;
        // a pale lip along the edge of the plateau, just above the drop
        if (!pouring && y > 0 && land[i - W] && !forest[i - W]) map[i - W] = L[5];
        for (let k = 1; k <= hgt + 1; k++) {
          const yy = y + k;
          if (yy >= H) break;
          const j = yy * W + x;
          if (land[j]) break;
          if (k === hgt + 1) {
            // the shadow the cliff throws on the water
            if (!cliff[j]) map[j] = shade;
            continue;
          }
          cliff[j] = 1;
          if (pouring) {
            fall[j] = 1;
            map[j] = S[4];
          } else {
            const crevice = (x * 7 + y * 3) % 11 === 0 && k > 1;
            map[j] = crevice ? rockDeep : k === 1 ? rockTop : k === hgt ? rockDeep : rock;
          }
        }
      }
    }
  }

  // ---- the land's features and the things people made ----
  const put = (x: number, y: number, col: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) map[y * W + x] = col;
  };
  const isOpen = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 2 || yi < 2 || xi >= W - 2 || yi >= H - 2) return false;
    const i = yi * W + xi;
    return land[i] === 1 && !forest[i] && !river[i] && dist[i] > 1;
  };
  // places already taken, so nothing is drawn on top of anything else
  const taken: { x: number; y: number; r: number }[] = [];
  const free = (x: number, y: number, r: number) => taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r);
  const fits = (x: number, y: number, w2: number, h2: number) => {
    for (let yy = y - h2; yy <= y + 1; yy++) for (let xx = x - w2; xx <= x + w2; xx++) if (!isOpen(xx, yy)) return false;
    return true;
  };

  // mountains on the high ground: a lit face, a shaded face, a cap of snow
  const mountain = (x: number, y: number, size: number) => {
    for (let r = 0; r < size; r++) {
      const half = size - 1 - r;
      for (let dx = -half; dx <= half; dx++) {
        const edge = Math.abs(dx) === half;
        const snow = r >= size - 2;
        put(x + dx, y - r, edge ? ink : snow ? L[5] : dx < 0 ? L[5] : dx === 0 ? L[3] : L[1]);
      }
    }
    put(x, y - size, ink);
  };
  for (let y = 7; y < H - 2; y += 6) {
    for (let x = 5 + (Math.floor(y / 6) % 2) * 5; x < W - 5; x += 10) {
      const jx = x + Math.round((rand() - 0.5) * 4);
      const jy = y + Math.round((rand() - 0.5) * 2);
      const i = jy * W + jx;
      if (!land[i] || height[i] < hill) continue;
      const size = height[i] > peak ? 7 : height[i] > (hill + peak) / 2 ? 6 : 5;
      if (!fits(jx, jy, size, size) || !free(jx, jy - 2, 3)) continue;
      mountain(jx, jy, size);
      taken.push({ x: jx, y: jy - 2, r: 3 });
    }
  }

  // villages: a few clusters of houses on low ground, not too far from the sea
  type House = { x: number; y: number; kind: "hut" | "house" | "tower"; window: { x: number; y: number }; chimney?: { x: number; y: number } };
  const houses: House[] = [];
  const villages: { x: number; y: number }[] = [];
  for (let v = 0; v < 2 + Math.floor(rand() * 2); v++) {
    for (let k = 0; k < 300; k++) {
      const x = 8 + Math.floor(rand() * (W - 16));
      const y = 8 + Math.floor(rand() * (H - 16));
      const i = y * W + x;
      if (!isOpen(x, y) || height[i] > 0.35 || dist[i] > 24) continue;
      if (villages.some((o) => Math.hypot(o.x - x, o.y - y) < W * 0.2)) continue;
      villages.push({ x, y });
      break;
    }
  }
  const drawHouse = (h: House) => {
    const { x, y } = h;
    if (h.kind === "hut") {
      for (let k = -2; k <= 2; k++) put(x + k, y - 1, ink);
      for (let k = -1; k <= 1; k++) put(x + k, y - 2, ink);
      put(x, y - 3, ink);
      for (let r = 0; r < 2; r++) for (let k = -2; k <= 2; k++) put(x + k, y + r, Math.abs(k) === 2 ? ink : L[5]);
      put(x, y + 1, ink);
      for (let k = -2; k <= 2; k++) put(x + k, y + 2, ink);
    } else if (h.kind === "house") {
      // a pitched roof in the land's darkest shade, a chimney, a lit wall
      for (let k = -3; k <= 3; k++) put(x + k, y - 1, ink);
      for (let k = -2; k <= 2; k++) put(x + k, y - 2, L[1]);
      for (let k = -1; k <= 1; k++) put(x + k, y - 3, L[1]);
      put(x - 3, y - 2, ink);
      put(x + 3, y - 2, ink);
      put(x - 2, y - 3, ink);
      put(x + 2, y - 3, ink);
      put(x, y - 4, ink);
      put(x + 2, y - 4, ink);
      put(x + 2, y - 5, ink);
      for (let r = 0; r < 2; r++) for (let k = -3; k <= 3; k++) put(x + k, y + r, Math.abs(k) === 3 ? ink : L[5]);
      put(x - 1, y + 1, ink);
      for (let k = -3; k <= 3; k++) put(x + k, y + 2, ink);
    } else {
      // a little tower with a flag
      for (let r = 0; r < 6; r++) for (let k = -1; k <= 1; k++) put(x + k, y + 2 - r, Math.abs(k) === 1 ? ink : L[5]);
      for (let k = -2; k <= 2; k++) put(x + k, y - 4, ink);
      put(x, y - 5, ink);
      put(x, y - 6, ink);
      put(x + 1, y - 6, glow);
      put(x + 1, y - 5, glow);
    }
  };
  for (const v of villages) {
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n * 6 && houses.filter((h) => Math.hypot(h.x - v.x, h.y - v.y) < 16).length < n; k++) {
      const x = Math.round(v.x + (rand() - 0.5) * 22);
      const y = Math.round(v.y + (rand() - 0.5) * 14);
      const kind = rand() < 0.15 ? "tower" : rand() < 0.55 ? "house" : "hut";
      if (!fits(x, y, kind === "house" ? 4 : 3, 6) || !free(x, y, 4)) continue;
      const h: House = { x, y, kind, window: { x: x + 1, y } };
      if (kind === "house") h.chimney = { x: x + 2, y: y - 6 };
      houses.push(h);
      taken.push({ x, y, r: 4 });
    }
  }
  // fields of furrows beside each village
  for (const v of villages) {
    for (let k = 0; k < 2; k++) {
      const fx = Math.round(v.x + (rand() < 0.5 ? -18 : 8));
      const fy = Math.round(v.y + (rand() - 0.5) * 10);
      if (!free(fx + 5, fy + 3, 6)) continue;
      const fw = 8 + Math.floor(rand() * 6);
      for (let y = fy; y < fy + 6; y++) {
        for (let x = fx; x < fx + fw; x++) {
          if (!isOpen(x, y)) continue;
          put(x, y, (y - fy) % 2 === 0 ? L[3] : L[5]);
        }
      }
      taken.push({ x: fx + fw / 2, y: fy + 3, r: fw / 2 });
    }
  }

  // a windmill near a village, its sails turning
  let mill: { x: number; y: number } | null = null;
  for (const v of villages) {
    if (mill) break;
    for (let k = 0; k < 60; k++) {
      const x = Math.round(v.x + (rand() - 0.5) * 34);
      const y = Math.round(v.y + (rand() - 0.5) * 22);
      if (!fits(x, y, 3, 7) || !free(x, y - 3, 6)) continue;
      mill = { x, y };
      taken.push({ x, y: y - 3, r: 6 });
      for (let r = 0; r < 6; r++) {
        const half = 1 + Math.floor((6 - r) / 3);
        for (let k2 = -half; k2 <= half; k2++) put(x + k2, y + 1 - r, Math.abs(k2) === half ? ink : L[5]);
      }
      put(x, y + 1, ink);
      break;
    }
  }

  // a lighthouse on a stretch of coast
  let tower: { x: number; y: number } | null = null;
  if (rand() < 0.7) {
    for (let k = 0; k < 800; k++) {
      const x = 6 + Math.floor(rand() * (W - 12));
      const y = 10 + Math.floor(rand() * (H - 16));
      const i = y * W + x;
      if (!land[i] || dist[i] !== 2 || forest[i] || river[i] || !free(x, y - 3, 5)) continue;
      tower = { x, y };
      taken.push({ x, y: y - 3, r: 5 });
      for (let r = 0; r < 7; r++) for (let k2 = -1; k2 <= 1; k2++) put(x + k2, y - r, Math.abs(k2) === 1 ? ink : r % 3 === 1 ? glow : L[5]);
      for (let k2 = -2; k2 <= 2; k2++) put(x + k2, y - 7, ink);
      put(x, y - 9, ink);
      break;
    }
  }

  // dotted paths from village to village, and out to the mill and the lighthouse; a plank
  // bridge wherever one crosses a river
  const ends = [...villages, ...(mill ? [mill] : []), ...(tower ? [tower] : [])];
  for (let k = 1; k < ends.length; k++) {
    const a2 = ends[k - 1];
    const b2 = ends[k];
    const n = Math.ceil(Math.hypot(b2.x - a2.x, b2.y - a2.y));
    const bow = (rand() - 0.5) * 16;
    let onBridge = false;
    for (let st = 0; st <= n; st++) {
      const t = st / n;
      const x = Math.round(a2.x + (b2.x - a2.x) * t - Math.sin(t * Math.PI) * bow * ((b2.y - a2.y) / n));
      const y = Math.round(a2.y + (b2.y - a2.y) * t + Math.sin(t * Math.PI) * bow * ((b2.x - a2.x) / n));
      const i = y * W + x;
      if (x < 0 || y < 0 || x >= W || y >= H || !land[i]) continue;
      if (river[i]) {
        put(x, y, L[3]);
        put(x, y - 1, ink);
        put(x, y + 1, ink);
        onBridge = true;
        continue;
      }
      if (onBridge) onBridge = false;
      if (st % 2 === 0 && !forest[i] && taken.every((tk) => Math.hypot(tk.x - x, tk.y - y) > tk.r - 1)) put(x, y, L[2]);
    }
  }

  // docks from the coast by each seaside village, a boat tied to each
  const boats: { x: number; y: number; p: number }[] = [];
  for (const v of villages) {
    let best = Infinity;
    let px = 0;
    let py = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (land[i] || cliff[i] || dist[i] !== 1) continue;
        const d = Math.hypot(x - v.x, y - v.y);
        if (d < best) {
          best = d;
          px = x;
          py = y;
        }
      }
    }
    if (best > 26) continue;
    const dx = Math.sign(px - v.x) || 1;
    for (let k = 0; k < 6; k++) {
      put(px + dx * k, py, L[3]);
      if (k % 2 === 0) put(px + dx * k, py + 1, ink);
    }
    boats.push({ x: px + dx * 7, y: py + 2, p: rand() * 6 });
  }

  // lone trees, rocks and flowers out in the open
  const tree = (x: number, y: number) => {
    put(x, y, ink);
    for (let k = -1; k <= 1; k++) put(x + k, y - 1, k === 1 ? L[1] : L[2]);
    for (let k = -1; k <= 1; k++) put(x + k, y - 2, k === -1 ? L[3] : L[2]);
    put(x, y - 3, L[3]);
  };
  for (let k = 0; k < Math.round(W * 0.35); k++) {
    const x = 3 + Math.floor(rand() * (W - 6));
    const y = 5 + Math.floor(rand() * (H - 8));
    if (!fits(x, y, 1, 3) || !free(x, y - 1, 2)) continue;
    tree(x, y);
    taken.push({ x, y: y - 1, r: 2 });
  }
  for (let k = 0; k < Math.round(W * 0.2); k++) {
    const x = 2 + Math.floor(rand() * (W - 4));
    const y = 2 + Math.floor(rand() * (H - 4));
    if (!fits(x, y, 1, 1) || !free(x, y, 1)) continue;
    put(x, y, L[2]);
    put(x + 1, y, ink);
    put(x, y + 1, ink);
  }
  const bloom = c(hsl(hue + 160, 0.55, 0.78));
  for (let k = 0; k < Math.round(W * 0.8); k++) {
    const x = 2 + Math.floor(rand() * (W - 4));
    const y = 2 + Math.floor(rand() * (H - 4));
    if (isOpen(x, y) && free(x, y, 0) && height[y * W + x] < 0.3) put(x, y, rand() < 0.5 ? bloom : L[5]);
  }

  // a campfire by one village, and the X where something's buried
  let fire: { x: number; y: number } | null = null;
  if (villages[0]) {
    for (let k = 0; k < 60; k++) {
      const x = Math.round(villages[0].x + (rand() - 0.5) * 20);
      const y = Math.round(villages[0].y + (rand() - 0.5) * 14);
      if (!fits(x, y, 2, 2) || !free(x, y, 3)) continue;
      fire = { x, y };
      taken.push({ x, y, r: 3 });
      for (const [ox, oy] of [
        [-2, 0],
        [2, 0],
        [-1, 1],
        [1, 1],
        [0, 1],
      ]) put(x + ox, y + oy, ink);
      break;
    }
  }
  let treasure: { x: number; y: number } | null = null;
  for (let k = 0; k < 200 && !treasure; k++) {
    const x = 4 + Math.floor(rand() * (W - 8));
    const y = 4 + Math.floor(rand() * (H - 8));
    if (fits(x, y, 1, 1) && free(x, y, 3) && dist[y * W + x] > 5) treasure = { x, y };
  }
  for (const h of houses) drawHouse(h);

  // ---- the moving things ----
  // the ship starts somewhere in open water and sails after the pointer
  const ship = { x: 10, y: H - 12, heading: 0, trail: [] as { x: number; y: number }[] };
  for (let k = 0; k < 600; k++) {
    const x = 8 + rand() * (W - 16);
    const y = 8 + rand() * (H - 16);
    const i = Math.floor(y) * W + Math.floor(x);
    if (!land[i] && dist[i] > 8) {
      ship.x = x;
      ship.y = y;
      break;
    }
  }
  // a coarse grid of open water, and a flow field over it: every cell's distance (in steps)
  // to wherever the pointer is. the ship always moves to the neighbouring cell nearer to it,
  // so it finds its way round headlands and out of bays without ever getting stuck.
  const G = 2;
  const gw = Math.ceil(W / G);
  const gh = Math.ceil(H / G);
  const nav = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * G + 1;
      const y = gy * G + 1;
      if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) continue;
      const i = Math.min(H - 1, y) * W + Math.min(W - 1, x);
      nav[gy * gw + gx] = !land[i] && !cliff[i] && dist[i] > 2 ? 1 : 0;
    }
  }
  // which body of water each cell belongs to, so the ship only ever aims for water it can reach
  const sea = new Int32Array(gw * gh).fill(-1);
  {
    const stack: number[] = [];
    let id = 0;
    for (let i = 0; i < gw * gh; i++) {
      if (!nav[i] || sea[i] >= 0) continue;
      sea[i] = id;
      stack.push(i);
      while (stack.length) {
        const cur = stack.pop()!;
        const x = cur % gw;
        const y = (cur / gw) | 0;
        for (const ni of [x > 0 ? cur - 1 : -1, x < gw - 1 ? cur + 1 : -1, y > 0 ? cur - gw : -1, y < gh - 1 ? cur + gw : -1]) {
          if (ni >= 0 && nav[ni] && sea[ni] < 0) {
            sea[ni] = id;
            stack.push(ni);
          }
        }
      }
      id++;
    }
  }
  const flow = new Int32Array(gw * gh).fill(-1);
  let flowFrom = -1;
  const queue = new Int32Array(gw * gh);
  const buildFlow = (tx: number, ty: number, mySea: number) => {
    // start from the open-water cell nearest the pointer, even if the pointer is over land
    const cx0 = Math.min(gw - 1, Math.max(0, Math.floor(tx / G)));
    const cy0 = Math.min(gh - 1, Math.max(0, Math.floor(ty / G)));
    let start = -1;
    for (let r = 0; r < Math.max(gw, gh) && start < 0; r++) {
      for (let dy = -r; dy <= r && start < 0; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx0 + dx;
          const y = cy0 + dy;
          if (x >= 0 && y >= 0 && x < gw && y < gh && nav[y * gw + x] && (mySea < 0 || sea[y * gw + x] === mySea)) {
            start = y * gw + x;
            break;
          }
        }
      }
    }
    if (start === flowFrom) return;
    flowFrom = start;
    flow.fill(-1);
    if (start < 0) return;
    let head = 0;
    let tail = 0;
    flow[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const cur = queue[head++];
      const x = cur % gw;
      const y = (cur / gw) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const ni = ny * gw + nx;
        if (!nav[ni] || flow[ni] >= 0) continue;
        flow[ni] = flow[cur] + 1;
        queue[tail++] = ni;
      }
    }
  };

  const wet = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 4 || yi < 4 || xi >= W - 4 || yi >= H - 4) return false;
    const i = yi * W + xi;
    return !land[i] && !cliff[i] && dist[i] > 2;
  };
  const gulls = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({ x: rand() * W, y: rand() * H, a: rand() * 6.28, r: 6 + rand() * 10, p: rand() * 6 }));

  // little wave marks out on the open water, each living a few seconds
  type Wave = { x: number; y: number; age: number; life: number; size: number };
  const waves: Wave[] = [];
  const newWave = (): Wave | null => {
    for (let k = 0; k < 30; k++) {
      const x = 4 + Math.random() * (W - 8);
      const y = 4 + Math.random() * (H - 8);
      const i = Math.floor(y) * W + Math.floor(x);
      if (!land[i] && dist[i] > 6) return { x, y, age: 0, life: 2.5 + Math.random() * 2.5, size: Math.random() < 0.6 ? 1 : 2 };
    }
    return null;
  };
  for (let k = 0; k < Math.round((W * H) / 900); k++) {
    const w = newWave();
    if (w) {
      w.age = Math.random() * w.life;
      waves.push(w);
    }
  }

  let clock = 0;

  const place: Place = {
    bloom: night ? 0.7 : 0,
    hour: night ? "night" : "day",
    draw(f: Frame, _t: number, dt: number, input) {
      clock += dt;
      // a click asks for a whole new island
      if (input.clicks.length) place.reroll = true;

      f.buf.set(map);

      // the sea: hatch lines drifting with the swell, and contour rings pulsing out from the coast
      const lx = input.lookX;
      for (let y = 1; y < H; y += 4) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (land[i] || cliff[i] || dist[i] < 3) continue;
          const n = noise(x * 0.07 + clock * 0.25 + lx, y * 0.18, 5, 2);
          if (n > 0.2) f.buf[i] = S[dist[i] < 14 ? 2 : 1];
        }
      }
      // the waterfalls run
      for (let i = 0; i < W * H; i++) {
        if (!fall[i]) continue;
        const y = (i / W) | 0;
        f.buf[i] = (y + Math.floor(clock * 10)) % 3 === 0 ? S[5] : S[4];
      }

      // surf: a pale line that laps in and out along the coast, out of step from one stretch
      // of shore to the next
      for (let i = 0; i < W * H; i++) {
        if (land[i]) continue;
        const d = dist[i];
        if (d > 4 || cliff[i]) continue;
        const x = i % W;
        const y = (i / W) | 0;
        const reach = 1.6 + 1.4 * Math.sin(clock * 1.3 + noise(x * 0.08, y * 0.08, 13, 1) * 9);
        if (d === Math.round(reach)) f.buf[i] = S[5];
        else if (d < reach && d >= 1 && dith(x, y) > 0.2) f.buf[i] = S[4];
      }

      // wave marks: a little crest that rises, drifts with the swell and sinks back
      const crest = S[4];
      const cap = S[5];
      for (let k = waves.length - 1; k >= 0; k--) {
        const w = waves[k];
        w.age += dt;
        w.x += dt * (0.6 + input.lookX * 1.5);
        if (w.age > w.life) {
          const fresh = newWave();
          if (fresh) waves[k] = fresh;
          else waves.splice(k, 1);
          continue;
        }
        const t = w.age / w.life;
        // grows in, holds, then sinks: drawn smaller at the start and the end
        const grow = t < 0.2 ? t / 0.2 : t > 0.75 ? (1 - t) / 0.25 : 1;
        const half = Math.max(1, Math.round((1 + w.size) * grow));
        const X = Math.round(w.x);
        const Y = Math.round(w.y);
        const i = Y * W + X;
        if (X < 2 || X >= W - 2 || Y < 2 || Y >= H - 2 || land[i] || cliff[i] || dist[i] < 3) continue;
        // a shallow arch: the ends a row lower than the middle
        for (let dx = -half; dx <= half; dx++) {
          const yy = Y + (Math.abs(dx) === half ? 1 : 0);
          f.set(X + dx, yy, Math.abs(dx) < half && grow > 0.7 ? cap : crest);
        }
      }

      // drifting cloud shadows
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n = noise(x * 0.02 - clock * 0.05 - lx * 0.3, y * 0.03, 11, 3);
          if (n > 0.18 + dith(x, y) * 0.1) f.buf[y * W + x] = mixPacked(f.buf[y * W + x], c(landRamp[0]), 0.16);
        }
      }

      // boats at the docks bob on the swell
      for (const b2 of boats) {
        const by = b2.y + (Math.sin(clock * 2 + b2.p) > 0.6 ? 1 : 0);
        for (let k = -1; k <= 1; k++) f.set(b2.x + k, by, ink);
        f.set(b2.x, by - 1, L[5]);
      }

      // the windmill's sails turn
      if (mill) {
        const hx = mill.x;
        const hy = mill.y - 5;
        const a0 = clock * 1.4;
        for (let k = 0; k < 4; k++) {
          const a2 = a0 + (k * Math.PI) / 2;
          for (let r = 1; r <= 5; r++) f.set(hx + Math.cos(a2) * r, hy + Math.sin(a2) * r, r === 5 ? L[5] : ink);
        }
        f.set(hx, hy, L[1]);
      }

      // the lighthouse lamp blinks; at night it throws light across the water
      if (tower) {
        const on = Math.sin(clock * 3) > 0;
        f.set(tower.x, tower.y - 8, on ? glow : L[2]);
        if (night && on) {
          for (let k = 2; k < 18; k++) {
            const a2 = clock * 0.8;
            const x = tower.x + Math.cos(a2) * k;
            const y = tower.y - 8 + Math.sin(a2) * k * 0.5;
            if (x >= 0 && y >= 0 && x < W && y < H && dith(Math.round(x), Math.round(y)) > -0.2) {
              f.buf[Math.round(y) * W + Math.round(x)] = mixPacked(f.get(Math.round(x), Math.round(y)), glow, 0.5 * (1 - k / 18));
            }
          }
        }
      }

      // chimney smoke and campfire smoke rise and thin out
      const smoke = (x: number, y: number, phase: number) => {
        for (let k = 0; k < 3; k++) {
          const t = ((clock * 0.6 + phase + k / 3) % 1 + 1) % 1;
          const sx2 = x + Math.sin((clock + k) * 2 + phase) * 0.8 + t * 2;
          const sy2 = y - t * 7;
          if (t < 0.85 && sy2 >= 0) {
            const xi = Math.round(sx2);
            const yi = Math.round(sy2);
            if (xi >= 0 && xi < W) f.buf[yi * W + xi] = mixPacked(f.buf[yi * W + xi], L[5], 0.8 * (1 - t));
          }
        }
      };
      houses.forEach((h, k) => {
        if (h.chimney) smoke(h.chimney.x, h.chimney.y, k * 0.37);
      });
      if (fire) {
        const flick = Math.floor(clock * 10) % 3;
        f.set(fire.x, fire.y, glow);
        f.set(fire.x + (flick === 0 ? -1 : flick === 1 ? 1 : 0), fire.y - 1, glow);
        f.set(fire.x, fire.y - 1, c(hsl(hue + 20, 0.9, 0.85)));
        smoke(fire.x, fire.y - 2, 0.5);
      }

      // the ship sails for the pointer along the flow field
      const tx = W / 2 + input.lookX * (W / 2);
      const ty = H / 2 + input.lookY * (H / 2);
      // which water the ship is on: its own cell, or the nearest open cell around it
      let mySea = -1;
      for (let r = 0; r < 4 && mySea < 0; r++) {
        for (let dy = -r; dy <= r && mySea < 0; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = Math.floor(ship.x / G) + dx;
            const ny = Math.floor(ship.y / G) + dy;
            if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && sea[ny * gw + nx] >= 0) {
              mySea = sea[ny * gw + nx];
              break;
            }
          }
        }
      }
      buildFlow(tx, ty, mySea);
      // aim at the best cell a couple of steps ahead, which smooths the zigzag of a grid path.
      // if the ship has brushed the shore and sits just off the grid, this also finds it a way back.
      let best = -1;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = Math.floor(ship.x / G) + dx;
          const ny = Math.floor(ship.y / G) + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const ni = ny * gw + nx;
          if (flow[ni] >= 0 && (best < 0 || flow[ni] < flow[best])) best = ni;
        }
      }
      const here = Math.floor(ship.y / G) * gw + Math.floor(ship.x / G);
      const steps = flow[here] >= 0 ? flow[here] : best >= 0 ? flow[best] + 2 : 0;
      if (steps > 0 && best >= 0) {
        const ax = (best % gw) * G + G / 2;
        const ay = ((best / gw) | 0) * G + G / 2;
        const want = Math.atan2(ay - ship.y, ax - ship.x);
        const d = Math.atan2(Math.sin(want - ship.heading), Math.cos(want - ship.heading));
        ship.heading += d * Math.min(1, dt * 5);
        const speed = Math.min(18, 4 + steps * 1.5) * dt;
        const nx = ship.x + Math.cos(ship.heading) * speed;
        const ny = ship.y + Math.sin(ship.heading) * speed;
        if (wet(nx, ny)) {
          ship.x = nx;
          ship.y = ny;
        } else {
          // turning hard into a corner: step straight for the cell instead
          ship.x += Math.cos(want) * speed;
          ship.y += Math.sin(want) * speed;
        }
        const last = ship.trail[ship.trail.length - 1];
        if (!last || Math.hypot(last.x - ship.x, last.y - ship.y) > 1.5) ship.trail.push({ x: ship.x, y: ship.y });
        if (ship.trail.length > 14) ship.trail.shift();
      } else if (ship.trail.length && Math.random() < dt * 4) ship.trail.shift();
      ship.trail.forEach((p, k) => {
        if (k % 2 === 0) f.set(p.x, p.y + 1, S[4]);
      });
      const sx = Math.round(ship.x);
      const sy = Math.round(ship.y + (Math.sin(clock * 2.5) > 0.7 ? 1 : 0));
      const facing = Math.cos(ship.heading) >= 0 ? 1 : -1;
      // a hull, a mast, a sail filled toward where it's going
      for (let k = -3; k <= 3; k++) f.set(sx + k, sy + 1, ink);
      for (let k = -2; k <= 2; k++) f.set(sx + k, sy + 2, ink);
      for (let k = -1; k <= 4; k++) f.set(sx, sy - k, ink);
      for (let r = 0; r < 4; r++) for (let k = 1; k <= 3 - Math.floor(r / 1.5); k++) f.set(sx + facing * k, sy - 3 + r, L[5]);
      f.set(sx - facing, sy - 1, L[5]);

      // the X marks where something's buried
      if (treasure) {
        const flick = Math.sin(clock * 2) > -0.3;
        for (let k = -1; k <= 1; k++) {
          f.set(treasure.x + k, treasure.y + k, flick ? ink : L[1]);
          f.set(treasure.x + k, treasure.y - k, flick ? ink : L[1]);
        }
      }

      // at night the huts light their windows
      if (night) for (const h of houses) f.set(h.window.x, h.window.y, glow);

      for (const g of gulls) {
        g.a += dt * 0.6;
        const gx = g.x + Math.cos(g.a) * g.r;
        const gy = g.y + Math.sin(g.a) * g.r * 0.6;
        const up = Math.floor(clock * 4 + g.p) % 2 === 0;
        f.set(gx, gy, L[5]);
        f.set(gx - 1, gy + (up ? -1 : 0), L[5]);
        f.set(gx + 1, gy + (up ? -1 : 0), L[5]);
      }

      // a compass rose, clear of the dissolving edge
      const ccx = W - Math.round(W * 0.09);
      const ccy = H - Math.round(W * 0.09);
      for (let k = -5; k <= 5; k++) {
        f.set(ccx, ccy + k, Math.abs(k) < 2 ? L[5] : ink);
        f.set(ccx + k, ccy, Math.abs(k) < 2 ? L[5] : ink);
      }
      for (let k = -2; k <= 2; k++) {
        f.set(ccx + k, ccy + k, ink);
        f.set(ccx + k, ccy - k, ink);
      }
      f.set(ccx, ccy - 6, L[5]);
    },
  };
  return place;
};
