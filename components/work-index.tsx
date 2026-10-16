"use client";

import { useState } from "react";
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
            <div className="ml-6 -translate-y-1/2 overflow-hidden rounded-[3px] bg-tint shadow-[0_1px_2px_hsl(var(--hue)_30%_10%/0.12),0_12px_32px_-8px_hsl(var(--hue)_30%_10%/0.28)]">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
