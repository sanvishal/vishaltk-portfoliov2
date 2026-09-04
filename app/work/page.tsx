import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Reveal } from "@/components/reveal";
import { WorkTimeline } from "@/components/work/work-timeline";
import { site } from "@/lib/data";

export const metadata: Metadata = { title: "Work" };

export default function WorkPage() {
  return (
    <div className="pb-14">
      <Reveal>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Work Experience</h1>
            <p className="text-muted-foreground">got paid to write code</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href={site.resume} target="_blank" rel="noopener noreferrer">
                  <FileText data-icon="inline-start" />
                  Resume
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              opens up a drive link, does not download on click :)
            </TooltipContent>
          </Tooltip>
        </div>
      </Reveal>
      <div className="mt-10">
        <WorkTimeline />
      </div>
    </div>
  );
}
