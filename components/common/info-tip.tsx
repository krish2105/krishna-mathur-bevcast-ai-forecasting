"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";

/** Small (i) button with a definition. Keyboard-focusable; the text is also announced by screen readers. */
export function InfoTip({ term, text, label }: { term?: GlossaryTerm; text?: string; label?: string }) {
  const body = text ?? (term ? GLOSSARY[term].definition : "");
  const name = label ?? (term ? GLOSSARY[term].term : "More information");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`What is ${name}?`}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">
        <span className="font-semibold">{name}. </span>
        {body}
      </TooltipContent>
    </Tooltip>
  );
}
