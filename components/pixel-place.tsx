"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SkipForward } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { BAYER, Frame, bloom, mixPacked, mulberry32 } from "@/lib/pixel/frame";
import { makeNoise3 } from "@/lib/pixel/world";
import { SEED_MAX, clickFor, firstSeed, nextSeed, nodFor, placeFor, sameKindSeed } from "@/lib/pixel/places";
import type { Input, Place } from "@/lib/pixel/scene";
import { usePageState } from "@/lib/state";
import { startTilt, tilt } from "@/lib/tilt";

// which place is showing. picked on the client (or from ?place=), so the server renders none.
// a fresh visit always opens on the flower fields.
let seed: number | null = null;
// while one place is still giving way to the next, asks for another are ignored
let busy = false;
const listeners = new Set<() => void>();
const change = (pick: (s: number) => number) => {
  if (busy) return;
  busy = true;
  seed = pick(placeStore.get());
  listeners.forEach((l) => l());
  setTimeout(() => {
    busy = false;
    listeners.forEach((l) => l());
  }, 1200);
};
const placeStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    if (seed === null) {
      const q = Number.parseInt(new URLSearchParams(location.search).get("place") ?? "", 10);
      seed = q > 0 && q <= SEED_MAX ? q : firstSeed();
    }
    return seed;
  },
  busy: () => busy,
  next: () => change(nextSeed),
  again: () => change(sameKindSeed),
};

const edgeNoise = makeNoise3(mulberry32(7));

/**
 * the picture's edge: a crisp pixel line round a rounded rectangle that wobbles in and out
 * with slow noise. each pixel near the border keeps its distance in, and is cut away
 * whenever the wobbling line passes over it.
 */
function edgeBand(W: number, H: number) {
  const band = Math.max(4, Math.round(W * 0.03));
  const radius = band * 2;
  const idx: number[] = [];
  const dist: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.min(x, W - 1 - x);
      const dy = Math.min(y, H - 1 - y);
      // distance inside a rounded rectangle
      const d = dx < radius && dy < radius ? radius - Math.hypot(radius - dx, radius - dy) : Math.min(dx, dy);
      if (d < band) {
        idx.push(y * W + x);
        dist.push(d / band);
      }
    }
  }
  return { W, idx: Int32Array.from(idx), dist: Float32Array.from(dist) };
}

function applyEdge(buf: Uint32Array, e: ReturnType<typeof edgeBand>, t: number) {
  for (let k = 0; k < e.idx.length; k++) {
    const i = e.idx[k];
    const x = i % e.W;
    const y = (i / e.W) | 0;
    // low frequency, so the line swells in broad soft bumps rather than jagging
    const n = edgeNoise(x * 0.045, y * 0.045, t * 0.25, 2);
    const line = 0.15 + Math.min(1, Math.max(0, n * 0.75 + 0.5)) * 0.8;
    if (e.dist[k] < line) buf[i] = 0;
  }
}

/** how long the dust takes to clear, in seconds */
const SCATTER = 2.6;

/**
 * how one place gives way to the next: the old picture comes apart into dust. it lets go in
 * soft patches behind one clean, noise-shaped line that sweeps across like a gust, away from
 * where you clicked, with the new place already there underneath; a few of its pixels ease
 * into the air and drift off with the gust along a slowly curling current, fading into what
 * they pass over. on a first visit it runs backwards, and the dust
 * settles into the picture instead.
 */
function makeDust(W: number, H: number, ox: number) {
  const n = W * H;
  const rel = new Float32Array(n);
  const life = new Float32Array(n);
  const len = new Float32Array(n);
  const ang = new Float32Array(n);
  const curl = new Float32Array(n);
  const fly = new Uint8Array(n);
  const rand = mulberry32(Math.floor(Math.random() * 1e9));
  const z = rand() * 100;
  // a gust blows across from one side: away from where you clicked, or either way from the middle
  const dir = ox < W * 0.4 ? 1 : ox > W * 0.6 ? -1 : rand() < 0.5 ? 1 : -1;
  const base = dir > 0 ? -0.3 : Math.PI + 0.3;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // neighbours share their timing and their current, so they move as one soft sheet
      const patch = edgeNoise(x * 0.035, y * 0.035, z, 2);
      const flow = edgeNoise(x * 0.02, y * 0.02, z + 40, 2);
      const across = dir > 0 ? x / W : 1 - x / W;
      // the front frays in an ordered dither: across a narrow band, pixels go in a checker
      // pattern, so the old place thins out before it's gone instead of ending on a flat line
      const fray = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) * 0.12;
      rel[i] = Math.max(0, 0.12 + across * 0.85 + (y / H) * 0.12 + patch * 0.3) + fray;
      life[i] = 0.5 + rand() * 0.5;
      len[i] = 18 + patch * 8 + rand() * 8;
      ang[i] = base + flow * 0.9;
      curl[i] = edgeNoise(x * 0.02, y * 0.02, z + 80, 2) * 1.6;
      // only some become dust; the rest just let go, so the air never gets crowded
      fly[i] = rand() < 0.16 ? 1 : 0;
    }
  }
  return { rel, life, len, ang, curl, fly };
}

function scatter(buf: Uint32Array, src: Uint32Array, d: ReturnType<typeof makeDust>, W: number, H: number, age: number, settling: boolean) {
  for (let i = 0; i < W * H; i++) {
    const col = src[i];
    if (!col) continue;
    // how far through its flight this pixel is (settling, how far it still has to go)
    const s = (settling ? d.rel[i] - age : age - d.rel[i]) / d.life[i];
    if (s <= 0) {
      buf[i] = col;
      continue;
    }
    if (s >= 1 || !d.fly[i]) continue;
    // eases into the air, then sails, its heading turning as the current curls
    const travel = d.len[i] * s * s;
    const heading = d.ang[i] + d.curl[i] * s + (settling ? Math.PI : 0);
    const px = Math.round((i % W) + Math.cos(heading) * travel);
    const py = Math.round(((i / W) | 0) + Math.sin(heading) * travel);
    if (px < 0 || px >= W || py < 0 || py >= H) continue;
    // and fades into whatever it passes over, rather than speckling it
    const j = py * W + px;
    buf[j] = buf[j] ? mixPacked(col, buf[j], s) : col;
  }
}

/** a margin note for the places that borrow from a film: its title, small, just above the picture's corner */
function Nod({ title, still }: { title: string; still: boolean }) {
  return (
    <motion.div
      aria-hidden
      initial={still ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4, duration: 0.6, ease: "easeOut" }}
      className="pointer-events-none absolute -top-5 right-0 text-[0.6875rem] whitespace-nowrap text-ink-3 italic select-none"
    >
      {title} <span className="not-italic">❤️</span>
    </motion.div>
  );
}

/** a mouse with one of its buttons pressed: the cue for a left or right click */
function MouseButton({ side }: { side: "left" | "right" }) {
  return (
    <svg viewBox="0 0 12 16" aria-hidden className="h-3.5 w-auto" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="0.6" y="0.6" width="10.8" height="14.8" rx="5.4" />
      <path d="M6 0.8V6.4M0.8 6.4H11.2" />
      <path
        d={side === "left" ? "M5.4 1.2A4.8 4.8 0 0 0 1.2 5.8H5.4Z" : "M6.6 1.2A4.8 4.8 0 0 1 10.8 5.8H6.6Z"}
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/**
 * a small generated place at the top of the page. each one is drawn pixel by pixel from a
 * single number; "another place" picks a new number, and the next kind of place.
 */
export function PixelPlace() {
  const { theme } = usePageState();
  const reduce = useReducedMotion();
  // read inside the loop rather than rebuilding the place when the setting comes in: it starts
  // out unknown and settles a moment later, and a rebuild would blank the picture
  const reduceRef = useRef(false);
  useEffect(() => {
    reduceRef.current = !!reduce;
  }, [reduce]);
  const placeSeed = useSyncExternalStore(placeStore.subscribe, placeStore.get, () => null);
  const busy = useSyncExternalStore(placeStore.subscribe, placeStore.busy, () => false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // the last picture shown, and where the next one should open from, carried across places
  // the old place itself comes along too, so it keeps moving while it blows away
  type Live = { place: Place; frame: Frame; born: number };
  const shotRef = useRef<{ W: number; H: number; buf: Uint32Array; live: Live | null } | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const place = placeSeed === null ? null : placeFor(placeSeed);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box || theme === null || placeSeed === null) return;
    const ctx = canvas.getContext("2d")!;
    const night = theme === "dark";
    // a place can ask to be seen at the other end of the day; this remembers that ask
    let hour: "day" | "night" | undefined;

    let frame: Frame;
    let image: ImageData;
    let edge: ReturnType<typeof edgeBand>;
    let shown: Uint32Array;
    let current: Place;
    let width = 0;

    const build = (force = false) => {
      const cssW = box.clientWidth;
      if (cssW === width && !force) return;
      width = cssW;
      const scale = cssW >= 640 ? 3 : 2;
      const inner = Math.floor(cssW / scale);
      // the wobbling edge sits, on average, about half its band in from the canvas's edge; so
      // the canvas reaches out past the column by that much, and the picture's edge lines up
      // with the text and the caption below it
      const reach = Math.round(Math.max(4, Math.round(inner * 0.03)) * 0.55);
      const W = inner + reach * 2;
      const H = Math.floor(inner * (cssW >= 640 ? 0.5625 : 0.9)) + reach * 2;
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      canvas.style.margin = `${-reach * scale}px`;
      frame = new Frame(W, H);
      edge = edgeBand(W, H);
      shown = new Uint32Array(W * H);
      image = new ImageData(new Uint8ClampedArray(frame.buf.buffer as ArrayBuffer), W, H);
      current = placeFor(placeSeed).make(placeSeed, W, H, night, hour);
    };
    build();

    // open from the old picture if there is one of the same size; from nothing on first load
    const shot = shotRef.current;
    const same = shot && shot.W === frame!.W && shot.H === frame!.H;
    let from: Uint32Array | null = same ? shot.buf : null;
    let old: Live | null = same ? shot.live : null;
    let moving = false;
    let painted = false;
    let failed = false;
    let origin = originRef.current ?? { x: 0.5, y: 0.5 };
    originRef.current = null;
    let dust: ReturnType<typeof makeDust> | null = null;
    let lastClick = { x: 0.5, y: 0.5 };

    // where the pointer is, relative to the picture, eased so looking around feels weighty
    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    const clicks: Input["clicks"] = [];
    // on a phone, how it's tilted stands in for the pointer
    startTilt();
    const onMove = (e: PointerEvent) => {
      if (tilt.active) return;
      const r = canvas.getBoundingClientRect();
      look.tx = Math.max(-1.5, Math.min(1.5, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      look.ty = Math.max(-1.5, Math.min(1.5, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
    };
    const onLeave = () => {
      look.tx = 0;
      look.ty = 0;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const r = canvas.getBoundingClientRect();
      lastClick = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      clicks.push({
        x: ((e.clientX - r.left) / r.width) * frame.W,
        y: ((e.clientY - r.top) / r.height) * frame.H,
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    // a right-click draws a fresh one of the same kind
    const onMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (placeStore.busy()) return;
      const r = canvas.getBoundingClientRect();
      originRef.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      placeStore.again();
    };
    canvas.addEventListener("contextmenu", onMenu);

    let raf = 0;
    let visible = true;
    let prev = performance.now();
    let born = prev;

    const tick = (now: number) => {
      const dt = reduceRef.current ? 0 : Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (tilt.active) {
        look.tx = tilt.x;
        look.ty = tilt.y;
      }
      look.x += (look.tx - look.x) * Math.min(1, dt * 4);
      look.y += (look.ty - look.y) * Math.min(1, dt * 4);
      // a place that trips over itself keeps its last good frame, and the loop goes on
      try {
        current.draw(frame, (now - born) / 1000, dt, {
          lookX: reduceRef.current ? 0 : look.x,
          lookY: reduceRef.current ? 0 : look.y,
          clicks: clicks.splice(0),
        });
      } catch (err) {
        if (!failed) console.error(err);
        failed = true;
      }
      bloom(frame, current.bloom ?? 0.5);
      if (current.reroll) {
        current.reroll = false;
        if (!placeStore.busy()) originRef.current = lastClick;
        // let this frame finish; the store change rebuilds everything on the next render
        queueMicrotask(placeStore.again);
      }
      if (current.flip) {
        hour = current.hour === "night" || current.hour === "dusk" ? "day" : "night";
        const was = shown.slice();
        const left: Live = { place: current, frame, born };
        build(true);
        from = was.length === shown.length ? was : null;
        old = from && !moving ? left : null;
        origin = lastClick;
        dust = null;
        born = now;
      }

      const age = (now - born) / 1000;
      // arriving from nothing (a first visit) is quick, so the picture is there almost at once;
      // giving way from one place to another takes its time
      const quick = !from;
      moving = !reduceRef.current && age < (quick ? SCATTER / 3.2 : SCATTER);
      if (moving) {
        if (from && from.length !== frame.buf.length) from = null;
        if (from && old) {
          try {
            old.place.draw(old.frame, (now - old.born) / 1000, dt, {
              lookX: reduceRef.current ? 0 : look.x,
              lookY: reduceRef.current ? 0 : look.y,
              clicks: [],
            });
            bloom(old.frame, old.place.bloom ?? 0.5);
            from = old.frame.buf;
          } catch {
            // if the old place can't go on, it blows away as it last looked
            old = null;
          }
        }
        dust ??= makeDust(frame.W, frame.H, origin.x * frame.W);
        if (from) scatter(frame.buf, from, dust, frame.W, frame.H, age, false);
        else {
          const fresh = frame.buf.slice();
          frame.buf.fill(0);
          scatter(frame.buf, fresh, dust, frame.W, frame.H, age * 3.2 + 0.3, true);
        }
      } else {
        from = null;
        old = null;
        dust = null;
      }
      shown.set(frame.buf);
      applyEdge(frame.buf, edge, reduceRef.current ? 0 : now / 1000);
      ctx.putImageData(image, 0, 0);
      painted = true;
      raf = visible ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf && visible) {
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    // the first frame goes up straight away, so the canvas is never left empty
    tick(performance.now());

    const ro = new ResizeObserver(() => {
      build();
      kick();
    });
    ro.observe(box);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      kick();
    });
    io.observe(canvas);
    const onVisibility = () => {
      visible = !document.hidden;
      kick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      // a place that was itself still arriving is handed on as a still, since its own dust
      // can't be carried over
      // one that never got drawn (react trying an effect twice in development) hands on nothing
      if (painted) shotRef.current = { W: frame.W, H: frame.H, buf: shown, live: moving ? null : { place: current, frame, born } };
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("contextmenu", onMenu);
    };
  }, [theme, placeSeed]);

  // the number is the place: clicking it copies a link straight back to it
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (placeSeed === null) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?place=${placeSeed}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // no clipboard here; nothing to do
    }
  };

  return (
    <figure className="relative @container">
      {placeSeed !== null && nodFor(placeSeed) ? <Nod key={placeSeed} title={nodFor(placeSeed)!} still={!!reduce} /> : null}
      {/* the canvas's own height, reserved before it draws: 0.9 of its width when narrow, 9/16 when wide */}
      <div ref={boxRef} className="flex aspect-[10/9] w-full items-start justify-center @min-[640px]:aspect-[16/9]">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={place ? `A generated pixel-art scene: ${place.name}, number ${placeSeed}.` : "A generated pixel-art scene."}
          className="max-w-none shrink-0 touch-pan-y select-none [image-rendering:pixelated]"
        />
      </div>
      <figcaption className="ui mt-4 flex items-center gap-5 text-ink-3">
        {place && placeSeed !== null ? (
          <>
            <button
              type="button"
              onClick={copy}
              title="Copy a link to this place"
              className="text-ink-2 tabular-nums transition-colors hover:text-ink"
            >
              {copied ? "Copied" : `#${placeSeed}`}
            </button>
            <span className="flex items-center gap-1.5">
              <MouseButton side="left" />
              {clickFor(placeSeed)}
            </span>
            <span className="flex items-center gap-1.5">
              <MouseButton side="right" />
              Reroll
            </span>
          </>
        ) : null}
        <button
          type="button"
          onClick={placeStore.next}
          disabled={busy}
          aria-label="Next place"
          title="Next place"
          className="ml-auto text-ink-2 transition-[color,opacity] hover:text-ink disabled:opacity-40 disabled:hover:text-ink-2"
        >
          <SkipForward aria-hidden className="size-4" />
        </button>
      </figcaption>
    </figure>
  );
}
