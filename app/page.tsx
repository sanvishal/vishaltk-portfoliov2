import { Experience } from "@/components/experience";
import { PageSlide } from "@/components/page-slide";
import { Playground } from "@/components/playground";
import { PixelPlace } from "@/components/pixel-place";
import { Section } from "@/components/section";
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
                I&rsquo;m a design engineer. I work in the gap between the mockup and the shipped thing,
                and I care most about what usually gets lost on the way: how a menu eases open, the
                colour that&rsquo;s almost right, an editor that stays out of your way.
              </p>
              <p>
                These days I&rsquo;m at <Ext href="https://pushowl.com/">PushOwl</Ext>, working on
                Shopify apps whose frontends serve millions of people. Before that I spent a few
                years at Presidio on data-heavy dashboards, a design system, and more AWS than I&rsquo;d
                like to admit.
              </p>
              <p>
                I learned to code by making games, so the top of this page is a small one: a place
                drawn from a single number, different on every visit. A beach, a rainy street, a
                pond, a train over flooded fields, a planet. Poke at it.
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
