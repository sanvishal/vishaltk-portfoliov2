import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageSlide, ProjectTitle } from "@/components/page-slide";
import { Section } from "@/components/section";
import { projects } from "@/lib/data";
import type { ProjectLink } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return {};
  return { title: project.name, description: project.description };
}

/** alt text was written for screen readers ("A gif showing…"). as a caption it only needs the subject. */
function caption(alt: string) {
  const s = alt.replace(/^(a|an)\s+(png|gif|jpg|image)\s+(showing\s+|of\s+)?/i, "").replace(/^the\s+/i, "");
  return s[0].toUpperCase() + s.slice(1);
}

const linkLabel: Record<string, string> = { github: "Source", blog: "Write-up", website: "Visit" };

function label(link: ProjectLink) {
  if (link.type === "website" && link.name && !link.name.startsWith("Visit")) return link.name;
  return linkLabel[link.type] ?? link.name ?? link.type;
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const index = projects.findIndex((p) => p.slug === slug);
  if (index < 0) notFound();
  const project = projects[index];
  const next = projects[(index + 1) % projects.length];
  // an "offline" note was the first paragraph. it reads better as a status than as prose.
  const offline = project.about[0]?.includes("currently offline");
  const about = offline ? project.about.slice(1) : project.about;

  return (
    <PageSlide>
      <article className="space-y-14 md:space-y-20">
        <Section
          label={
            <span className="inline-flex items-center gap-2 md:flex-row-reverse">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: project.accentColor }}
              />
              {project.kind}
            </span>
          }
        >
          <ProjectTitle slug={project.slug}>
            <h1 className="w-fit text-[2.25rem] leading-[1.05] font-medium tracking-[-0.035em] [font-stretch:92%] md:text-[3rem]">
              {project.name}
            </h1>
          </ProjectTitle>
          <p className="mt-3 text-[1.125rem] text-pretty text-ink-2 md:text-[1.25rem]">
            {project.description}
          </p>
          <ul className="ui mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {project.links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group text-ink-2 transition-colors hover:text-ink"
                >
                  {label(l)}
                  <span
                    aria-hidden
                    className="ml-1 inline-block text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  >
                    ↗
                  </span>
                </a>
              </li>
            ))}
            {offline && <li className="text-ink-3">Currently offline</li>}
          </ul>
        </Section>

        <Section label="Notes">
          <div className="max-w-[36rem] space-y-5 text-pretty">
            {about.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
        </Section>

        {project.images.length > 0 && (
          <Section label="Figures">
            <div className="space-y-10">
              {project.images.map((img, i) => (
                <figure key={img.link}>
                  <img
                    src={img.link}
                    alt={img.alt}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="w-full rounded-[3px] bg-tint"
                  />
                  <figcaption className="ui mt-2.5 text-ink-3">
                    <span className="text-ink-2">Fig. {i + 1}</span>&ensp;{caption(img.alt)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Section>
        )}

        <Section label="Next">
          <Link
            href={`/projects/${next.slug}`}
            transitionTypes={["nav-forward"]}
            className="group flex items-baseline justify-between gap-6 border-y border-rule py-4"
          >
            <ProjectTitle slug={next.slug}>
              <span className="text-[1.3125rem] transition-colors group-hover:text-accent-ink">{next.name}</span>
            </ProjectTitle>
            <span className="ui text-ink-3">{next.kind}</span>
          </Link>
          <Link href="/#work" transitionTypes={["nav-back"]} className="ui mt-4 inline-block text-ink-3 transition-colors hover:text-ink">
            All work
          </Link>
        </Section>
      </article>
    </PageSlide>
  );
}
