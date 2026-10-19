"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ChevronRight, Search, Sprout, SquarePen, UserRound } from "lucide-react";
import { Frame } from "@/lib/pixel/frame";
import { overgrowth, type Box, type GrowInput, type Seam } from "@/lib/pixel/overgrowth";

/**
 * a phone's messages nobody has opened in years, weathered and rusting, with the green coming
 * back over it: the list of conversations, every last message from the same few days. the
 * list is real html; the rust, grime and growth are a pixel canvas laid over it that reads
 * where everything sits and how round its corners are, so stains stay on its face, moss
 * settles on its top edge, things take root along the dividers and ivy creeps down its sides.
 */
export function OvergrownLab() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    const seed = Math.floor(Math.random() * 1e6);
    let frame: Frame;
    let image: ImageData;
    let scene: ReturnType<typeof overgrowth>;
    let scale = 3;
    let size = "";
    let clock = 0;

    const build = () => {
      const r = root.getBoundingClientRect();
      const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (key === size) return;
      const regrow = size === "";
      size = key;
      scale = r.width >= 560 ? 3 : 2;
      const W = Math.ceil(r.width / scale);
      const H = Math.ceil(r.height / scale);
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      const boxes: Box[] = [...root.querySelectorAll<HTMLElement>("[data-overgrow]")].map((el) => {
        const b = el.getBoundingClientRect();
        // snapped outward to whole canvas pixels, so the growth meets its edge with no gap
        const x = Math.floor((b.left - r.left) / scale);
        const y = Math.floor((b.top - r.top) / scale);
        return {
          x,
          y,
          w: Math.ceil((b.right - r.left) / scale) - x,
          h: Math.ceil((b.bottom - r.top) / scale) - y,
          round: parseFloat(getComputedStyle(el).borderTopLeftRadius) / scale,
        };
      });
      // the crevices inside: each marked element names which of its edges is the seam
      const seams: Seam[] = [...root.querySelectorAll<HTMLElement>("[data-seam]")].map((el) => {
        const b = el.getBoundingClientRect();
        const x = Math.round((b.left - r.left) / scale);
        const y = Math.round((b.top - r.top) / scale);
        const w = Math.round(b.width / scale);
        const h = Math.round(b.height / scale);
        const edge = el.dataset.seam;
        // on a rounded thing (a bubble) the ledge is only the flat part of its top
        const round = (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) / scale;
        const flat = { x: Math.round(x + round * 0.7), w: Math.round(w - round * 1.4) };
        return edge === "bottom" ? { x, y: y + h - 1, w, h: 0 } : edge === "right" ? { x: x + w - 1, y, w: 0, h } : { ...flat, y, h: 0 };
      });
      frame = new Frame(W, H);
      image = new ImageData(new Uint8ClampedArray(frame.buf.buffer as ArrayBuffer), W, H);
      // a resize lays out a new canvas already grown; only the first one grows in from nothing
      scene = overgrowth(seed, W, H, boxes, regrow && !reduce ? 0 : Math.max(clock, 30), seams);
    };
    build();

    const input: GrowInput = { x: null, y: null, vx: 0, vy: 0 };
    let last = { x: 0, y: 0, t: 0 };
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      const x = (e.clientX - r.left) / scale;
      const y = (e.clientY - r.top) / scale;
      if (x < -10 || y < -10 || x > r.width / scale + 10 || y > r.height / scale + 10) {
        input.x = input.y = null;
        return;
      }
      const now = performance.now();
      const dt = Math.max(8, now - last.t) / 1000;
      if (input.x !== null) {
        input.vx = input.vx * 0.5 + ((x - last.x) / dt) * 0.5;
        input.vy = input.vy * 0.5 + ((y - last.y) / dt) * 0.5;
      }
      input.x = x;
      input.y = y;
      last = { x, y, t: now };
    };
    const onLeave = () => {
      input.x = input.y = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let visible = false;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = reduce ? 0 : Math.min((now - prev) / 1000, 0.1);
      prev = now;
      clock += dt;
      scene.draw(frame, dt, input);
      input.vx *= 0.8;
      input.vy *= 0.8;
      ctx.putImageData(image, 0, 0);
      raf = visible && !reduce ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf && visible) {
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    tick(performance.now());
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(root);
    const ro = new ResizeObserver(() => {
      const before = size;
      build();
      if (before !== size) tick(performance.now());
    });
    ro.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [gen, reduce]);

  // years of sun and damp: the screen yellowed, the lines dirtied, every colour faded
  const line = "border-[color-mix(in_oklab,var(--rule)_50%,#8a7656)]";
  const blue = "text-[color-mix(in_oklab,#2f7fd8_70%,#7d8a80)]";
  const chats = [
    { name: "Mum", text: "Call me when you see this. Please.", when: "3/14/19", unread: true },
    { name: "Emergency Alert", text: "Stay indoors. Further instructions will follow.", when: "3/14/19", unread: true },
    { name: "Sam", text: "Did you make it out? The bridge is closed", when: "3/13/19", unread: true },
    { name: "Dad", text: "Fuel's gone everywhere. Coming the long way", when: "3/13/19", unread: false },
    { name: "+91 4242424242", text: "Is anyone still there?", when: "3/12/19", unread: false },
  ];

  return (
    <figure>
      <div ref={rootRef} className="relative isolate px-4 pt-16 pb-12 sm:px-6">
        {/* a phone's messages, open on the list of conversations */}
        <div
          data-overgrow
          style={{ fontFamily: "system-ui, -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif" }}
          className={`mx-auto max-w-[24rem] overflow-hidden rounded-[22px] border ${line} bg-[color-mix(in_oklab,var(--paper)_80%,#c4ad82)] text-[15px] leading-[1.3] tracking-[-0.01em] text-ink [filter:saturate(0.65)_sepia(0.2)]`}
        >
          <div className="px-4 pt-3">
            <div className={`flex justify-end ${blue}`}>
              <SquarePen aria-hidden className="size-5" />
            </div>
            <h3 className="mt-2 text-[28px] font-bold tracking-[-0.02em] text-ink">Messages</h3>
            <div className="mt-2 mb-3 flex items-center gap-1.5 rounded-[10px] bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] px-2.5 py-1.5 text-ink-3">
              <Search aria-hidden className="size-4" />
              Search
            </div>
          </div>

          <ul>
            {chats.map((c, k) => (
              <li key={c.name} className="flex items-start gap-2 pl-1.5">
                {/* the unread dot, centred on the avatar the way the app has it */}
                <span className="mt-2.5 flex h-11 shrink-0 items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${c.unread ? "bg-[#1a74e8]" : ""}`} />
                  <span className="grid size-11 place-items-center rounded-full bg-[color-mix(in_oklab,var(--ink)_22%,transparent)] text-[17px] font-medium text-paper">
                    {/\d/.test(c.name[1]) ? <UserRound aria-hidden className="size-6" /> : c.name[0]}
                  </span>
                </span>
                {/* the divider runs from the text to the edge, as it does on the phone */}
                <span data-seam={k > 0 ? "top" : undefined} className={`min-w-0 flex-1 py-2.5 pr-4 ${k > 0 ? `border-t ${line}` : ""}`}>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-ink">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-0.5 text-[14px] text-ink-3">
                      {c.when}
                      <ChevronRight aria-hidden className="size-4" />
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[14px] text-ink-3">{c.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="h-6" />
        </div>

        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 select-none [image-rendering:pixelated]"
        />
      </div>
      <figcaption className="ui mx-auto mt-2 flex max-w-[24rem] items-center gap-5 text-ink-3">
        <span>Move through it to brush the vines</span>
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
