import { ArrowUpRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RandomProject } from "@/lib/types";

/** hover swaps the thumbnail for an arrow, the way the old list did */
export function RandomProjectRow({ project }: { project: RandomProject }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={project.link}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex w-full flex-col gap-0.5 rounded-lg p-2 outline-none before:absolute before:inset-0 before:origin-left before:scale-x-50 before:rounded-lg before:bg-hue-2 before:opacity-0 before:transition-[transform,opacity] before:duration-250 before:ease-out-strong hover:before:scale-x-100 hover:before:opacity-[0.06] focus-visible:ring-2 focus-visible:ring-ring/60 md:flex-row md:items-center md:gap-3"
        >
          <span className="relative flex items-center gap-2">
            <span className="relative size-5 shrink-0 overflow-hidden">
              <img
                src={project.image}
                alt=""
                width={20}
                height={20}
                className="absolute inset-0 size-5 rounded-[2px] transition-transform duration-250 ease-out-strong group-hover:translate-x-5 group-hover:-translate-y-5"
              />
              <ArrowUpRight
                aria-hidden
                strokeWidth={2.5}
                className="absolute inset-0 size-5 -translate-x-5 translate-y-5 text-hue transition-transform duration-250 ease-out-strong group-hover:translate-x-0 group-hover:translate-y-0"
              />
            </span>
            <span className="text-lg">{project.name}</span>
            <ArrowUpRight aria-hidden strokeWidth={2.5} className="mt-0.5 size-5 opacity-20 md:hidden" />
          </span>
          <span aria-hidden className="hidden h-px flex-1 bg-foreground/10 md:block" />
          <span className="relative text-muted-foreground md:max-w-[400px] md:text-right">
            {project.description}
          </span>
        </a>
      </TooltipTrigger>
      <TooltipContent side="top" align="end">
        {project.about}
      </TooltipContent>
    </Tooltip>
  );
}
