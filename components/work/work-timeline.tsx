"use client";

import { ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/reveal";
import { work } from "@/lib/data";

/** a dot at rest, a chevron on hover, flipped when open */
function Marker() {
  return (
    <span aria-hidden className="relative size-[10px] shrink-0">
      <span className="absolute top-1/2 left-1/2 size-1 -translate-1/2 rounded-full bg-foreground opacity-30 transition-opacity duration-200 group-hover/accordion-trigger:opacity-0 group-focus-visible/accordion-trigger:opacity-0" />
      <ChevronDown
        strokeWidth={2.5}
        className="absolute top-1/2 left-1/2 size-4 -translate-1/2 opacity-0 transition-[opacity,transform] duration-200 ease-out-strong group-hover/accordion-trigger:opacity-100 group-focus-visible/accordion-trigger:opacity-100 group-aria-expanded/accordion-trigger:-translate-y-1/2 group-aria-expanded/accordion-trigger:rotate-180"
      />
    </span>
  );
}

export function WorkTimeline() {
  return (
    <Accordion type="multiple" defaultValue={["0"]} className="gap-6">
      {work.map((item, i) => (
        <Reveal key={`${item.company}-${item.role}`} delay={0.1 + i * 0.06}>
          <AccordionItem value={String(i)} className="border-none">
            <AccordionTrigger
              icon={false}
              className="flex-col items-start gap-0 rounded-lg border-0 p-0 text-base hover:no-underline focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <span className="flex flex-wrap items-center gap-3 text-lg font-bold">
                <span>{item.company}</span>
                <Marker />
                <span>{item.role}</span>
              </span>
              <span className="font-bold text-muted-foreground">{item.period}</span>
            </AccordionTrigger>
            <AccordionContent className="relative pt-3 pb-1 text-base">
              <span
                aria-hidden
                className="absolute top-3 bottom-4 left-[10px] border-l border-dashed border-foreground/20"
              />
              <ul className="space-y-2 pl-[30px]">
                {item.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="relative leading-relaxed before:absolute before:-left-4 before:text-muted-foreground before:content-['-']"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Reveal>
      ))}
    </Accordion>
  );
}
