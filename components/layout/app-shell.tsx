"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { ChevronsLeft, ChevronsRight, Command as CommandIcon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandMenu } from "@/components/layout/command-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/layout/logo";
import { FOOTER_LINE, NAV, NAV_GROUPS, STUDENT, navFor } from "@/lib/nav";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "bevcast.sidebar.collapsed";

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-0.5">
          {!collapsed && (
            <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{group}</div>
          )}
          {NAV.filter((n) => n.group === group).map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
                {collapsed ? <span className="sr-only">{item.short}</span> : <span className="truncate">{item.short}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children, freshness }: { children: React.ReactNode; freshness: string }) {
  const pathname = usePathname();
  const current = navFor(pathname);
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-viewer preference after hydration
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable: keep expanded */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        data-print-hide
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-[264px]",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
          <Link href="/" className="flex items-center gap-2.5" aria-label={collapsed ? "BEVCAST AI home" : undefined}>
            <Logo className="size-7" />
            {!collapsed && (
              <span className="leading-tight">
                <span className="block text-sm font-semibold tracking-tight">BEVCAST AI</span>
                <span className="block text-[11px] text-muted-foreground">Demand-forecasting studio</span>
              </span>
            )}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks collapsed={collapsed} />
        </div>
        <div className={cn("border-t border-sidebar-border p-3", collapsed && "flex justify-center")}>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(!collapsed && "w-full justify-start text-muted-foreground")}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed && "Collapse"}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[284px] max-w-[85vw] p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2.5">
              <Logo className="size-7" /> BEVCAST AI
            </SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-3 py-4">
            <NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-print-hide
          data-app-header
          className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6 lg:px-8"
        >
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            data-testid="mobile-menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{current?.title ?? "BEVCAST AI"}</p>
          </div>
          <span
            className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground xl:inline-flex"
            title="Reference results come from the executed notebook; live pages fetch at request time"
          >
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            {freshness}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            className="gap-2 text-muted-foreground"
            data-testid="open-palette"
          >
            <CommandIcon className="size-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only">Search</span>
            <kbd className="hidden rounded border border-border bg-muted px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
          </Button>
          <ThemeToggle />
          <Link
            href="/about"
            className="hidden items-center gap-2 rounded-full border border-border bg-card py-0.5 pr-3 pl-0.5 text-xs md:inline-flex"
            title={`${STUDENT.name}, ${STUDENT.roll}`}
          >
            <span className="grid size-6 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              <span aria-hidden>KM</span>
            </span>
            <span className="sr-only">{STUDENT.name}</span>
            <span className="font-medium">{STUDENT.roll}</span>
          </Link>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground md:px-6 lg:px-8">
          {FOOTER_LINE}
        </footer>
      </div>

      <CommandMenu open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
