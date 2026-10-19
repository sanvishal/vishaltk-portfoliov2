"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { ProjectTitle } from "./page-slide";
import type { Project } from "@/lib/types";

function previewOf(p: Project) {
  return p.images[0]?.link ?? p.image;
}

const PREVIEW_W = 260;
const PREVIEW_H = 180;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => n / 16 - 0.5);
const hex = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));

/**
 * a preview developing like a print: first a coarse two-tone dither in the project's own
 * colour, then finer and in full colour, then the real thing. each step holds for a beat,
 * the way the places animate.
 */
function develop(canvas: HTMLCanvasElement, img: HTMLImageElement, accent: string, onDone: () => void) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const ink = [19, 25, 42];
  const paper = [245, 247, 249];
  const tint = hex(accent);
  // cover the box, anchored to the top, the way the <img> under it is
  const scale = Math.max(PREVIEW_W / img.naturalWidth, PREVIEW_H / img.naturalHeight);
  const sw = PREVIEW_W / scale;
  const sh = PREVIEW_H / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const steps = [9, 6, 4, 3, 2];
  let k = 0;
  let timer = 0;
  const frame = () => {
    if (k >= steps.length) return onDone();
    const b = steps[k];
    const w = Math.ceil(PREVIEW_W / b);
    const h = Math.ceil(PREVIEW_H / b);
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, sx, 0, sw, sh, 0, 0, w, h);
    if (k < 3) {
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) lum[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
      // stretch the picture's own range first, so a dark screenshot still prints in all three tones
      const sorted = Float32Array.from(lum).sort();
      const lo = sorted[Math.floor(sorted.length * 0.05)];
      const hi = Math.max(lo + 0.05, sorted[Math.floor(sorted.length * 0.95)]);
      for (let i = 0; i < w * h; i++) {
        const l = (lum[i] - lo) / (hi - lo);
        const t = l + BAYER[((i / w) & 3) * 4 + ((i % w) & 3)] * 0.3;
        const c = t < 0.36 ? ink : t < 0.7 ? tint : paper;
        px[i * 4] = c[0];
        px[i * 4 + 1] = c[1];
        px[i * 4 + 2] = c[2];
      }
      ctx.putImageData(data, 0, 0);
    }
    k++;
    timer = window.setTimeout(frame, k < 3 ? 70 : 55);
  };
  frame();
  return () => clearTimeout(timer);
}

/**
 * the projects as an index, one line each. on a mouse, a small print of the project
 * trails the pointer and leans with how fast you move.
 */
export function WorkIndex({ projects }: { projects: Project[] }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<Project | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 380, damping: 34, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 380, damping: 34, mass: 0.6 });
  const lean = useTransform(useVelocity(sx), [-1600, 1600], [-9, 9], { clamp: true });
  const rotate = useSpring(lean, { stiffness: 220, damping: 22 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [developed, setDeveloped] = useState<string | null>(null);

  // each time a different project comes up, its print develops over the real image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas || reduce) return;
    const img = new Image();
    img.src = previewOf(active);
    let stop: (() => void) | undefined;
    let live = true;
    const go = () => {
      if (!live || !img.naturalWidth) return;
      stop = develop(canvas, img, active.accentColor, () => live && setDeveloped(active.slug));
    };
    if (img.complete) go();
    else img.onload = go;
    return () => {
      live = false;
      stop?.();
      setDeveloped(null);
    };
  }, [active, reduce]);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    x.set(e.clientX);
    y.set(e.clientY);
  };

  return (
    <div onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
      <ul className="border-t border-rule">
        {projects.map((p) => (
          <li key={p.slug} className="border-b border-rule">
            <Link
              href={`/projects/${p.slug}`}
              transitionTypes={["nav-forward"]}
              onClick={() => setActive(null)}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                x.set(e.clientX);
                y.set(e.clientY);
                // arriving from outside the list: start under the pointer instead of flying in
                if (!active) {
                  sx.jump(e.clientX);
                  sy.jump(e.clientY);
                }
                setActive(p);
              }}
              onFocus={() => setActive(null)}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-0.5 py-3.5"
            >
              <ProjectTitle slug={p.slug}>
                <span className="col-start-1 row-start-1 justify-self-start text-[1.0625rem] transition-colors group-hover:text-accent-ink">
                  {p.name}
                </span>
              </ProjectTitle>
              <span className="col-span-full row-start-2 text-[0.9375rem] text-ink-2">
                {p.description}
              </span>
              <span className="ui col-start-2 row-start-1 text-right text-ink-3">{p.kind}</span>
            </Link>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {active && (
          <motion.div
            key="preview"
            aria-hidden
            className="pointer-events-none fixed top-0 left-0 z-50 hidden md:block"
            style={{ x: sx, y: sy, rotate: reduce ? 0 : rotate }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          >
            <div className="relative ml-6 -translate-y-1/2 overflow-hidden rounded-[3px] bg-tint shadow-[0_1px_2px_hsl(var(--hue)_30%_10%/0.12),0_12px_32px_-8px_hsl(var(--hue)_30%_10%/0.28)]">
              {/* every preview stays mounted so switching rows is instant */}
              {projects.map((p) => (
                <img
                  key={p.slug}
                  src={previewOf(p)}
                  alt=""
                  className="h-[180px] w-[260px] object-cover object-top"
                  style={{ display: p.slug === active.slug ? "block" : "none" }}
                />
              ))}
              {/* the developing print, laid over the image until it's done */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-[180px] w-[260px] [image-rendering:pixelated]"
                style={{ opacity: reduce || developed === active.slug ? 0 : 1 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
