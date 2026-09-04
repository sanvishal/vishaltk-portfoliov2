"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FadeImage } from "@/components/fade-image";
import { SocialGlyph } from "@/components/link-icon";
import { iconColors } from "@/lib/data";
import type { Project, ProjectLink } from "@/lib/types";

type Props = { project: Project | null; onClose: () => void };

function linkColor(project: Project, link: ProjectLink) {
  return link.type === "website" ? project.accentColor : iconColors[link.type];
}

function LinkButton({ project, link }: { project: Project; link: ProjectLink }) {
  const color = linkColor(project, link);
  const [first, ...rest] = (link.name ?? "Visit Link").split(" ");
  return (
    <Button
      asChild
      variant="ghost"
      size="lg"
      style={{ "--lc": color } as React.CSSProperties}
      className="bg-[color-mix(in_srgb,var(--lc)_14%,transparent)] text-[color-mix(in_oklch,var(--lc),white_30%)] transition-[background-color,transform] duration-200 hover:bg-[color-mix(in_srgb,var(--lc)_24%,transparent)] hover:text-[color-mix(in_oklch,var(--lc),white_40%)] focus-visible:ring-[color-mix(in_srgb,var(--lc)_50%,transparent)] active:scale-[0.97]"
    >
      <a href={link.href} target="_blank" rel="noopener noreferrer">
        <SocialGlyph type={link.type} data-icon="inline-start" />
        <span>
          {first}
          {rest.length > 0 && <span className="hidden sm:inline"> {rest.join(" ")}</span>}
        </span>
      </a>
    </Button>
  );
}

export function ProjectDialog({ project, onClose }: Props) {
  const primary =
    project?.links.find((l) => l.type === "website")?.href ??
    project?.links.find((l) => l.type === "github")?.href;

  return (
    <Dialog open={project !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90dvh] gap-6 overflow-y-auto p-5 sm:max-w-3xl md:p-7 [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4"
        aria-describedby={undefined}
      >
        {project && (
          <>
            <DialogHeader className="pr-10">
              <a
                href={primary}
                target={primary ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="group flex w-fit items-center gap-5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="rounded-lg border p-3 transition-colors group-hover:border-foreground/20">
                  <img
                    src={project.image}
                    alt=""
                    width={50}
                    height={50}
                    className="size-[50px] drop-shadow-[0_1px_4px_rgb(0_0_0/0.25)]"
                  />
                </span>
                <span className="flex flex-col">
                  <DialogTitle className="text-2xl leading-tight font-black">{project.name}</DialogTitle>
                  <DialogDescription className="text-base font-bold text-muted-foreground">
                    {project.description}
                  </DialogDescription>
                </span>
              </a>
            </DialogHeader>

            {project.links.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {project.links.map((link) => (
                  <LinkButton key={link.href} project={project} link={link} />
                ))}
              </div>
            )}

            <div className="space-y-4 text-base font-medium leading-[1.8]">
              {project.about.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            {project.images.length > 0 ? (
              <div className="space-y-6">
                {project.images.map((img) => (
                  <FadeImage key={img.link} src={img.link} alt={img.alt} className="w-full rounded-md" />
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                no screenshots for this one, the link says it all
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
