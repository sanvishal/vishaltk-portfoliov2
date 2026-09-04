"use client";

import { useState } from "react";
import { Reveal } from "@/components/reveal";
import { projects, randomProjects } from "@/lib/data";
import type { Project } from "@/lib/types";
import { ProjectCard } from "./project-card";
import { ProjectDialog } from "./project-dialog";
import { RandomProjectRow } from "./random-project-row";

export function ProjectsView() {
  const [open, setOpen] = useState<Project | null>(null);

  return (
    <div className="pb-14">
      <Reveal>
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-muted-foreground">some made as side projects, some made for hackathons</p>
      </Reveal>

      <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8">
        {projects.map((project, i) => (
          <Reveal key={project.slug} delay={(i + 1) / 20}>
            <li>
              <ProjectCard project={project} onOpen={setOpen} />
            </li>
          </Reveal>
        ))}
      </ul>

      <Reveal delay={0.5} className="mt-18">
        <h2 className="text-2xl font-bold">Games & Experiments</h2>
        <p className="text-muted-foreground">
          games and random thought blurbs made into something useful/useless
        </p>
      </Reveal>

      <ul className="mt-10 flex flex-col gap-4">
        {randomProjects.map((project, i) => (
          <Reveal key={project.name} delay={0.5 + (i + 1) / 20}>
            <li>
              <RandomProjectRow project={project} />
            </li>
          </Reveal>
        ))}
      </ul>

      <ProjectDialog project={open} onClose={() => setOpen(null)} />
    </div>
  );
}
