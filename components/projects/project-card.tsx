"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Project } from "@/lib/types";

type Props = { project: Project; onOpen: (project: Project) => void };

/**
 * the old card had the icon's own colors bleeding out behind it on hover.
 * kept that, added a soft spotlight that follows the pointer.
 */
export function ProjectCard({ project, onOpen }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  const track = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(project)}
      onPointerMove={track}
      whileHover={reduce ? undefined : { y: -3 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
      style={{ "--pc": project.accentColor } as React.CSSProperties}
      className="group relative w-full overflow-hidden rounded-xl border bg-card p-6 text-left shadow-[0_1px_2px_rgb(0_0_0/0.25)] outline-none transition-[border-color,box-shadow] duration-300 ease-out-strong hover:border-[color-mix(in_srgb,var(--pc)_40%,var(--border))] hover:shadow-[0_10px_30px_-12px_color-mix(in_srgb,var(--pc)_35%,transparent)] focus-visible:border-[color-mix(in_srgb,var(--pc)_60%,var(--border))] focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--pc) 12%, transparent), transparent 70%)",
        }}
      />
      <span className="relative flex items-start gap-4">
        <span className="relative size-[70px] shrink-0">
          <img
            aria-hidden
            src={project.image}
            alt=""
            className="pointer-events-none absolute inset-0 size-full scale-[3] opacity-20 blur-xl saturate-150 transition-[transform,opacity] duration-1000 ease-in-out-strong group-hover:scale-[4.5] group-hover:opacity-40"
          />
          <img
            src={project.image}
            alt=""
            width={70}
            height={70}
            className="relative z-10 size-full drop-shadow-[0_1px_4px_rgb(0_0_0/0.25)]"
          />
        </span>
        <span className="flex flex-col gap-1 pt-0.5">
          <span className="text-xl font-extrabold">{project.name}</span>
          <span className="text-muted-foreground">{project.description}</span>
        </span>
      </span>
    </motion.button>
  );
}
