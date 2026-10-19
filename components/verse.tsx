"use client";

import { useEffect, useRef } from "react";
import { verseFontVars } from "@/lib/verse-fonts";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const chance = (p: number) => Math.random() < p;

/** the inks: each with the colour of the letter that reads on top of it */
const INKS = [
  { c: "#ff2e88", on: "#fff6fb" },
  { c: "#12d8ff", on: "#06141a" },
  { c: "#ffe14a", on: "#17120a" },
  { c: "#ff3b2f", on: "#fff6f0" },
  { c: "#36f28a", on: "#04170c" },
  { c: "#8b5cff", on: "#f6f2ff" },
  { c: "#2f6bff", on: "#f2f6ff" },
  { c: "#ff8a1f", on: "#1a0d02" },
] as const;
/** mostly the inks, sometimes any loud colour at all */
const ink = () => (chance(0.7) ? pick(INKS) : { c: `hsl(${Math.round(rand(0, 360))} 95% 60%)`, on: "#111" });

/** the faces a letter can flicker into, next/font's ones plus a couple of the page's own, pushed */
const FACES = [
  { family: "var(--vf-bangers)" },
  { family: "var(--vf-bebas)" },
  { family: "var(--vf-monoton)" },
  { family: "var(--vf-marker)" },
  { family: "var(--vf-playfair)", style: "italic", weight: "900" },
  { family: "var(--vf-glitch)" },
  { family: "var(--vf-silk)", weight: "700" },
  { family: "var(--vf-elite)" },
  { family: "var(--font-mono)", weight: "700" },
  { family: "var(--font-sans)", weight: "800", stretch: "'wdth' 75" },
  { family: "var(--font-sans)", weight: "200" },
] as const;

/**
 * how a letter can look for a frame, after the spider-verse logo glitches: plates out of
 * register, halftone dot matrix, a solid fill with coloured fringes, torn in two, a bare
 * outline, scanlines, on a caption box, knocked out of a black box, barely there, a gradient
 * fill, stripes, an inked comic letter, or neon
 */
const STATES = [
  ["split", 3],
  ["dots", 3],
  ["solid", 2],
  ["tear", 2],
  ["outline", 2],
  ["scan", 2],
  ["box", 2],
  ["knock", 1],
  ["ghost", 1],
  ["gradient", 2],
  ["stripes", 2],
  ["comic", 2],
  ["neon", 1],
] as const;
const TOTAL = STATES.reduce((a, [, w]) => a + w, 0);
const pickState = () => {
  let r = Math.random() * TOTAL;
  for (const [s, w] of STATES) if ((r -= w) < 0) return s;
  return STATES[0][0];
};

/** on top of the look: a warp of the letter's shape, each now and then */
const warp = () => {
  const r = Math.random();
  if (r < 0.1) return "scaleX(-1)"; // mirrored
  if (r < 0.15) return "rotate(180deg)"; // upside down
  if (r < 0.27) return `scale(${rand(0.6, 0.8)}, ${rand(1.3, 1.7)})`; // stretched tall
  if (r < 0.37) return `scale(${rand(1.3, 1.6)}, ${rand(0.6, 0.8)})`; // squashed flat
  if (r < 0.45) return `rotate(${rand(-40, 40)}deg)`; // knocked over
  return "";
};

/** and a treatment around it, built from drop shadows so it sits on any look */
const treat = (c1: string, c2: string, c3: string) => {
  const r = Math.random();
  if (r < 0.15) return `drop-shadow(0.03em 0.03em 0 ${c2}) drop-shadow(0.03em 0.03em 0 ${c2}) drop-shadow(0.03em 0.03em 0 ${c3})`; // extruded
  if (r < 0.27) return `drop-shadow(-0.09em 0 0 color-mix(in oklab, ${c1} 55%, transparent)) drop-shadow(-0.12em 0 0 color-mix(in oklab, ${c2} 35%, transparent))`; // smeared
  if (r < 0.37) return "drop-shadow(0 0 0.02em #fff) drop-shadow(0 0 0.02em #fff) drop-shadow(0 0 0.01em #fff) drop-shadow(0.04em 0.06em 0 rgb(0 0 0 / 0.35))"; // a sticker
  if (r < 0.49) return `drop-shadow(0 0 0.12em ${c1})`; // glowing
  if (r < 0.54) return "blur(0.02em)"; // sprayed
  return "";
};

/** how big a letter is for a frame: mostly its own size, often blown up, sometimes shrunk */
const size = () => (chance(0.38) ? rand(1.2, 1.95) : chance(0.12) ? rand(0.6, 0.85) : 1);

const BURST = 2000;

/**
 * a few words that every so often glitch the way the titles do in the spider-verse films. for
 * about two seconds every letter goes its own way, frame by frame: it cuts between
 * looks, warps, treatments, typefaces, sizes, colours, case and angle, holding some frames for
 * two or three beats and snapping back to itself for one now and then, and once in a while the
 * whole lot cuts to the same look together. the frames come at an uneven, stop-motion rate.
 * letters start in a ripple from a random one and settle at their own times, then all of it
 * sits still for a few seconds. hovering sets it off too. with reduced motion it stays put.
 *
 * none of it touches the layout: each letter's own glyph stays in the line, just turned
 * invisible, and the glitch is drawn in a layer laid over it.
 */
export function Verse({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = [...el.querySelectorAll<HTMLElement>(".vl")];
    const mods = letters.map((l) => l.querySelector<HTMLElement>(".vl-mod")!);
    let visible = true;
    let running = false;
    let wait = 0;
    let frame = 0;

    // fetch the faces once the page has settled, so the first burst already has them
    const warm = window.setTimeout(() => {
      const cs = getComputedStyle(el);
      for (const f of FACES) {
        const fam = f.family.match(/--[\w-]+/)?.[0];
        const value = fam && cs.getPropertyValue(fam);
        if (value && fam?.startsWith("--vf"))
          document.fonts.load(`${"style" in f ? f.style : ""} ${"weight" in f ? f.weight : 400} 1em ${value}`).catch(() => {});
      }
    }, 1500);

    const rest = (k: number) => {
      delete letters[k].dataset.s;
      mods[k].removeAttribute("style");
    };

    const look = (k: number, state: string) => {
      const l = letters[k];
      l.dataset.s = state;
      const s = l.style;
      const [a, b, c] = [ink(), ink(), ink()];
      s.setProperty("--c1", a.c);
      s.setProperty("--c2", b.c);
      s.setProperty("--c3", c.c);
      s.setProperty("--on", a.on);
      s.setProperty("--x", `${rand(-0.1, 0.1)}em`);
      s.setProperty("--y", `${rand(-0.09, 0.09)}em`);
      s.setProperty("--r", `${chance(0.3) ? rand(-18, 18) : rand(-5, 5)}deg`);
      s.setProperty("--k", `${chance(0.25) ? rand(-16, 16) : 0}deg`);
      s.setProperty("--d", `${rand(0.03, 0.14) * (chance(0.5) ? -1 : 1)}em`);
      s.setProperty("--dot", `${rand(0.07, 0.22)}em`);
      s.setProperty("--cut", `${rand(20, 80)}%`);
      s.setProperty("--ang", `${Math.round(rand(0, 360))}deg`);
      const m = mods[k].style;
      const face = chance(0.6) ? pick(FACES) : null;
      m.fontFamily = face?.family ?? "";
      m.fontStyle = face && "style" in face ? face.style : "";
      m.fontWeight = face && "weight" in face ? face.weight : "";
      m.fontVariationSettings = face && "stretch" in face ? face.stretch : "";
      m.textTransform = chance(0.32) ? "uppercase" : "";
      // blown up, a box would swallow its neighbours, so boxed letters only grow a little
      m.fontSize = `${state === "box" || state === "knock" ? Math.min(size(), 1.3) : size()}em`;
      m.transform = warp();
      m.filter = treat(a.c, b.c, c.c);
    };

    const burst = () => {
      if (running) return;
      running = true;
      // a ripple out from a random letter, roughed up; each settles on its own
      const origin = Math.floor(Math.random() * letters.length);
      const step = rand(15, 50);
      const span = letters.map((_, k) => ({
        start: Math.abs(k - origin) * step + rand(0, 160),
        end: rand(BURST * 0.7, BURST),
      }));
      el.dataset.glitch = "";
      const t0 = performance.now();

      const tick = () => {
        const t = performance.now() - t0;
        // sometimes the whole word cuts to one look at once
        const together = chance(0.16) ? pickState() : null;
        letters.forEach((l, k) => {
          const { start, end } = span[k];
          if (t < start) return;
          if (t > end) return rest(k);
          if (l.dataset.s && !together && chance(0.28)) return; // hold this frame a beat longer
          if (!together && chance(0.1)) return rest(k); // snap back to itself for a frame
          look(k, together ?? pickState());
        });
        if (t < BURST) {
          // uneven frames, mostly on twos, sometimes threes, now and then a quick one
          frame = window.setTimeout(tick, pick([83, 83, 83, 125, 125, 42, 62]));
        } else {
          letters.forEach((_, k) => rest(k));
          delete el.dataset.glitch;
          running = false;
        }
      };
      tick();
    };

    const loop = (delay: number) => {
      wait = window.setTimeout(() => {
        if (visible && !document.hidden) burst();
        loop(rand(4000, 6800));
      }, delay);
    };
    loop(1300);

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    el.addEventListener("pointerenter", burst);
    return () => {
      clearTimeout(warm);
      clearTimeout(wait);
      clearTimeout(frame);
      io.disconnect();
      el.removeEventListener("pointerenter", burst);
    };
  }, []);

  return (
    <span ref={ref} className={`verse ${verseFontVars}`}>
      <span className="sr-only">{children}</span>
      <span aria-hidden>
        {[...children].map((ch, k) =>
          ch === " " ? (
            " "
          ) : (
            <span key={k} className="vl">
              <span className="vl-rest">{ch}</span>
              <span className="vl-fx">
                <span className="vl-mod">
                  <span className="vl-box" />
                  <span className="vl-ink">{ch}</span>
                  <span className="vl-a">{ch}</span>
                  <span className="vl-b">{ch}</span>
                </span>
              </span>
            </span>
          ),
        )}
      </span>
    </span>
  );
}
