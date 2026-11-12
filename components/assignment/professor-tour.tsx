"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { ArrowLeft, ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STEPS = [
  { title: "Part 1: Naïve vs ML", body: "Naïve baseline, the in-sample Random Forest and the honest walk-forward test, with MAPE and WAPE and the stockout/excess impact.", href: "/lab-air-coolers" },
  { title: "Task 1: preprocessing", body: "Lag features (1, 2, 3, 12), rolling means and month sin/cos, built without look-ahead leakage.", href: "/analysis#features" },
  { title: "Tasks 2 and 5: models and metrics", body: "Six models across three families, ranked by MAPE and WAPE on a 12-month hold-out and a 54-forecast backtest.", href: "/models" },
  { title: "Tasks 3 and 4: split and 3-month forecast", body: "Chronological split, rolling-origin backtest and exactly three future months with interval bands, also for your own upload.", href: "/forecasting" },
  { title: "Task 6: actual vs predicted", body: "Test-year overlay with model toggles and the residual plot.", href: "/models#actual-vs-predicted" },
  { title: "Task 7: insights", body: "Answers to the three questions with evidence, the first-year scenario and the production plan.", href: "/insights" },
  { title: "LLM on real-time data", body: "The Copilot calls tools for live FRED and weather data and your upload; every answer shows its sources and data date.", href: "/copilot" },
];

export function ProfessorTour() {
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the tour when arriving via ?tour=1 (command palette)
    if (params.get("tour") === "1") setOpen(true);
  }, [params]);
  const step = STEPS[i];
  return (
    <>
      <Button onClick={() => { setI(0); setOpen(true); }} data-testid="start-tour">
        <Compass /> Start the Professor Tour
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <p className="text-xs font-medium text-primary">
              Step {i + 1} of {STEPS.length}
            </p>
            <DialogTitle>{step.title}</DialogTitle>
            <DialogDescription>{step.body}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((_, k) => (
              <span key={k} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setI((k) => Math.max(0, k - 1))} disabled={i === 0}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href={step.href} onClick={() => setOpen(false)}>
                  Open page
                </Link>
              </Button>
              {i < STEPS.length - 1 ? (
                <Button size="sm" onClick={() => setI((k) => k + 1)}>
                  Next <ArrowRight />
                </Button>
              ) : (
                <Button size="sm" onClick={() => setOpen(false)}>
                  Done
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
