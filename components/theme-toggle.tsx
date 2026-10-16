"use client";

import { motion, useReducedMotion } from "motion/react";
import { setTheme, usePageState } from "@/lib/state";

/** a small sun that becomes a moon */
export function ThemeToggle() {
  const { theme } = usePageState();
  const reduce = useReducedMotion();
  const dark = theme === "dark";
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, duration: 0.5, bounce: 0.2 };

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to daylight" : "Switch to night"}
      title={dark ? "Daylight" : "Night"}
      className="group relative flex size-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-ink"
      style={{ visibility: theme === null ? "hidden" : undefined }}
    >
      <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden>
        <mask id="moon-bite">
          <rect width="20" height="20" fill="white" />
          <motion.circle
            r="6"
            fill="black"
            initial={false}
            animate={{ cx: dark ? 14 : 24, cy: dark ? 6 : 0 }}
            transition={spring}
          />
        </mask>
        <motion.circle
          cx="10"
          cy="10"
          fill="currentColor"
          mask="url(#moon-bite)"
          initial={false}
          animate={{ r: dark ? 7 : 4.2 }}
          transition={spring}
        />
        <motion.g
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={false}
          animate={{ opacity: dark ? 0 : 1, scale: dark ? 0.6 : 1, rotate: dark ? -45 : 0 }}
          transition={spring}
          style={{ transformOrigin: "10px 10px" }}
        >
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1={10 + Math.cos(a) * 6.6}
                y1={10 + Math.sin(a) * 6.6}
                x2={10 + Math.cos(a) * 8.4}
                y2={10 + Math.sin(a) * 8.4}
              />
            );
          })}
        </motion.g>
      </svg>
    </button>
  );
}
