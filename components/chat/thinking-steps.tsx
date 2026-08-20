"use client";

import { useState } from "react";
import { ChevronDown, CircleDot, Loader2, Search, Sparkles, Wrench, Database, HelpCircle, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThinkingStep, ThinkingStepType } from "@/types";

/**
 * نمایش شفاف مراحل فکر کردن ایجنت (Chain of Thought UI)
 * قابل جمع/بازشدن؛ به کاربر نشان می‌دهد ایجنت چه مراحلی را طی کرده است.
 */

const ICONS: Record<ThinkingStepType, React.ComponentType<{ className?: string }>> = {
  intent_detection: Sparkles,
  retrieval: Search,
  rerank: FileSearch,
  clarify: HelpCircle,
  troubleshoot: Wrench,
  config_analysis: Database,
  generation: CircleDot,
  cache: CircleDot,
};

export function ThinkingSteps({ steps }: { steps: ThinkingStep[] }) {
  const [open, setOpen] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="mb-2 rounded-md border bg-muted/40 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          مراحل فکر کردن ایجنت ({steps.length} مرحله)
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul className="space-y-1.5 px-3 pb-3">
          {steps.map((step, idx) => {
            const Icon = ICONS[step.type] ?? CircleDot;
            return (
              <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                {step.status === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 mt-0.5 animate-spin shrink-0" />
                ) : (
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="text-foreground/80">{step.label}</span>
                  {step.detail && <p className="text-[11px] mt-0.5 opacity-80">{step.detail}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
