"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SocialGlyph } from "@/components/link-icon";
import { iconColors, socials } from "@/lib/data";
import type { LinkType } from "@/lib/types";

const spring = { type: "spring", duration: 0.4, bounce: 0.15 } as const;

function SocialLink({
  type,
  href,
  label,
  size = "md",
  onHover,
}: (typeof socials)[number] & { size?: "md" | "lg"; onHover?: () => void }) {
  const brand = iconColors[type];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          onMouseEnter={onHover}
          onFocus={onHover}
          style={{ "--brand": brand } as React.CSSProperties}
          className={[
            "relative z-10 flex items-center justify-center rounded-lg text-foreground/80 outline-none transition-[color,transform] duration-200 ease-out-strong hover:text-(--brand) focus-visible:text-(--brand) focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-95",
            size === "lg" ? "size-12" : "size-10",
          ].join(" ")}
        >
          <SocialGlyph type={type} size={size === "lg" ? 22 : 18} />
        </a>
      </TooltipTrigger>
      <TooltipContent side={size === "lg" ? "top" : "left"}>{label}</TooltipContent>
    </Tooltip>
  );
}

/** desktop: sits in the gutter left of the column, sticks while you scroll */
export function SocialsRail() {
  const [hovered, setHovered] = useState<LinkType | null>(null);
  return (
    <aside className="pointer-events-none absolute inset-y-0 -left-14 hidden lg:block">
      <LayoutGroup id="socials-rail">
        <ul
          className="pointer-events-auto sticky top-10 flex flex-col gap-2"
          onMouseLeave={() => setHovered(null)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setHovered(null);
          }}
        >
          {socials.map((s) => (
            <li key={s.type} className="relative">
              <AnimatePresence>
                {hovered === s.type && (
                  <motion.span
                    layoutId="social-hover"
                    aria-hidden
                    className="absolute inset-0 rounded-lg"
                    style={{ background: `color-mix(in srgb, ${iconColors[s.type]} 14%, transparent)` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={spring}
                  />
                )}
              </AnimatePresence>
              <SocialLink {...s} onHover={() => setHovered(s.type)} />
            </li>
          ))}
        </ul>
      </LayoutGroup>
    </aside>
  );
}

/** everything below lg: a row in the footer */
export function SocialsRow() {
  return (
    <ul className="flex items-center justify-center gap-1 lg:hidden">
      {socials.map((s) => (
        <li key={s.type}>
          <SocialLink {...s} size="lg" />
        </li>
      ))}
    </ul>
  );
}
