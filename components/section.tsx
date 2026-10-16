/**
 * every block on the page sits on the same two columns: a narrow margin for its name,
 * like a note in a book's margin, and the reading column. on phones they stack.
 */
export function Section({
  label,
  id,
  children,
  className,
}: {
  label?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-label={typeof label === "string" ? label : undefined}
      className={[
        "grid scroll-mt-10 grid-cols-1 gap-y-4 md:grid-cols-[var(--margin)_minmax(0,1fr)] md:gap-x-(--gutter)",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="ui text-ink-3 md:pt-[0.3rem]">{label}</div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
