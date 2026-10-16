import { BAYER, bands, c, dith, mix, mixPacked, mulberry32, type Frame } from "./frame";
import type { PlaceMaker } from "./scene";
import { pick } from "./time";

const SKIES = [
  [0x1a0e30, 0x2a1644, 0x3e2058, 0x52286a, 0x5e2d6c],
  [0x0c1430, 0x142046, 0x1e2c5a, 0x2a3a6c, 0x34467a],
  [0x0e1e24, 0x142c34, 0x1c3a44, 0x264a54, 0x2e5660],
];
/** facades: wall, its shadow, trim */
const FACADES = [
  { wall: 0x5a3a3a, dark: 0x3e2828, trim: 0x8a6a5a, brick: true },
  { wall: 0x3a4a5a, dark: 0x283440, trim: 0x6a7a8a, brick: false },
  { wall: 0x4a5a4a, dark: 0x323e32, trim: 0x7a8a6a, brick: false },
  { wall: 0x6a5a3a, dark: 0x4a3e28, trim: 0x9a8a5a, brick: false },
  { wall: 0x5a3a4e, dark: 0x3e2836, trim: 0x8a6a7e, brick: true },
  { wall: 0x3e3a46, dark: 0x2a2832, trim: 0x6a6676, brick: true },
];
const SHOPS = ["cafe", "ramen", "konbini", "bar", "florist", "shut"] as const;
type Shop = (typeof SHOPS)[number];
const NEON = [0xff7ac0, 0x7ae0ff, 0xb8ff7a, 0xffd36a, 0xff8a5a];
const UMBRELLAS = [0xc63e5e, 0x2f6fb6, 0xf2c14e, 0x2e8a57, 0x1c1826, 0xe8e4da, 0x8a4ac0];

/**
 * a street at night in the rain, different every time: a run of shopfronts or two buildings
 * with an alley between, in brick or plaster, with whatever shops and signs the number gives
 * it. people pass under umbrellas, a car goes by now and then, steam rises from a grate, and
 * the lamps make the rain glow. the pointer is the wind; a click brings the lightning.
 */
export const rain: PlaceMaker = (seed, W, H) => {
  const rand = mulberry32(seed);
  const ground = Math.round(H * (0.66 + rand() * 0.06));
  const curb = ground + Math.max(3, Math.round(H * 0.045));
  const alley = rand() < 0.45;
  const sky = pick(rand, SKIES);

  const bg = new Uint32Array(W * H);
  const open = new Uint8Array(W * H).fill(1);
  const put = (x: number, y: number, rgb: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) {
      bg[y * W + x] = c(rgb);
      open[y * W + x] = 0;
    }
  };
  const rect = (x0: number, y0: number, w: number, h: number, rgb: number) => {
    for (let y = Math.round(y0); y < Math.round(y0 + h); y++) for (let x = Math.round(x0); x < Math.round(x0 + w); x++) put(x, y, rgb);
  };
  bg.set(bands(W, H, sky));

  // far off: a skyline of towers, a few windows lit
  for (let x = 0; x < W; x++) {
    const tw = Math.floor(x / 9);
    const h = Math.abs(Math.sin(tw * 12.9898 + seed) * 43758.5453) % 1;
    const top = Math.round(ground - H * (0.3 + h * 0.3));
    for (let y = top; y < ground; y++) {
      const lit = x % 3 === 1 && y % 3 === 0 && Math.abs(Math.sin(x * 7.1 + y * 3.3 + seed)) > 0.86;
      put(x, y, lit ? 0xd88a3a : mix(sky[1], 0x000000, 0.25));
    }
  }

  // a sign's lettering: blocky made-up glyphs, symmetric so they read as characters
  const glyphs = (x0: number, y0: number, n: number, col: number, vertical = false) => {
    const pix: number[] = [];
    const lay = (x: number, y: number) => {
      put(x, y, col);
      if (x >= 0 && x < W && y >= 0 && y < H) pix.push(y * W + x);
    };
    for (let g = 0; g < n; g++) {
      const gx = vertical ? x0 : x0 + g * 4;
      const gy = vertical ? y0 + g * 6 : y0;
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 2; x++) {
          if (rand() < 0.55) {
            lay(gx + x, gy + y);
            lay(gx + 2 - x, gy + y);
          }
        }
      }
    }
    return pix;
  };

  // ---- the buildings ----
  type Win = { x: number; y: number; w: number; h: number; lit: boolean; warm: boolean };
  const windows: Win[] = [];
  type Sign = { pix: number[]; col: number; off: number };
  const signs: Sign[] = [];
  const lanterns: { x: number; y: number; p: number }[] = [];
  const awnings: { x0: number; x1: number; y: number }[] = [];
  const shopLights: { x: number; y: number; w: number; h: number; col: number }[] = [];
  let alleyX = -1;
  let alleyW = 0;
  let cursor = -Math.floor(rand() * 12);
  while (cursor < W) {
    if (alley && alleyX < 0 && cursor > W * 0.3) {
      alleyX = cursor;
      alleyW = Math.round(W * (0.12 + rand() * 0.06));
      cursor += alleyW;
      continue;
    }
    const bw = Math.round(W * (0.16 + rand() * 0.14));
    const top = Math.round(ground - H * (0.42 + rand() * 0.38));
    const fac = pick(rand, FACADES);
    const x0 = cursor;
    const x1 = Math.min(W + 4, cursor + bw);
    // the wall, brick or plaster
    for (let y = Math.max(0, top); y < ground; y++) {
      for (let x = x0; x < x1; x++) {
        const row = Math.floor((y - top) / 3);
        const mortar = fac.brick && ((y - top) % 3 === 2 || (x + (row % 2) * 3) % 6 === 0);
        const speck = !fac.brick && (x * 13 + y * 7) % 17 === 0;
        put(x, y, mortar || speck ? fac.dark : fac.wall);
      }
    }
    // a cornice, and one dark edge so neighbours separate
    for (let x = x0; x < x1; x++) {
      put(x, top, fac.trim);
      put(x, top + 1, fac.dark);
    }
    for (let y = top; y < ground; y++) put(x1 - 1, y, mix(fac.dark, 0x000000, 0.3));
    // something on the roof
    const roof = rand();
    if (roof < 0.3) {
      const tx = x0 + 4 + Math.floor(rand() * Math.max(1, bw - 14));
      rect(tx, top - 9, 9, 6, 0x1c1424);
      for (const lx of [tx + 1, tx + 7]) rect(lx, top - 3, 1, 3, 0x1c1424);
    } else if (roof < 0.55) {
      const ax = x0 + 3 + Math.floor(rand() * Math.max(1, bw - 6));
      rect(ax, top - 14, 1, 14, 0x1c1424);
      rect(ax - 2, top - 11, 5, 1, 0x1c1424);
    } else if (roof < 0.75 && bw > 26) {
      // a lit billboard
      const bx = x0 + 3;
      const bww = bw - 7;
      rect(bx, top - 12, bww, 9, 0x1c1424);
      rect(bx + 1, top - 11, bww - 2, 7, pick(rand, [0x3a2a5a, 0x2a4a5a, 0x5a2a3a]));
      const bc = mix(pick(rand, NEON), 0xffffff, 0.3);
      signs.push({ pix: glyphs(bx + 3, top - 10, Math.floor((bww - 6) / 4), bc), col: bc, off: 0 });
      for (const lx of [bx + 2, bx + bww - 3]) rect(lx, top - 3, 1, 3, 0x1c1424);
    }
    // windows: plain, arched, or with a little balcony
    const style = pick(rand, ["plain", "arch", "balcony"] as const);
    const ww = 5 + Math.floor(rand() * 3);
    const wh = 7 + Math.floor(rand() * 3);
    const cols = Math.max(1, Math.floor((bw - 4) / (ww + 5)));
    const shopTop = ground - Math.round(H * 0.17);
    for (let wy = top + 5; wy + wh < shopTop - 4; wy += wh + 7) {
      for (let k = 0; k < cols; k++) {
        const wx = x0 + 4 + k * (ww + 5);
        if (wx + ww >= x1 - 2) continue;
        rect(wx - 1, wy - 1, ww + 2, wh + 2, mix(fac.trim, 0x000000, 0.3));
        if (style === "arch") {
          put(wx - 1, wy - 1, fac.wall);
          put(wx + ww, wy - 1, fac.wall);
        }
        windows.push({ x: wx, y: wy, w: ww, h: wh, lit: rand() < 0.35, warm: rand() < 0.8 });
        // the sill
        rect(wx - 2, wy + wh + 1, ww + 4, 1, fac.trim);
        if (style === "balcony") {
          rect(wx - 2, wy + wh + 2, ww + 4, 1, 0x1c1424);
          for (let bx = wx - 2; bx < wx + ww + 2; bx += 2) rect(bx, wy + wh - 1, 1, 3, 0x1c1424);
          if (rand() < 0.5) {
            put(wx, wy + wh, 0x4a9a48);
            put(wx + 1, wy + wh - 1, 0x6ab85a);
          }
        } else if (rand() < 0.25) {
          // an air conditioner
          rect(wx, wy + wh + 2, 5, 3, 0x7a7f90);
          put(wx + 1, wy + wh + 3, 0x5a5f70);
          put(wx + 3, wy + wh + 3, 0x5a5f70);
        }
      }
    }
    // the shop on the ground floor
    const shop: Shop = pick(rand, SHOPS);
    const sx0 = x0 + 2;
    const sx1 = x1 - 3;
    const sw = sx1 - sx0;
    if (sw > 10) {
      if (shop === "shut") {
        for (let y = shopTop + 3; y < ground; y++) rect(sx0, y, sw, 1, (y - shopTop) % 2 ? 0x2a2c40 : 0x363950);
      } else {
        const light = shop === "konbini" ? 0xe8fff4 : shop === "bar" ? 0xb84a6a : 0xf6c46a;
        const deep = shop === "konbini" ? 0x6a9a98 : shop === "bar" ? 0x4a1a34 : 0x9a5226;
        const gx0 = sx0 + 2;
        const gx1 = sx1 - 2;
        const gy0 = shopTop + 4;
        const gy1 = ground - 3;
        const doorX = gx0 + Math.floor(rand() * Math.max(1, gx1 - gx0 - 6));
        const pane = 7 + Math.floor(rand() * 5);
        // the wall round the glass: piers either side and a low sill
        rect(sx0, shopTop + 3, sw, ground - shopTop - 3, mix(fac.dark, 0x000000, 0.25));
        for (let y = gy0; y < ground; y++) {
          for (let x = gx0; x < gx1; x++) {
            const inDoor = x >= doorX && x < doorX + 5;
            if (y >= gy1 && !inDoor) continue;
            // the room: brightest under the ceiling lights, dimmer toward the floor
            const fall = (y - gy0) / (ground - gy0);
            let col = mix(light, deep, Math.min(1, fall * 1.1 + ((x * 5 + y * 3) % 7 === 0 ? 0.08 : 0)));
            if (inDoor) col = mix(col, 0x000000, 0.35);
            const mullion = !inDoor && ((x - gx0) % pane === pane - 1 || x === doorX - 1 || x === doorX + 5);
            if (mullion || y === gy0) col = 0x1e161c;
            put(x, y, col);
          }
        }
        // what's inside: shelves of goods, a counter with someone at it, lamps hung low
        if (shop === "konbini" || shop === "florist") {
          for (let sy = gy0 + 4; sy < gy1 - 1; sy += 4) {
            for (let x = gx0; x < gx1; x++) {
              if (x >= doorX - 1 && x <= doorX + 5) continue;
              if ((x - gx0) % pane === pane - 1) continue;
              put(x, sy, mix(deep, 0x000000, 0.2));
              if (rand() < 0.7) put(x, sy - 1, pick(rand, shop === "florist" ? [0xf08ab0, 0xf6d23a, 0x4a9a48, 0xe8402e, 0x4a9a48] : [0xe8402e, 0x2f6fb6, 0xf6d23a, 0x4a9a48, 0xffffff]));
            }
          }
        } else {
          const cy = gy1 - 4;
          for (let x = gx0; x < gx1; x++) {
            if (x >= doorX - 1 && x <= doorX + 5) continue;
            if ((x - gx0) % pane === pane - 1) continue;
            put(x, cy, mix(deep, 0x000000, 0.4));
            for (let y = cy + 1; y < gy1; y++) put(x, y, mix(deep, 0x000000, 0.2));
          }
          for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) {
            const px = gx0 + 2 + Math.floor(rand() * Math.max(1, gx1 - gx0 - 5));
            if (px >= doorX - 2 && px <= doorX + 6) continue;
            const shade = mix(deep, 0x000000, 0.55);
            rect(px, cy - 4, 2, 4, shade);
            rect(px, cy - 6, 2, 2, shade);
          }
          for (let lx = gx0 + 3; lx < gx1 - 2; lx += 6 + Math.floor(rand() * 4)) {
            put(lx, gy0 + 1, 0x1e161c);
            put(lx, gy0 + 2, mix(light, 0xffffff, 0.6));
          }
        }
        // a pale streak of reflection across the glass
        const rx = gx0 + Math.floor(rand() * Math.max(1, gx1 - gx0));
        for (let k = 0; k < 6; k++) {
          for (const dx of [0, 3]) {
            const x = rx + dx + k;
            const y = gy0 + 6 - k + dx;
            if (x < gx1 && y > gy0 && y < gy1) put(x, y, mix(light, 0xffffff, 0.45));
          }
        }
        shopLights.push({ x: gx0, y: gy0, w: gx1 - gx0, h: ground - gy0, col: light });
      }
      // the shop's sign, and its own touches
      const signCol = pick(rand, NEON);
      if (shop === "cafe" || shop === "florist") {
        const aw = pick(rand, [0xc63e5e, 0x2e8a57, 0x2f6fb6, 0xe0943a]);
        for (let y = shopTop - 2; y < shopTop + 3; y++) {
          for (let x = sx0 - 2; x < sx1 + 2; x++) {
            if (y === shopTop + 2 && (x - sx0) % 3 === 1) continue;
            put(x, y, y === shopTop - 2 ? mix(aw, 0x000000, 0.3) : Math.floor((x - sx0) / 3) % 2 ? 0xf0ece0 : aw);
          }
        }
        awnings.push({ x0: sx0 - 2, x1: sx1 + 2, y: shopTop + 3 });
        if (shop === "florist") {
          for (let k = 0; k < Math.floor(sw / 5); k++) {
            const px = sx0 + 2 + k * 5;
            rect(px, ground - 3, 3, 3, 0x8a5a3a);
            put(px + 1, ground - 4, pick(rand, [0xf08ab0, 0xf6d23a, 0xffffff, 0xe8402e]));
            put(px, ground - 4, 0x4a9a48);
            put(px + 2, ground - 4, 0x4a9a48);
          }
        }
      } else if (shop === "ramen") {
        // noren: cloth panels across the top of the doorway
        for (let k = 0; k < Math.floor(sw / 4); k++) rect(sx0 + 1 + k * 4, shopTop + 3, 3, 5, k % 2 ? 0x2a3a6a : 0x223058);
        for (let k = 0; k < 3; k++) lanterns.push({ x: sx0 + 3 + Math.floor(((sw - 6) * k) / 2), y: shopTop - 1, p: rand() * 6 });
      } else if (shop === "konbini") {
        rect(sx0, shopTop - 1, sw, 3, pick(rand, [0x2f8a6a, 0x2f6fb6, 0xe8402e]));
        rect(sx0, shopTop + 2, sw, 1, 0xf0ece0);
      }
      if (shop !== "shut") {
        // a sign board above, or a vertical one hanging off the edge
        if (shop === "bar" || rand() < 0.35) {
          const vx = x1 - 4;
          const vh = 14 + Math.floor(rand() * 8);
          const vy = shopTop - vh - 4;
          rect(vx - 2, vy, 5, vh, mix(signCol, 0x120a1a, 0.82));
          rect(vx - 1, vy - 2, 1, 2, 0x1c1424);
          signs.push({ pix: glyphs(vx - 1, vy + 2, Math.floor((vh - 3) / 6), signCol, true), col: signCol, off: 0 });
        } else {
          const bww = Math.min(sw - 4, 18 + Math.floor(rand() * 10));
          const bx = sx0 + Math.floor((sw - bww) / 2);
          rect(bx, shopTop - 10, bww, 7, mix(signCol, 0x120a1a, 0.82));
          signs.push({ pix: glyphs(bx + 2, shopTop - 9, Math.floor((bww - 3) / 4), signCol), col: signCol, off: 0 });
        }
      }
    }
    cursor = x1 + 1;
  }

  // the alley, if there is one: walls running back to a vanishing point, a far lamp
  if (alleyX >= 0) {
    const vx = alleyX + Math.round(alleyW / 2);
    const vy = Math.round(ground - H * 0.22);
    for (let x = alleyX; x < alleyX + alleyW; x++) {
      const t = Math.abs(x - vx) / (alleyW / 2);
      const top = Math.round(vy - 12 - (1 - t) * 0 - t * H * 0.3);
      for (let y = Math.max(0, top); y < ground; y++) {
        const floor = y > vy + (1 - t) * (ground - vy);
        put(x, y, floor ? 0x191220 : mix(0x2a1c30, 0x140a1e, 1 - t));
      }
      if (t > 0.3 && (x - alleyX) % 3 === 0) put(x, Math.round(vy - 4 + t * 10), 0xe8963a);
    }
    rect(vx - 2, vy - 6, 4, 6, 0x1d1428);
    put(vx, vy - 4, 0xffc46a);
  }

  // the sidewalk: slabs and a curb, then the road
  for (let y = ground; y < curb; y++) {
    for (let x = 0; x < W; x++) put(x, y, y === curb - 1 ? 0x5a5868 : x % 12 === 0 ? 0x24222e : 0x302e3c);
  }

  // lamps along the curb
  const lampCount = 1 + Math.floor(rand() * 2);
  const lamps = Array.from({ length: lampCount }, (_, k) => ({
    x: Math.round(W * ((k + 0.5) / lampCount) + (rand() - 0.5) * W * 0.15),
    y: Math.round(ground - H * (0.42 + rand() * 0.08)),
    cold: rand() < 0.3,
  }));
  for (const L of lamps) {
    const core = L.cold ? 0xe6fff4 : 0xffc860;
    const midc = L.cold ? 0x8fd6c0 : 0xf2913a;
    const warm = c(L.cold ? 0x9fe8d8 : 0xff9f45);
    // a wash of lamplight on everything near it, stepped and dithered
    for (let y = 0; y < curb; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - L.x, (y - L.y) * 1.2);
        const k = Math.max(0, 1 - d / (W * 0.28));
        const step = Math.floor(k * 4 + BAYER[(y & 3) * 4 + (x & 3)]);
        if (step > 0) bg[y * W + x] = mixPacked(bg[y * W + x], warm, step * 0.07);
      }
    }
    for (let y = L.y; y < curb; y++) {
      const half = 2 + (y - L.y) * 0.4;
      for (let x = Math.round(L.x - half); x <= L.x + half; x++) {
        if (x < 0 || x >= W) continue;
        const e = 1 - Math.abs(x - L.x) / half;
        if (e + dith(x, y) * 0.5 > 0.35) bg[y * W + x] = mixPacked(bg[y * W + x], warm, 0.12 + e * 0.08);
      }
    }
    for (let y = L.y - 12; y <= L.y + 12; y++) {
      for (let x = L.x - 12; x <= L.x + 12; x++) {
        const d = Math.hypot(x - L.x, y - L.y);
        if (d > 12) continue;
        const k = 1 - d / 12 + dith(x, y) * 0.35;
        if (k > 0.75) put(x, y, core);
        else if (k > 0.5) put(x, y, midc);
      }
    }
    rect(L.x + 3, L.y - 2, 1, curb - L.y + 1, 0x1a1420);
    rect(L.x - 2, L.y - 3, 6, 1, 0x1a1420);
    rect(L.x - 1, L.y - 1, 3, 1, 0xfff6d0);
  }

  // a vending machine, glowing, by a wall
  const vend = rand() < 0.6 ? { x: Math.round(W * (0.1 + rand() * 0.8)), col: pick(rand, [0xe8402e, 0x2f6fb6, 0xf0ece0]) } : null;
  if (vend) {
    rect(vend.x, ground - 10, 6, 10, vend.col);
    rect(vend.x + 1, ground - 9, 4, 5, 0xd8f0ff);
    for (let k = 0; k < 3; k++) put(vend.x + 1 + k, ground - 3, 0xffd36a);
  }

  // ---- the moving parts ----
  const walkers = Array.from({ length: 2 + Math.floor(rand() * 4) }, () => ({
    x: rand() * W,
    dir: rand() < 0.5 ? 1 : -1,
    speed: 6 + rand() * 6,
    lane: Math.floor(rand() * (curb - ground)),
    umb: pick(rand, UMBRELLAS),
    coat: pick(rand, [0x2c2638, 0x3a2a2a, 0x2a3a4a, 0x4a3a2a]),
    hood: rand() < 0.2,
    p: rand() * 6,
  }));
  const cat = awnings.length && rand() < 0.7 ? { x: Math.round((awnings[0].x0 + awnings[0].x1) / 2), y: ground - 1 } : null;
  const steam = rand() < 0.7 ? { x: Math.round(W * (0.15 + rand() * 0.7)), y: curb + 3 } : null;
  let car: { x: number; dir: number; col: number } | null = null;
  let nextCar = 3 + rand() * 6;

  const groundCol = c(0x161020);
  const drops = Array.from({ length: Math.round((W * H) / 110) }, () => ({ x: rand() * W, y: rand() * H, v: 150 + rand() * 60, depth: rand() }));
  const splashes: { x: number; y: number; age: number }[] = [];
  const drips = awnings.map((a) => ({ ...a, t: rand() }));

  let nextBolt = 4 + rand() * 6;
  let boltAge = 9;
  let bolt: { x: number; y: number }[] = [];
  const strike = () => {
    const cols: number[] = [];
    for (let x = 0; x < W; x++) if (open[2 * W + x]) cols.push(x);
    if (!cols.length) return;
    let x = cols[Math.floor(Math.random() * cols.length)];
    bolt = [];
    for (let y = 0; y < ground; y++) {
      if (y % 2 === 0) x += Math.round((Math.random() - 0.5) * 3);
      bolt.push({ x, y });
      if (Math.random() < 0.06) {
        let bx = x;
        for (let k = 1; k < 10; k++) {
          bx += Math.random() < 0.5 ? 1 : -1;
          bolt.push({ x: bx, y: y + k });
        }
      }
    }
    boltAge = 0;
  };

  let wind = 0.45;
  let clock = 0;

  const inLight = (x: number, y: number) => lamps.some((L) => (y > L.y && Math.abs(x - L.x) < 2 + (y - L.y) * 0.4) || Math.hypot(x - L.x, y - L.y) < 20);

  return {
    bloom: 1,
    hour: "night",
    draw(f: Frame, _t: number, dt: number, input) {
      clock += dt;
      // it always leans a little; the pointer pushes it further either way
      wind += (0.45 + input.lookX * 0.7 - wind) * Math.min(1, dt * 2);
      for (const click of input.clicks) {
        if (click.y < ground) {
          strike();
          nextBolt = 8 + Math.random() * 10;
        }
        for (let k = 0; k < 6; k++) splashes.push({ x: click.x + (Math.random() - 0.5) * 6, y: Math.max(curb + 1, click.y), age: 0.1 });
      }

      f.buf.set(bg);

      // windows: lit ones sometimes show someone passing; now and then a light goes on or off
      for (const w of windows) {
        if (Math.random() < dt * 0.02) w.lit = !w.lit;
        const shadowAt = w.lit ? Math.floor(((clock * 0.3 + w.x * 0.1) % 3) * w.w) : -99;
        for (let y = w.y; y < w.y + w.h; y++) {
          for (let x = w.x; x < w.x + w.w; x++) {
            const mullion = x === w.x + (w.w >> 1);
            let col = w.lit ? (mullion ? 0x6a3a28 : y < w.y + w.h * 0.4 ? (w.warm ? 0xf6b24a : 0xd8f0ff) : w.warm ? 0xe08636 : 0xa8d0e8) : mullion ? 0x2a2034 : (x + y) % 9 === 0 ? 0x2d2a52 : 0x15122a;
            if (w.lit && Math.abs(x - w.x - shadowAt) < 2 && y > w.y + 2) col = 0x3a2a28;
            f.set(x, y, c(col));
          }
        }
      }
      // signs flicker
      for (const s of signs) {
        if (s.off > 0) s.off -= dt;
        else if (Math.random() < dt * 0.15) s.off = 0.06 + Math.random() * 0.2;
        const on = s.off <= 0;
        if (on) continue;
        const col = c(mix(s.col, 0x1a1020, 0.75));
        for (const i of s.pix) f.buf[i] = col;
      }
      for (const l of lanterns) {
        const sx = l.x + Math.round(Math.sin(clock * 1.5 + l.p) * 0.6);
        f.set(sx, l.y, c(0xe0503a));
        f.set(sx, l.y + 1, c(0xff8a4a));
        f.set(sx - 1, l.y + 1, c(0xe0503a));
        f.set(sx + 1, l.y + 1, c(0xe0503a));
        f.set(sx, l.y + 2, c(0xe0503a));
      }
      if (vend && Math.sin(clock * 0.7) > -0.9) f.set(vend.x + 2, ground - 7, c(0xffffff));

      // people walking by under umbrellas
      for (const p of walkers) {
        p.x += p.dir * p.speed * dt;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        const feet = ground + p.lane;
        const x = Math.round(p.x);
        const step = Math.floor(clock * 6 + p.p) % 2;
        f.set(x - 1 + step, feet, c(0x14101c));
        f.set(x + 1 - step, feet, c(0x14101c));
        for (let y = feet - 7; y < feet; y++) {
          f.set(x - 1, y, c(p.coat));
          f.set(x, y, c(p.coat));
          f.set(x + 1, y, c(mix(p.coat, 0x000000, 0.3)));
        }
        f.set(x, feet - 8, c(0xd9a07a));
        if (p.hood) {
          f.set(x - 1, feet - 9, c(p.coat));
          f.set(x, feet - 9, c(p.coat));
          f.set(x + 1, feet - 9, c(p.coat));
        } else {
          for (let k = -5; k <= 5; k++) {
            const hgt = Math.round(Math.sqrt(Math.max(0, 25 - k * k)) * 0.5);
            for (let y = feet - 10 - hgt; y <= feet - 10; y++) f.set(x + k, y, c(y === feet - 10 - hgt ? mix(p.umb, 0xffffff, 0.25) : k * p.dir > 1 ? mix(p.umb, 0x000000, 0.25) : p.umb));
          }
          for (let y = feet - 10; y < feet - 7; y++) f.set(x, y, c(0x14101c));
        }
      }
      // a cat sheltering under an awning
      if (cat) {
        const tail = Math.sin(clock * 2) > 0 ? -1 : 0;
        f.set(cat.x, cat.y, c(0x1a1420));
        f.set(cat.x + 1, cat.y, c(0x1a1420));
        f.set(cat.x + 2, cat.y, c(0x1a1420));
        f.set(cat.x + 2, cat.y - 1, c(0x1a1420));
        f.set(cat.x + 2, cat.y - 2, c(0x1a1420));
        f.set(cat.x + 3, cat.y - 2, c(0x1a1420));
        f.set(cat.x - 1, cat.y - 1 + tail, c(0x1a1420));
        f.set(cat.x + 3, cat.y - 1, c(0xf6d23a));
      }

      // lightning: the sky flashes twice, the street goes pale, then the dark comes back
      nextBolt -= dt;
      if (nextBolt <= 0) {
        strike();
        nextBolt = 9 + Math.random() * 14;
      }
      boltAge += dt;
      const flash = boltAge < 0.07 ? 1 : boltAge < 0.14 ? 0.15 : boltAge < 0.24 ? 0.8 : boltAge < 0.6 ? ((0.6 - boltAge) / 0.36) * 0.35 : 0;
      if (flash > 0) {
        const skyLit = c(0xd8d0ff);
        const wallLit = c(0x8478b8);
        for (let i = 0; i < curb * W; i++) f.buf[i] = open[i] ? mixPacked(f.buf[i], skyLit, 0.75 * flash) : mixPacked(f.buf[i], wallLit, 0.15 * flash);
        if (boltAge < 0.3) {
          for (const p of bolt) {
            if (p.x < 0 || p.x >= W || p.y < 0 || p.y >= H || !open[p.y * W + p.x]) continue;
            f.buf[p.y * W + p.x] = c(0xffffff);
          }
        }
      }

      // the wet road: everything above, flipped, stretched, broken into strips, darker
      for (let y = curb; y < H; y++) {
        const d = y - curb;
        if (d % 4 === 3) {
          f.buf.fill(groundCol, y * W, y * W + W);
          continue;
        }
        const src = Math.max(0, curb - 1 - Math.floor(d * 1.8));
        const wob = Math.round(Math.sin(d * 1.3 + clock * 3) * 0.8);
        for (let x = 0; x < W; x++) {
          const sx = Math.min(W - 1, Math.max(0, x + wob));
          f.buf[y * W + x] = mixPacked(f.buf[src * W + sx], groundCol, 0.5 + d * 0.012);
        }
      }

      // a car now and then, headlights cutting through the rain and streaking the wet road
      nextCar -= dt;
      if (!car && nextCar <= 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        car = { x: dir > 0 ? -24 : W + 24, dir, col: pick(Math.random, [0xd8a02a, 0x2a2a3a, 0xa8302a, 0xe8e4da]) };
      }
      if (car) {
        car.x += car.dir * 38 * dt;
        const cy = curb + Math.round((H - curb) * 0.35);
        const x = Math.round(car.x);
        const front = car.dir > 0 ? x + 9 : x - 9;
        // the beams
        for (let k = 1; k < 34; k++) {
          const bx = front + car.dir * k;
          const half = 1 + k * 0.18;
          for (let y = Math.round(cy - 2 - half * 0.4); y <= cy - 2 + half * 0.6; y++) {
            if (bx < 0 || bx >= W || y < 0 || y >= H) continue;
            if (dith(bx, y) + (1 - k / 34) > 0.6) f.buf[y * W + bx] = mixPacked(f.buf[y * W + bx], c(0xfff2c0), 0.3 * (1 - k / 34));
          }
        }
        for (let y = cy - 4; y < cy; y++) for (let k = -9; k <= 9; k++) f.set(x + k, y, c(y === cy - 4 && Math.abs(k) > 5 ? 0x14101c : car.col));
        for (let k = -5; k <= 5; k++) f.set(x + k, cy - 5, c(car.col));
        for (let k = -4; k <= 4; k++) if (k !== 0) f.set(x + k, cy - 4, c(0x8ab0d0));
        f.set(x - 7, cy, c(0x0a0810));
        f.set(x + 7, cy, c(0x0a0810));
        f.set(front, cy - 2, c(0xfff6d0));
        f.set(car.dir > 0 ? x - 9 : x + 9, cy - 2, c(0xff3030));
        // the headlights' streak on the wet road
        for (let y = cy + 1; y < H; y += 2) f.set(front + Math.round(Math.sin(y + clock * 4) * 0.6), y, c(0xd8b878));
        if (car.x < -30 || car.x > W + 30) {
          car = null;
          nextCar = 6 + Math.random() * 10;
        }
      }

      // steam from a grate in the road
      if (steam) {
        for (let k = 0; k < 10; k++) {
          const t = ((clock * 0.35 + k / 10) % 1 + 1) % 1;
          const sx = steam.x + Math.sin(clock + k * 2) * 2 + t * wind * 10 + (k % 3) - 1;
          const sy = steam.y - t * 16;
          const xi = Math.round(sx);
          const yi = Math.round(sy);
          if (xi >= 0 && xi < W && yi >= 0 && yi < H) f.buf[yi * W + xi] = mixPacked(f.buf[yi * W + xi], c(0x9a92b0), 0.45 * (1 - t));
        }
        f.set(steam.x - 1, steam.y + 1, c(0x0a0810));
        f.set(steam.x + 1, steam.y + 1, c(0x0a0810));
      }

      // drips off the awnings
      for (const d of drips) {
        d.t = (d.t + dt * 1.6) % 1;
        const y = Math.round(d.y + d.t * (ground - d.y));
        for (let x = d.x0 + 2; x < d.x1; x += 5) f.set(x + ((x * 7) % 3), y, c(0x8ab0d0));
      }

      // rain, leaning with the wind, catching the lamplight where it falls through it
      const lean = wind * 0.5;
      for (const p of drops) {
        p.y += p.v * dt * (0.7 + p.depth * 0.5);
        p.x += lean * p.v * dt;
        const land = curb + p.depth * (H - curb - 1);
        if (p.y > land) {
          splashes.push({ x: p.x, y: land, age: 0 });
          p.y = -4 - Math.random() * 20;
          p.x = Math.random() * (W + 40) - 20 - lean * 40;
        }
        const lit = inLight(p.x, p.y);
        const col = c(lit ? (p.depth > 0.5 ? 0xffd27a : 0xd98a45) : p.depth > 0.5 ? 0xa7b4d4 : 0x6c6f9a);
        const len = p.depth > 0.5 ? 4 : 3;
        for (let k = 0; k < len; k++) f.set(Math.round(p.x - lean * k), p.y - k, col);
      }
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.age += dt;
        if (s.age > 0.35) {
          splashes.splice(i, 1);
          continue;
        }
        const col = c(inLight(s.x, s.y - 20) ? 0xe7a35a : 0x8c93bd);
        if (s.age < 0.1) {
          f.set(s.x - 1, s.y - 1, col);
          f.set(s.x + 1, s.y - 1, col);
        } else {
          const r = 1 + Math.round((s.age - 0.1) * 8);
          f.set(s.x - r, s.y, col);
          f.set(s.x + r, s.y, col);
        }
      }
    },
  };
};
