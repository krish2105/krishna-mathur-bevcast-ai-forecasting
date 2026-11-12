import { cn } from "@/lib/utils";

/** Original BEVCAST AI mark: a droplet with a rising forecast line. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M16 6c3.6 4.4 7 8.2 7 12a7 7 0 0 1-14 0c0-3.8 3.4-7.6 7-12z" fill="var(--primary-foreground)" opacity=".95" />
      <path d="M11.5 20.5l2.6-2.4 2.3 1.6 4.1-4.2" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
