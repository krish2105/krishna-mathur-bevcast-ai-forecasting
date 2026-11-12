"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useTheme } from "next-themes";
import { Bot, FileDown, Moon, Sun, Trophy, Compass } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV } from "@/lib/nav";

const MODELS = ["XGBoost", "Holt-Winters", "Random Forest", "Naïve", "Seasonal Naïve", "SARIMA"];

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Jump to a page, model or action">
      <Command>
      <CommandInput placeholder="Search pages, models and actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/copilot")}>
            <Bot /> Ask copilot
          </CommandItem>
          <CommandItem onSelect={() => go("/reports")}>
            <FileDown /> Download report
          </CommandItem>
          <CommandItem onSelect={() => go("/assignment?tour=1")}>
            <Compass /> Start the Professor Tour
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              onOpenChange(false);
            }}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />} Toggle theme
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {NAV.map((n) => (
            <CommandItem key={n.href} value={`${n.title} ${n.description}`} onSelect={() => go(n.href)}>
              <n.icon /> {n.title}
              <CommandShortcut>{n.group}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Models (reference results)">
          {MODELS.map((m) => (
            <CommandItem key={m} value={`model ${m}`} onSelect={() => go(`/models?model=${encodeURIComponent(m)}`)}>
              <Trophy /> {m}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
