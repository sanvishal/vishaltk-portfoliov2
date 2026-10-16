import type { WorkItem } from "@/lib/types";

const tidy = (period: string) => period.replace(" - ", " – ").replace("Present", "now");

function years(roles: WorkItem[]) {
  const end = roles[0].period.split(" - ")[1];
  const start = roles[roles.length - 1].period.split(" - ")[0];
  const y = (s: string) => (s === "Present" ? "now" : s.slice(-4));
  return `${y(start)} – ${y(end)}`;
}

/** roles grouped by company, newest first. the current one starts open. */
export function Experience({ work }: { work: WorkItem[] }) {
  const groups: { company: string; roles: WorkItem[] }[] = [];
  for (const item of work) {
    const last = groups[groups.length - 1];
    if (last?.company === item.company) last.roles.push(item);
    else groups.push({ company: item.company, roles: [item] });
  }

  return (
    <div className="border-t border-rule">
      {groups.map((g, gi) => (
        <details key={g.company} className="role-group group border-b border-rule" open={gi === 0}>
          <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 py-3.5 select-none">
            <span className="text-[1.0625rem]">
              {g.company}
              {g.roles.length > 1 && <span className="text-ink-2">, {g.roles.length} roles</span>}
            </span>
            <span className="ui text-ink-3">{years(g.roles)}</span>
            <span
              aria-hidden
              className="ui relative top-[1px] w-3 text-center text-ink-3 transition-transform duration-300 ease-(--ease-out-strong) group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <ol className="space-y-6 pt-1 pb-7">
            {g.roles.map((r) => (
              <li key={r.role + r.period}>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-[0.9375rem] font-medium">{r.role}</h3>
                  <span className="ui shrink-0 text-ink-3">{tidy(r.period)}</span>
                </div>
                <ul className="mt-1.5 space-y-1 text-[0.9375rem] leading-relaxed text-ink-2">
                  {r.bullets.map((b) => (
                    <li key={b} className="text-pretty">
                      {b}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}
