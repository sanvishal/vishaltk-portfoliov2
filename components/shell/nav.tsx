"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, House, Star } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GiftButton } from "./gift-button";

const items = [
  { href: "/", label: "home", Icon: House },
  { href: "/projects", label: "projects", Icon: Star },
  { href: "/work", label: "work", Icon: Briefcase },
] as const;

const spring = { type: "spring", duration: 0.45, bounce: 0.15 } as const;

export function Nav() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <nav aria-label="main" className="flex items-center justify-between py-3">
      <LayoutGroup id="nav">
        <ul
          className="flex items-center gap-2"
          onMouseLeave={() => setHovered(null)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setHovered(null);
          }}
        >
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="relative">
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    aria-hidden
                    className="absolute inset-0 rounded-lg [background:var(--pill)]"
                    transition={spring}
                  />
                )}
                <AnimatePresence>
                  {hovered === href && !active && (
                    <motion.span
                      layoutId="nav-hover"
                      aria-hidden
                      className="absolute inset-0 rounded-lg bg-(--pill-soft)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={spring}
                    />
                  )}
                </AnimatePresence>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      aria-label={`go to ${label}`}
                      aria-current={active ? "page" : undefined}
                      onMouseEnter={() => setHovered(href)}
                      onFocus={() => setHovered(href)}
                      className="relative z-10 flex size-10 items-center justify-center rounded-lg text-foreground outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-95"
                    >
                      <Icon className="size-5" strokeWidth={2.5} />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
      <GiftButton />
    </nav>
  );
}
