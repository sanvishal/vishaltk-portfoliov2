"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Sprout } from "lucide-react";
import { Frame } from "@/lib/pixel/frame";
import { meadow, type GrassInput } from "@/lib/pixel/grass";

/**
 * the grass experiment: a patch of ground that grows over on its own, fresh each time.
 * move over it to brush the leaves aside, click to plant, and regrow for a new patch.
 */
export function GrassLab() {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seedRef = useRef<HTMLSpanElement>(null);
  // bumped by "regrow"; each run of the effect picks a fresh patch
  const [gen, setGen] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const seed = Math.floor(Math.random() * 1e4);
    if (seedRef.current) seedRef.current.textContent = `#${seed}`;
    const ctx = canvas.getContext("2d")!;
    let frame: Frame;
    let image: ImageData;
    let scene: ReturnType<typeof meadow>;
    let width = 0;
    let scale = 3;
    // a new canvas always gets drawn, even if the scene says nothing moved
    let fresh = true;

    const build = () => {
      const cssW = canvas.parentElement!.clientWidth;
      if (cssW === width) return;
      width = cssW;
      scale = cssW >= 640 ? 3 : 2;
      const W = Math.floor(cssW / scale);
      const H = Math.round(W * (cssW >= 640 ? 0.62 : 1));
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      frame = new Frame(W, H);
      image = new ImageData(new Uint8ClampedArray(frame.buf.buffer as ArrayBuffer), W, H);
      scene = meadow(seed, W, H);
      fresh = true;
      // with reduced motion it simply appears fully grown
      if (reduce) scene.draw(frame, 30, { x: null, y: null, clicks: [] });
    };
    build();

    const input: GrassInput = { x: null, y: null, clicks: [] };
    const at = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    };
    const onMove = (e: PointerEvent) => {
      const p = at(e);
      input.x = p.x;
      input.y = p.y;
    };
    const onLeave = () => {
      input.x = null;
      input.y = null;
    };
    const onDown = (e: PointerEvent) => {
      input.clicks.push(at(e));
      kick();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);

    let raf = 0;
    let visible = false;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;
      const changed = scene.draw(frame, reduce ? 0 : dt, input);
      input.clicks.length = 0;
      if (changed || fresh) ctx.putImageData(image, 0, 0);
      fresh = false;
      raf = visible && !reduce ? requestAnimationFrame(tick) : 0;
    };
    function kick() {
      if (!raf && visible) {
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }
    tick(performance.now());
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      const w = width;
      build();
      if (w !== width) tick(performance.now());
    });
    ro.observe(canvas.parentElement!);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [gen, reduce]);

  return (
    <figure>
      <div className="w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Pixel-art grass growing over bare earth."
          className="block max-w-none touch-pan-y select-none [image-rendering:pixelated]"
        />
      </div>
      <figcaption className="ui mt-4 flex items-center gap-5 text-ink-3">
        <span ref={seedRef} className="text-ink-2 tabular-nums" />
        <span>Click to plant</span>
        <button
          type="button"
          onClick={() => setGen((g) => g + 1)}
          className="ml-auto flex items-center gap-1.5 text-ink-2 transition-colors hover:text-ink"
        >
          Regrow
          <Sprout aria-hidden className="size-4" />
        </button>
      </figcaption>
    </figure>
  );
}
