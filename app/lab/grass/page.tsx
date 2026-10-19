import type { Metadata } from "next";
import { GrassLab } from "@/components/grass-lab";
import { PageSlide } from "@/components/page-slide";
import { Section } from "@/components/section";

export const metadata: Metadata = {
  title: "Grass",
  description: "An experiment: pixel-art grass that grows over bare earth.",
};

export default function GrassPage() {
  return (
    <PageSlide>
      <Section label="Grass">
        <GrassLab />
        <p className="mt-8 max-w-[36rem] text-pretty text-ink-2">
          An experiment in drawing grass the way pixel artists do, by hand: flat green, dark patches
          where the clumps part, leaves spilling over their edges, then sprouts and flowers. Here it
          grows in over bare earth instead.
        </p>
      </Section>
    </PageSlide>
  );
}
