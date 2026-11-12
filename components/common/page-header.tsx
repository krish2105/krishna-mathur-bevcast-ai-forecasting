import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  badges,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className="text-xs font-medium tracking-wide text-primary uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-[28px] md:leading-9">{title}</h1>
        {description && <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">{description}</div>}
        {badges && <div className="flex flex-wrap gap-2 pt-1">{badges}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  id,
  title,
  description,
  notebookRef,
  children,
  className,
  actions,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  notebookRef?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("scroll-mt-20 space-y-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 id={id ? `${id}-title` : undefined} className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            {title}
            {notebookRef && (
              <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
                Notebook §{notebookRef}
              </span>
            )}
          </h2>
          {description && <div className="max-w-3xl text-sm text-muted-foreground text-pretty">{description}</div>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
