import { FancyLink } from "@/components/fancy-link";
import { Reveal } from "@/components/reveal";
import { Avatar } from "@/components/avatar";
import { Waves } from "@/components/waves";

export default function Home() {
  return (
    <div className="pb-14">
      <Reveal delay={0.05}>
        <Avatar />
      </Reveal>
      <Reveal delay={0.1} className="mt-10">
        <h1 className="text-2xl font-black tracking-tight">
          Vishal <span className="gradient-text">TK</span>
        </h1>
        <p className="mt-2 text-lg">
          Frontend Engineer @ <FancyLink href="https://pushowl.com/">PushOwl</FancyLink>, in love
          with crafting meaningful ideas and interfaces with design, code and art
        </p>
      </Reveal>
      <Reveal delay={0.2}>
        <div className="mt-8 text-foreground/30">
          <Waves />
        </div>
        <p className="mt-8 text-base font-medium leading-[1.8] md:text-lg">
          Building beautiful and performant applications with rich UI/UX design, highly devoted to
          the tiniest details, polish and craft in my work from backend to frontend till people ends
          ~
        </p>
      </Reveal>
    </div>
  );
}
