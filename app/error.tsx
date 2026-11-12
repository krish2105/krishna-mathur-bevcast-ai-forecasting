"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg py-16 text-center" role="alert">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-critical/10 text-critical-fg">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">This page could not be displayed</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong while rendering it. The rest of the app still works; the reference results are unaffected.
        {error.digest ? ` (Reference: ${error.digest})` : ""}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to overview</Link>
        </Button>
      </div>
    </div>
  );
}
