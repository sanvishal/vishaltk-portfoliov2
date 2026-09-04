import type { AnchorHTMLAttributes } from "react";

export function FancyLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      {...props}
      className={["fancy rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/60", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
