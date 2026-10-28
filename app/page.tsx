import { Brand } from "@/components/brand";
import { Experience } from "@/components/experience";
import { PageSlide } from "@/components/page-slide";
import { Playground } from "@/components/playground";
import { PixelPlace } from "@/components/pixel-place";
import { Section } from "@/components/section";
import { Verse } from "@/components/verse";
import { WorkIndex } from "@/components/work-index";
import { projects, randomProjects, site, socials, work } from "@/lib/data";

const twitter = socials.find((s) => s.type === "twitter")!.href;

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="prose-link">
      {children}
    </a>
  );
}

export default function Home() {
  return (
    <PageSlide>
      <div className="space-y-20 md:space-y-28">
        <div className="space-y-12 md:space-y-16">
          <PixelPlace />

          <Section label="About">
            <div className="max-w-[36rem] space-y-5 text-pretty md:text-[1.125rem] md:leading-[1.6]">
              <p>
                I&rsquo;m a <Verse>design engineer</Verse> at <Brand name="pushowl" />. Right now I&rsquo;m
                building <Brand name="adstudio" />, automating ecommerce ads with agents that orchestrate
                other agents.
              </p>
              <p>
                I design what I build, then keep tweaking it until it feels right. Outside work I make and
                play games, and obsess over movies.
              </p>
            </div>
          </Section>
        </div>

        <Section label="Work" id="work">
          <WorkIndex projects={projects} />
        </Section>

        <Section label="Playground" id="playground">
          <Playground items={randomProjects} />
        </Section>

        <Section label="Experience" id="experience">
          <Experience work={work} />
        </Section>

        <Section label="Say hello" id="contact">
          <p className="max-w-[36rem] text-pretty">
            If you want to talk about interfaces, tiny tools, games or space, the fastest way to reach
            me is a DM on <Ext href={twitter}>Twitter</Ext>. You can also read my{" "}
            <Ext href={site.resume}>résumé</Ext>.
          </p>
        </Section>
      </div>
    </PageSlide>
  );
}
