import type { RandomProject } from "@/lib/types";

/** the small stuff: games, jams, maths toys. each one leaves the site. */
export function Playground({ items }: { items: RandomProject[] }) {
  return (
    <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.name}>
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="group block">
            <span className="text-[1.0625rem] transition-colors group-hover:text-accent-ink">
              {item.name}
              <span
                aria-hidden
                className="ui ml-1.5 inline-block text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              >
                ↗
              </span>
            </span>
            <span className="mt-0.5 block text-[0.9375rem] leading-snug text-ink-2">
              {item.description[0].toUpperCase() + item.description.slice(1)}.
            </span>
            <span className="ui mt-1.5 block text-ink-3">
              {item.about[0].toUpperCase() + item.about.slice(1)}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
