import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";

export default function NotFound() {
  return (
    <Reveal className="pb-14">
      <h1 className="text-2xl font-black">404</h1>
      <p className="mt-2 text-lg text-muted-foreground">this page is as offline as Yata.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">take me home</Link>
      </Button>
    </Reveal>
  );
}
