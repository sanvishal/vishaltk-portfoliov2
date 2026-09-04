"use client";

import { motion, useReducedMotion } from "motion/react";

// one long smooth wave, clipped by the svg's width. no tiles, so no seams.
const PERIOD = 21;
const HEIGHT = 5;
const LENGTH = 4000;

function wavePath() {
  const half = PERIOD / 2;
  const mid = HEIGHT / 2;
  let d = `M0 ${mid} Q ${half / 2} 0.5, ${half} ${mid}`;
  for (let x = half * 2; x <= LENGTH; x += half) d += ` T ${x} ${mid}`;
  return d;
}

const PATH = wavePath();

/** the wavy rule from the old home page. it draws itself in from the left. */
export function Waves({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      aria-hidden
      className={["block overflow-hidden", className].filter(Boolean).join(" ")}
      width="100%"
      height={HEIGHT}
      initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
      animate={{ clipPath: "inset(0 0% 0 0)" }}
      transition={{ duration: 1.1, delay: 0.35, ease: [0.77, 0, 0.175, 1] }}
    >
      <path d={PATH} fill="none" stroke="currentColor" strokeWidth="1" />
    </motion.svg>
  );
}
