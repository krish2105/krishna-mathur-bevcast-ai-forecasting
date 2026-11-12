import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { ProfessorTour } from "@/components/assignment/professor-tour";
import { PageHeader, Section } from "@/components/common/page-header";
import { COMPLIANCE, COMPLIANCE_NOTE, PART1_SLIDE, PART2_SLIDE, SUBMISSION_REQUEST } from "@/lib/assignment";
import { STUDENT } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Brief & Compliance",
  description: "The transcribed assignment slides and a requirement-by-requirement compliance matrix.",
};

function Slide({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="card-surface space-y-3 p-5">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">{heading}</p>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default function AssignmentPage() {
  return (
    <div className="space-y-10" data-testid="page-assignment">
      <PageHeader
        eyebrow={`${STUDENT.subject} · ${STUDENT.assignment}`}
        title="Assignment brief and compliance"
        description={`Transcribed from the class slides (no photos), as printed for ${STUDENT.instructor}'s session. The matrix below maps every requirement to where it is answered, in this app and in the notebook.`}
        actions={
          <Suspense fallback={null}>
            <ProfessorTour />
          </Suspense>
        }
      />

      <Section id="slides" title="The slides (transcription)">
        <div className="grid gap-4 lg:grid-cols-2">
          <Slide heading={PART1_SLIDE.heading}>
            <p className="font-semibold">Use case: {PART1_SLIDE.useCase}</p>
            <p>{PART1_SLIDE.scenario}</p>
            <p>
              <strong>Objective:</strong> {PART1_SLIDE.objective}
            </p>
          </Slide>
          <Slide heading={PART2_SLIDE.heading}>
            <p className="font-semibold">Use case: {PART2_SLIDE.useCase}</p>
            <p>{PART2_SLIDE.scenario}</p>
            <ol className="list-decimal space-y-1 pl-5">
              {PART2_SLIDE.tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <p className="rounded-lg border border-primary/30 bg-accent/50 p-3 font-medium">{PART2_SLIDE.llm}</p>
            <div>
              <p className="font-semibold">Expected learning outcomes</p>
              <ul className="list-disc pl-5">
                {PART2_SLIDE.outcomes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          </Slide>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong>Submission request:</strong> {SUBMISSION_REQUEST}
        </p>
      </Section>

      <Section id="compliance" title="Compliance matrix" description="Every slide requirement, where it is answered and the evidence.">
        <div className="overflow-x-auto rounded-lg border border-border" role="region" aria-label="Compliance matrix" tabIndex={0} data-testid="compliance-matrix">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <caption className="sr-only">Compliance matrix</caption>
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Requirement</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">In this app</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Notebook</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Evidence</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {COMPLIANCE.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="px-3 py-2.5 font-medium">{c.requirement}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      {c.app.map((a) => (
                        <Link key={a.href} href={a.href} className="text-primary hover:underline">
                          {a.label}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.notebook}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.evidence}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success-fg">
                      <CheckCircle2 className="size-3" aria-hidden /> {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Note: {COMPLIANCE_NOTE}</p>
      </Section>
    </div>
  );
}
