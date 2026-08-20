"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Citation } from "@/types";

export function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  return (
    <a href={citation.url} target="_blank" rel="noopener noreferrer" className="group block h-full">
      <Card className="h-full rounded-md border-border shadow-none transition-colors hover:bg-accent">
        <CardHeader className="gap-2 p-3 pb-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileText aria-hidden="true" />
              منبع {index + 1}
            </span>
            <ExternalLink aria-hidden="true" className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </div>
          <CardTitle className="line-clamp-2 text-sm leading-6">{citation.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{citation.snippet}</p>
          <Badge variant="secondary" className="mt-3 text-[10px] font-normal">
            ارتباط {citation.score}
          </Badge>
        </CardContent>
      </Card>
    </a>
  );
}

export function CitationGrid({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <section className="mt-4 w-full" aria-label="منابع پاسخ">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FileText aria-hidden="true" />
        منابع قابل‌پیگیری
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {citations.map((citation, index) => (
          <CitationCard key={citation.chunkId} citation={citation} index={index} />
        ))}
      </div>
    </section>
  );
}
