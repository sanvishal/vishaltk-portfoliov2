import Link from "next/link";
import type { RandomProject } from "@/lib/types";

/** the small stuff: experiments, games, jams, maths toys. the experiments live on this site; the rest leave it. */
export function Playground({ items }: { items: RandomProject[] }) {
  return (
    <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
      {items.map((item) => {
        const here = item.link.startsWith("/");
        const body = (
          <>
            <span className="text-[1.0625rem] transition-colors group-hover:text-accent-ink">
              {item.name}
              {here ? null : (
                <span
                  aria-hidden
                  className="ui ml-1.5 inline-block text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                >
                  ↗
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[0.9375rem] leading-snug text-ink-2">{item.description}</span>
            <span className="ui mt-1.5 block text-ink-3">{item.about}</span>
          </>
        );
        return (
          <li key={item.name}>
            {here ? (
              <Link href={item.link} transitionTypes={["nav-forward"]} className="group block">
                {body}
              </Link>
            ) : (
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="group block">
                {body}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
