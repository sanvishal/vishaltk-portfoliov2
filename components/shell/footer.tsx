import { SocialsRow } from "./socials";

export function Footer() {
  return (
    <footer className="mt-auto flex flex-col items-center gap-5 py-8 text-sm text-muted-foreground md:flex-row md:justify-between">
      <SocialsRow />
      <p>made by vishal, one tiny detail at a time</p>
    </footer>
  );
}
