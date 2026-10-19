import {
  Bangers,
  Bebas_Neue,
  Monoton,
  Permanent_Marker,
  Playfair_Display,
  Rubik_Glitch,
  Silkscreen,
  Special_Elite,
} from "next/font/google";

// the faces the glitching letters flicker through. none of them is preloaded: they're only
// fetched once the page is idle, so they never hold up the first paint. (next/font needs each
// call's options written out in full.)

export const bangers = Bangers({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--vf-bangers",
});
export const bebas = Bebas_Neue({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--vf-bebas",
});
export const monoton = Monoton({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--vf-monoton",
});
export const marker = Permanent_Marker({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--vf-marker",
});
export const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "900",
  style: "italic",
  variable: "--vf-playfair",
});
export const rubikGlitch = Rubik_Glitch({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--vf-glitch",
});
export const silkscreen = Silkscreen({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "700",
  variable: "--vf-silk",
});
export const elite = Special_Elite({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: "400",
  variable: "--vf-elite",
});

export const verseFontVars = [
  bangers,
  bebas,
  monoton,
  marker,
  playfair,
  rubikGlitch,
  silkscreen,
  elite,
]
  .map((f) => f.variable)
  .join(" ");
