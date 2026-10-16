import { mix } from "./frame";

/**
 * the hour a place is painted at. it sets the sky, the clouds, the water, how everything on
 * the ground is tinted, and whether there's a sun, a moon or stars. the page theme decides
 * which hours are on offer (daylight for light, evening for dark); the seed picks one.
 */
export type Time = {
  name: "dawn" | "day" | "golden" | "dusk" | "night";
  sky: number[];
  /** five cloud tones, lit to shaded */
  cloud: number[];
  sea: number[];
  /** tints anything drawn in its daylight colours */
  tone: (rgb: number) => number;
  sun: { color: number; glow: number; height: number } | null;
  moon: boolean;
  stars: boolean;
  /** lamps, windows: are they on? */
  lightsOn: boolean;
  /** the bright seam where sea meets sky */
  seam: number;
  /** small highlights on water */
  glint: number;
};

const toward = (to: number, amount: number) => (rgb: number) => mix(rgb, to, amount);

const TIMES: Record<Time["name"], Time> = {
  dawn: {
    name: "dawn",
    sky: [0x3b4a96, 0x5f67b0, 0x9a82be, 0xd99fbb, 0xf3c3ad],
    cloud: [0xfff3ec, 0xf9d9d8, 0xe4b5c6, 0xbb93b9, 0x8f78aa],
    sea: [0xe9b7bf, 0x7d7cb7, 0x5c63a6, 0x474f93, 0x384083],
    tone: toward(0x6a5a9a, 0.22),
    sun: { color: 0xfff0d6, glow: 0xf8c6b8, height: 0.08 },
    moon: false,
    stars: false,
    lightsOn: false,
    seam: 0xfde3d4,
    glint: 0xf6cfd2,
  },
  day: {
    name: "day",
    sky: [0x0d56c0, 0x1569d2, 0x2280df, 0x3797e8, 0x5aaeef, 0x8ac7f4],
    cloud: [0xffffff, 0xeef6fd, 0xd2e8f9, 0xaed0f1, 0x8bb9e7],
    sea: [0x5aaeef, 0x2d86d7, 0x2276c9, 0x1b67bb, 0x1659ab],
    tone: (rgb) => rgb,
    sun: null,
    moon: false,
    stars: false,
    lightsOn: false,
    seam: 0xbfe3fb,
    glint: 0x9ad0f5,
  },
  golden: {
    name: "golden",
    sky: [0x2a68bd, 0x4b86cf, 0x86acd8, 0xd8c39d, 0xf4b56c],
    cloud: [0xfff5df, 0xffe1ad, 0xf1bf88, 0xc8998a, 0x987b96],
    sea: [0xf2c27e, 0x4f7fb9, 0x3d6aa9, 0x305997, 0x264a85],
    tone: toward(0xff9a40, 0.12),
    sun: { color: 0xfff1b8, glow: 0xffc46e, height: 0.14 },
    moon: false,
    stars: false,
    lightsOn: false,
    seam: 0xffe2a8,
    glint: 0xffd890,
  },
  dusk: {
    name: "dusk",
    sky: [0x181444, 0x372164, 0x713877, 0xc0546b, 0xee8a5c],
    cloud: [0xf8a982, 0xd57f7f, 0x9d5c7d, 0x6b4571, 0x46315f],
    sea: [0xf09a6a, 0x5d3a72, 0x452c63, 0x342453, 0x271c44],
    tone: toward(0x2a1a50, 0.42),
    sun: { color: 0xffd08a, glow: 0xf2774f, height: 0.02 },
    moon: false,
    stars: true,
    lightsOn: true,
    seam: 0xffb98a,
    glint: 0xf6a679,
  },
  night: {
    name: "night",
    sky: [0x050a20, 0x081028, 0x0c1634, 0x111e42, 0x182851, 0x22335f],
    cloud: [0x8e9cc4, 0x7282ad, 0x5a6994, 0x46537c, 0x343f65],
    sea: [0x2c3f72, 0x1c2c5c, 0x12204a, 0x0e1a3f, 0x0b1535],
    tone: toward(0x0a1440, 0.64),
    sun: null,
    moon: true,
    stars: true,
    lightsOn: true,
    seam: 0x2c3f72,
    glint: 0x3a5590,
  },
};

export function pickTime(rand: () => number, night: boolean, force?: "day" | "night"): Time {
  const options: Time["name"][] = night ? ["dusk", "night", "night"] : ["dawn", "day", "day", "day", "golden"];
  // always draw from the seed, so forcing the hour doesn't shuffle the rest of the place
  const picked = TIMES[options[Math.floor(rand() * options.length)]];
  return force ? TIMES[force] : picked;
}

/** pick one of a list with the seeded random */
export const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)];
