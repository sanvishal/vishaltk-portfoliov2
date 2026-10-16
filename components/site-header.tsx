import Link from "next/link";
import { Avatar } from "./avatar";
import { ThemeToggle } from "./theme-toggle";
import { site } from "@/lib/data";

export function SiteHeader() {
  return (
    <header
      style={{ viewTransitionName: "site-header" }}
      className="flex items-center gap-4 pt-8 pb-10 md:pt-14 md:pb-14"
    >
      <Avatar />
      <Link href="/" transitionTypes={["nav-back"]} className="mr-auto leading-tight">
        <span className="block text-[1.1875rem] font-medium tracking-[-0.01em]">{site.name}</span>
        <span className="ui block text-ink-3">{site.role}</span>
      </Link>
      <ThemeToggle />
    </header>
  );
}
