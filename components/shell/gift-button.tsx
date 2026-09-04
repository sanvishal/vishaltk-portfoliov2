"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLook } from "./look-provider";

/** shuffles the palette. the dot goes away once you've found it. */
export function GiftButton() {
  const { shuffle, shuffled, ready } = useLook();
  const [spins, setSpins] = useState(0);
  const reduce = useReducedMotion();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          aria-label="shuffle the colors"
          onClick={() => {
            shuffle();
            setSpins((n) => n + 1);
          }}
          whileTap={reduce ? undefined : { scale: 0.82 }}
          animate={reduce ? undefined : { rotate: spins * 360 }}
          transition={{ type: "spring", duration: 0.7, bounce: 0.35 }}
          className="relative flex size-10 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-(--pill-soft) focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <Gift className="size-5" strokeWidth={2.5} />
          <span
            aria-hidden
            className={[
              "absolute top-2 right-2 size-[5px] rounded-full bg-hue-2 transition-opacity duration-300",
              ready && !shuffled ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="bottom">something special 🎱</TooltipContent>
    </Tooltip>
  );
}
