export const LOOKS = ["prism", "graphite", "ember"] as const;
export type Look = (typeof LOOKS)[number];

export const DEFAULT_LOOK: Look = "prism";

/** which hues each look is allowed to land on */
export const HUE_RANGE: Record<Look, [number, number]> = {
  prism: [150, 360],
  graphite: [0, 360],
  ember: [0, 60],
};

export const LOOK_META: Record<Look, { name: string; blurb: string; swatch: string }> = {
  prism: {
    name: "prism",
    blurb: "the og. a new color every visit, grain and all",
    swatch: "linear-gradient(135deg, hsl(250 90% 62%), hsl(310 90% 62%))",
  },
  graphite: {
    name: "graphite",
    blurb: "quiet and sharp. one accent, nothing else",
    swatch: "linear-gradient(135deg, #16161a, #3a3a40)",
  },
  ember: {
    name: "ember",
    blurb: "warm, and a bit softer around the edges",
    swatch: "linear-gradient(135deg, hsl(14 85% 58%), hsl(42 85% 58%))",
  },
};

export function isLook(value: unknown): value is Look {
  return typeof value === "string" && (LOOKS as readonly string[]).includes(value);
}

/** pick a hue in range, and make sure it visibly differs from the current one */
export function randomHue(look: Look, avoid?: number): number {
  const [min, max] = HUE_RANGE[look];
  const span = max - min;
  for (let i = 0; i < 8; i++) {
    const hue = Math.floor(min + Math.random() * span);
    if (avoid === undefined || span < 90 || Math.abs(hue - avoid) > 40) return hue;
  }
  return Math.floor(min + Math.random() * span);
}

/**
 * runs before hydration so the first paint already has the right look and hue.
 * `?look=ember` in the url picks (and remembers) a look, handy for sharing one.
 * kept as a plain string because it has to be inlined into <head>.
 */
export const bootScript = `(function(){try{
var L=${JSON.stringify(LOOKS)};var R=${JSON.stringify(HUE_RANGE)};
var l=localStorage.getItem("look");
var q=new URLSearchParams(location.search).get("look");if(L.indexOf(q)>=0){l=q;localStorage.setItem("look",l);}
if(L.indexOf(l)<0)l=${JSON.stringify(DEFAULT_LOOK)};
var h=sessionStorage.getItem("hue:"+l);
if(h===null){var r=R[l];h=Math.floor(r[0]+Math.random()*(r[1]-r[0]));}
var d=document.documentElement;d.dataset.look=l;d.style.setProperty("--hue",String(h));
}catch(e){}})();`;
