"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Citation } from "@/types";

/**
 * کارت نمایش Citation (منبع مستندات)
 * روی کلیک، منبع اصلی در تب جدید باز می‌شود
 */
export function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  return (
    <a href={citation.url} target="_blank" rel="noopener noreferrer" className="block group">
      <Card className="p-3 h-full transition-colors hover:border-primary/60 hover:bg-accent/40">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>منبع {index + 1}</span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-sm font-semibold leading-snug mb-1 line-clamp-2">{citation.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{citation.snippet}</p>
        <div className="mt-2">
          <Badge variant="secondary" className="text-[10px]">
            امتیاز ربط: {citation.score}
          </Badge>
        </div>
      </Card>
    </a>
  );
}

export function CitationGrid({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">📚 منابع استفاده‌شده:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {citations.map((c, i) => (
          <CitationCard key={c.chunkId} citation={c} index={i} />
        ))}
      </div>
    </div>
  );
}
