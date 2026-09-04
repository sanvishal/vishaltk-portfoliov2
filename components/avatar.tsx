"use client";

import { motion, useReducedMotion } from "motion/react";
import { site } from "@/lib/data";

/** it has linked to the same video since 2022. it tilts a little now. still no hint. */
export function Avatar() {
  const reduce = useReducedMotion();
  return (
    <motion.a
      href={site.avatarLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="a little surprise"
      className="inline-block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      whileHover={reduce ? undefined : { rotate: -4, scale: 1.04 }}
      whileTap={reduce ? undefined : { rotate: 6, scale: 0.94 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
    >
      <img
        src="/images/tk.png"
        alt="vishal, grinning in front of some flowers"
        width={100}
        height={100}
        className="size-[100px] select-none"
        draggable={false}
      />
    </motion.a>
  );
}
