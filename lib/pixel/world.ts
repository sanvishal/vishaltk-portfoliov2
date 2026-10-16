import { c, mix, mulberry32 } from "./frame";

/**
 * a small pixel planet, generated from one number. its surface is painted once into a flat
 * map (longitude × latitude) of palette indexes; each frame only looks pixels up in it, so
 * spinning the whole thing is cheap.
 */

export const TEX_W = 256;
export const TEX_H = 128;

/** 3d value noise, sampled on the sphere's surface so the maps wrap without a seam */
export function makeNoise3(rand: () => number) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rand() * 2 - 1;
  const v = (x: number, y: number, z: number) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const s = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const noise = (x: number, y: number, z: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = s(x - xi);
    const yf = s(y - yi);
    const zf = s(z - zi);
    return lerp(
      lerp(lerp(v(xi, yi, zi), v(xi + 1, yi, zi), xf), lerp(v(xi, yi + 1, zi), v(xi + 1, yi + 1, zi), xf), yf),
      lerp(
        lerp(v(xi, yi, zi + 1), v(xi + 1, yi, zi + 1), xf),
        lerp(v(xi, yi + 1, zi + 1), v(xi + 1, yi + 1, zi + 1), xf),
        yf,
      ),
      zf,
    );
  };
  return (x: number, y: number, z: number, octaves: number) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * f + o * 17.3, y * f - o * 9.1, z * f + o * 4.7);
      amp *= 0.5;
      f *= 2.05;
    }
    return sum;
  };
}

/**
 * four shades per colour: night, shadow, base, lit. shadows lean blue and highlights lean
 * toward the star's own colour, the way pixel artists hue-shift instead of just darkening.
 */
export function shades(rgb: number, star = 0xfff8dc): Uint32Array {
  return Uint32Array.from([c(mix(rgb, 0x0b1232, 0.84)), c(mix(rgb, 0x22357f, 0.4)), c(rgb), c(mix(rgb, star, 0.22))]);
}

export const KINDS = ["terran", "terran", "ocean", "desert", "ice", "lava", "gas", "gas", "barren"] as const;
export type Kind = (typeof KINDS)[number];

const GAS_SETS = [
  [0xe8d3b0, 0xc89b6e, 0xa8714a, 0xf2e6cf, 0xd9b48a],
  [0x9fd0f0, 0x5f9ad8, 0x3d6fc0, 0xcfe8fa, 0x7ab4e6],
  [0xf2d88a, 0xe0b45a, 0xc48a3a, 0xfaeab8, 0xd9a24a],
  [0xf0b8c8, 0xd88aa8, 0xb06690, 0xf8dce4, 0xc77aa0],
  [0xb8e0c0, 0x7cc0a0, 0x4f9a86, 0xe0f2e4, 0x9ad0b0],
];

export type World = {
  kind: Kind;
  /** palette index per map pixel */
  ground: Uint8Array;
  palette: Uint32Array[];
  /** palette entries that glow on the night side (lava, city lights) */
  glows: boolean[];
  /** 1 if a town sits here: lit at night */
  city: Uint8Array;
  /** 0 none, 1 thin, 2 thick */
  cloud: Uint8Array;
  cloudShades: [Uint32Array, Uint32Array];
  /** whether the water catches the sun (palette indexes) */
  water: boolean[];
  wind: number;
  tilt: number;
  atmosphere: number | null;
};

export function makeWorld(seed: number, kind: Kind, star: number): World {
  const rand = mulberry32(seed * 31 + 7);
  const fbm = makeNoise3(rand);
  const ground = new Uint8Array(TEX_W * TEX_H);
  const city = new Uint8Array(TEX_W * TEX_H);
  const cloud = new Uint8Array(TEX_W * TEX_H);
  const scale = 1.3 + rand() * 0.9;
  const ox = rand() * 100;
  const oy = rand() * 100;

  let base: number[];
  let glows: boolean[];
  let water: boolean[];
  let cloudCover = -1;
  let cloudTones: [number, number] = [0xffffff, 0xe4f1fc];
  let atmosphere: number | null = 0x9fd9ff;

  const craters = Array.from({ length: 14 }, () => {
    const lon = rand() * Math.PI * 2;
    const lat = Math.asin(rand() * 2 - 1);
    return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon), r: 0.08 + rand() * 0.2 };
  });
  const storm = { lat: (rand() - 0.5) * 1.2, lon: rand() * Math.PI * 2, w: 0.25 + rand() * 0.2, h: 0.1 + rand() * 0.06 };

  switch (kind) {
    case "terran":
    case "ocean":
      base = [0x1b4ca6, 0x2365c8, 0x3f93e4, 0xeed9a0, 0x7ec24c, 0x3f8c45, 0x8f8a6c, 0xf2f7fc, 0xd5eaf9, 0xd6b468];
      water = base.map((_, i) => i < 3);
      glows = base.map(() => false);
      cloudCover = 0.06 + rand() * 0.12;
      break;
    case "desert":
      base = [0x8f4a2a, 0xb4643a, 0xd08a4a, 0xe4b06a, 0xf0cf94, 0xf8e8c4];
      water = base.map(() => false);
      glows = base.map(() => false);
      cloudCover = rand() < 0.5 ? 0.3 : -1;
      cloudTones = [0xf8ead8, 0xe8d0b8];
      atmosphere = 0xf6c08a;
      break;
    case "ice":
      base = [0x3f6fa8, 0x6fa7d8, 0xa9d0ef, 0xd9ecfa, 0xf6fbff, 0x8fb8de];
      water = base.map((_, i) => i < 2);
      glows = base.map(() => false);
      cloudCover = 0.16;
      atmosphere = 0xcff0ff;
      break;
    case "lava":
      base = [0x1c1418, 0x2e2026, 0x4a3030, 0x6a4038, 0xff7a2a, 0xffc84a];
      water = base.map(() => false);
      glows = base.map((_, i) => i >= 4);
      cloudCover = 0.22;
      cloudTones = [0x6a5a5e, 0x4a3e44];
      atmosphere = 0xff9a5a;
      break;
    case "gas":
      base = GAS_SETS[Math.floor(rand() * GAS_SETS.length)].concat(0xb5523a);
      water = base.map(() => false);
      glows = base.map(() => false);
      atmosphere = null;
      break;
    default:
      base = [0x6e6a72, 0x8a8690, 0xa8a4ae, 0x56525a, 0xc4c0c8];
      water = base.map(() => false);
      glows = base.map(() => false);
      atmosphere = null;
  }

  const sea = kind === "ocean" ? 0.16 : -0.04 + rand() * 0.12;
  const gasBands = 5 + Math.floor(rand() * 6);

  for (let v = 0; v < TEX_H; v++) {
    const lat = (0.5 - (v + 0.5) / TEX_H) * Math.PI;
    const cl = Math.cos(lat);
    const y = Math.sin(lat);
    for (let u = 0; u < TEX_W; u++) {
      const lon = (u / TEX_W) * Math.PI * 2;
      const x = cl * Math.sin(lon);
      const z = cl * Math.cos(lon);
      const i = v * TEX_W + u;
      const h = fbm(x * scale + ox, y * scale, z * scale + oy, 6);
      let g = 0;

      if (kind === "terran" || kind === "ocean") {
        const e = h - sea;
        const wet = fbm(x * 2.3 - oy, y * 2.3 + 5, z * 2.3 + ox, 3);
        const ice = Math.abs(lat) + fbm(x * 4, y * 4, z * 4, 2) * 0.35;
        if (e < -0.16) g = 0;
        else if (e < -0.05) g = 1;
        else if (e < 0) g = 2;
        else if (e < 0.025) g = 3;
        else if (e < 0.14) g = wet < -0.12 ? 9 : 4;
        else if (e < 0.26) g = wet < -0.18 ? 9 : 5;
        else if (e < 0.36) g = 6;
        else g = 7;
        if (ice > 1.22) g = e < 0 ? 8 : 7;
        if ((g === 4 || g === 3 || g === 9) && fbm(x * 9 + 3, y * 9, z * 9 - 3, 2) > 0.16 && rand() > 0.55) city[i] = 1;
      } else if (kind === "desert") {
        const dunes = Math.sin((x * 14 + fbm(x * 3, y * 3, z * 3, 3) * 6) * 1.5) * 0.05;
        const e = h + dunes;
        g = e < -0.2 ? 0 : e < -0.08 ? 1 : e < 0.04 ? 2 : e < 0.16 ? 3 : e < 0.28 ? 4 : 5;
      } else if (kind === "ice") {
        const crack = Math.abs(fbm(x * 5 + 9, y * 5, z * 5, 3)) < 0.03;
        g = h < -0.15 ? 0 : h < -0.04 ? 1 : h < 0.1 ? 2 : h < 0.25 ? 3 : 4;
        if (crack && g > 1) g = 5;
      } else if (kind === "lava") {
        const river = Math.abs(fbm(x * 3 + 2, y * 3, z * 3, 4));
        g = h < -0.1 ? 0 : h < 0.05 ? 1 : h < 0.2 ? 2 : 3;
        if (river < 0.035) g = 5;
        else if (river < 0.07) g = 4;
      } else if (kind === "gas") {
        const swirl = fbm(x * 2, y * 7, z * 2, 4) * 1.6;
        g = Math.abs(Math.floor((y + 1) * gasBands * 0.5 + swirl)) % 5;
        const dLat = (lat - storm.lat) / storm.h;
        let dLon = lon - storm.lon;
        dLon = Math.atan2(Math.sin(dLon), Math.cos(dLon)) / storm.w;
        const sd = dLat * dLat + dLon * dLon;
        if (sd < 1) g = sd < 0.45 ? 5 : 3;
      } else {
        g = h < -0.1 ? 3 : h < 0.05 ? 0 : h < 0.2 ? 1 : 2;
        for (const cr of craters) {
          const d = Math.acos(Math.max(-1, Math.min(1, x * cr.x + y * cr.y + z * cr.z)));
          if (d < cr.r * 0.85) g = 3;
          else if (d < cr.r) g = 4;
        }
      }
      ground[i] = g;

      if (cloudCover > -1) {
        const cs = 2 + (kind === "lava" ? 1 : 0);
        const cv = fbm(x * cs + 40, y * cs * 1.6, z * cs - 40, 5);
        cloud[i] = cv > cloudCover + 0.1 ? 2 : cv > cloudCover ? 1 : 0;
      }
    }
  }

  return {
    kind,
    ground,
    palette: base.map((b) => shades(b, star)),
    glows,
    city,
    cloud,
    cloudShades: [shades(cloudTones[0], star), shades(cloudTones[1], star)],
    water,
    wind: 0.18 + rand() * 0.2,
    tilt: 0.25 + rand() * 0.25,
    atmosphere,
  };
}
