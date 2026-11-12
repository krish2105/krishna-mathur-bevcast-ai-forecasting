import type { Metadata } from "next";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { PageHeader } from "@/components/common/page-header";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { llmConfig } from "@/lib/ai/config";

export const metadata: Metadata = {
  title: "BevCast AI Copilot",
  description: "A tool-calling LLM copilot grounded on the notebook results, live FRED and Open-Meteo feeds and your uploaded data.",
};

// Reads the server environment at request time (key presence only; the key never reaches the browser).
export const dynamic = "force-dynamic";

export default async function CopilotPage({ searchParams }: PageProps<"/copilot">) {
  const cfg = llmConfig();
  const sp = await searchParams;
  const initialPrompt = typeof sp.prompt === "string" ? sp.prompt : "";
  return (
    <div className="space-y-6" data-testid="page-copilot">
      <PageHeader
        eyebrow="Part 2 · LLM interpretation on real-time data (notebook §2.13)"
        title="BevCast AI Copilot"
        description="Google Gemini, through the Vercel AI SDK with tool calling. Each answer shows which tools (data) it used, where the numbers came from and when the data were retrieved."
        badges={
          <>
            {cfg.configured ? <ProvenanceBadge kind="ai">Live LLM</ProvenanceBadge> : <ProvenanceBadge kind="fallback" />}
            <ProvenanceBadge kind="live">Real-time feeds</ProvenanceBadge>
          </>
        }
      />
      <CopilotChat configured={cfg.configured} model={cfg.model} initialPrompt={initialPrompt} />
    </div>
  );
}
