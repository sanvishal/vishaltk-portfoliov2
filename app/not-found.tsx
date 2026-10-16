import Link from "next/link";
import { Section } from "@/components/section";

export default function NotFound() {
  return (
    <Section label="404">
      <h1 className="text-[2.25rem] leading-tight font-medium tracking-[-0.035em] [font-stretch:92%]">Nothing out here.</h1>
      <p className="mt-3 max-w-[36rem] text-ink-2">
        This page is as offline as Yata. The way back is the same as the way in.
      </p>
      <Link href="/" className="prose-link mt-6 inline-block">
        Go to the home page
      </Link>
    </Section>
  );
}
