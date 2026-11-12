"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UploadProvider } from "@/components/data/upload-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider delayDuration={150}>
        <UploadProvider>{children}</UploadProvider>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
