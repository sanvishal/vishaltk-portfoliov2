import type { Metadata } from "next";
import { OvergrownLab } from "@/components/overgrown-lab";
import { PageSlide } from "@/components/page-slide";

export const metadata: Metadata = {
  title: "Overgrown",
  description: "An experiment: an abandoned messages app, rusting, with moss and ivy growing over it.",
};

export default function OvergrownPage() {
  return (
    <PageSlide>
      {/* on its own in the middle of the page, like something found */}
      <div className="mx-auto max-w-[38rem]">
        <OvergrownLab />
        <p className="mx-auto mt-8 max-w-[30rem] text-center text-pretty text-ink-2">
          A phone nobody came back to. The screen is a real interface; the rust, grime, moss and
          ivy are pixels drawn over it, placed by reading where each part sits on the page.
        </p>
      </div>
    </PageSlide>
  );
}
