import type { Metadata } from "next";
import { BookOpen, ExternalLink, GitBranch } from "lucide-react";
import { PageHeader, Section } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { LINKS, STUDENT } from "@/lib/nav";

export const metadata: Metadata = {
  title: "About",
  description: "Student, course and project details, the tech stack and links.",
};

const STACK = [
  ["Framework", "Next.js 16.4 (App Router, React 19.3, TypeScript 6.0 strict)"],
  ["UI", "Tailwind CSS 4.3, shadcn/ui (Radix), Lucide icons, Motion, Geist fonts"],
  ["Charts", "Recharts 3.10 (one library, fixed model colours and dash patterns)"],
  ["LLM", "Vercel AI SDK 7 + @ai-sdk/google 4, Google Gemini 3.6 Flash, tool calling, streaming"],
  ["Data", "Zod-validated JSON exported from the executed notebook; Papa Parse for uploads"],
  ["Forecasting engine", "TypeScript: Naïve, Seasonal Naïve, moving average, Holt-Winters, ridge, seasonal-index transfer"],
  ["Testing", "Vitest (unit + notebook parity), Playwright + axe-core (e2e, accessibility)"],
  ["Hosting", "Vercel (Node.js 26 runtime, ISR for live feeds)"],
];

export default function AboutPage() {
  return (
    <div className="space-y-10" data-testid="page-about">
      <PageHeader
        title="About BEVCAST AI"
        description="A demand-forecasting studio built for the AI in Operations Problems and Exercises submission."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={LINKS.github} target="_blank" rel="noreferrer">
                <GitBranch /> GitHub
              </a>
            </Button>
            <Button asChild>
              <a href={LINKS.colab} target="_blank" rel="noreferrer">
                <BookOpen /> Colab <ExternalLink className="size-3" />
              </a>
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Student and course">
          <dl className="card-surface grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-5 text-sm">
            {Object.entries({
              Student: STUDENT.name,
              "Roll number": STUDENT.roll,
              Programme: STUDENT.programme,
              Batch: STUDENT.batch,
              Institution: STUDENT.institution,
              Subject: STUDENT.subject,
              Assignment: STUDENT.assignment,
              "Instructor (as printed on the slides)": STUDENT.instructor,
            }).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section title="Tech stack">
          <dl className="card-surface grid grid-cols-1 gap-x-6 gap-y-2 p-5 text-sm sm:grid-cols-[auto_1fr]">
            {STACK.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
      <Section title="Academic integrity">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every number traces to the executed notebook (exported and re-verified), to the in-app engine (computed live from the data shown) or to a live
          API, and is labelled as such. Part 1 demand is simulated teaching data; Part 2 uses a real category proxy. No datasets, metrics or LLM answers were
          fabricated.
        </p>
      </Section>
    </div>
  );
}
