import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV } from "@/lib/nav";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center" data-testid="page-404">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Compass className="size-5" aria-hidden />
      </span>
      <p className="mt-4 font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-1 text-xl font-semibold">This page does not exist</h1>
      <p className="mt-2 text-sm text-muted-foreground">The link may be wrong. Try one of the main pages instead.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">Overview</Link>
        </Button>
        {NAV.slice(1, 5).map((n) => (
          <Button key={n.href} asChild variant="outline">
            <Link href={n.href}>{n.short}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
