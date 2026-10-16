"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { Frame } from "@/lib/pixel/frame";
import { outro, type OutroInput } from "@/lib/pixel/outro";
import { usePageState } from "@/lib/state";

/**
 * a little countryside at the very end of the page, made fresh on every visit. it's drawn in
 * the same pixels as the place at the top, and it notices the pointer.
 */
export function PixelOutro() {
  const { theme } = usePageState();
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || theme === null) return;
    const ctx = canvas.getContext("2d")!;
    const seed = Math.floor(Math.random() * 1e6);
    let frame: Frame;
    let image: ImageData;
    let scene: ReturnType<typeof outro>;
    let width = 0;
    let scale = 3;

    const build = () => {
      const cssW = canvas.parentElement!.clientWidth;
      if (cssW === width) return;
      width = cssW;
      scale = cssW >= 640 ? 3 : 2;
      const W = Math.ceil(cssW / scale);
      const H = Math.round(Math.min(W * 0.34, 170));
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      frame = new Frame(W, H);
      image = new ImageData(new Uint8ClampedArray(frame.buf.buffer as ArrayBuffer), W, H);
      scene = outro(seed, W, H, theme === "dark");
    };
    build();

    // the pointer, in the scene's own pixels, and how fast it's going
    const input: OutroInput = { x: null, y: null, vx: 0, vy: 0, clicks: [] };
    let last = { x: 0, y: 0, t: 0 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / scale;
      const y = (e.clientY - r.top) / scale;
      if (x < 0 || y < 0 || x > r.width / scale || y > r.height / scale) {
        input.x = null;
        input.y = null;
        return;
      }
      const now = performance.now();
      const dt = Math.max(1, now - last.t) / 1000;
      if (input.x !== null) {
        input.vx = input.vx * 0.5 + ((x - last.x) / dt) * 0.5;
        input.vy = input.vy * 0.5 + ((y - last.y) / dt) * 0.5;
      }
      input.x = x;
      input.y = y;
      last = { x, y, t: now };
    };
    const onLeave = () => {
      input.x = null;
      input.y = null;
    };
    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      input.clicks.push({ x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);

    let raf = 0;
    let visible = false;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = reduce ? 0 : Math.min((now - prev) / 1000, 0.05);
      prev = now;
      scene.draw(frame, dt, input);
      input.clicks.length = 0;
      input.vx *= 0.85;
      input.vy *= 0.85;
      ctx.putImageData(image, 0, 0);
      raf = visible && !reduce ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf && visible) {
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    // draw once even when still, and run only while it's on screen
    tick(performance.now());
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
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
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [theme, reduce]);

  return (
    <div aria-hidden className="mt-24 w-full overflow-hidden md:mt-32">
      <canvas ref={canvasRef} className="block max-w-none select-none [image-rendering:pixelated]" />
    </div>
  );
}
