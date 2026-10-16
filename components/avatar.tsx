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
      className="block rounded-[32%]"
      whileHover={reduce ? undefined : { rotate: -6, scale: 1.06 }}
      whileTap={reduce ? undefined : { rotate: 8, scale: 0.92 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
    >
      <img
        src="/images/avatar.jpg"
        alt="vishal, smiling on a boat, green cliffs behind"
        width={44}
        height={44}
        className="size-11 rounded-[32%] object-cover select-none"
        draggable={false}
      />
    </motion.a>
  );
}
