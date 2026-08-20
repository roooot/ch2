"use client";

import { ArrowUpLeft, Database, FileJson, Rocket, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const STARTING_POINTS = [
  {
    icon: Rocket,
    title: "اولین دیپلوی",
    prompt: "برای دیپلوی یک پروژه Next.js روی لیارا از کجا شروع کنم؟",
  },
  {
    icon: Database,
    title: "اتصال دیتابیس",
    prompt: "چطور اپ Node.js را به دیتابیس MySQL لیارا متصل کنم؟",
  },
  {
    icon: Wrench,
    title: "خطای اجرا",
    prompt: "اپلیکیشن من بعد از دیپلوی خطا می‌دهد؛ برای عیب‌یابی چه اطلاعاتی لازم داری؟",
  },
  {
    icon: FileJson,
    title: "تحلیل پیکربندی",
    prompt: "فایل liara.json من را بررسی کن و بگو برای دیپلوی آماده است یا نه.",
  },
];

export function EmptyState({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <Empty className="my-auto min-h-[26rem] border-0 bg-transparent px-0 py-8 sm:py-12">
      <EmptyHeader className="max-w-xl">
        <EmptyMedia variant="icon" className="size-12 rounded-md bg-primary text-primary-foreground">
          <Rocket aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="text-xl font-semibold sm:text-2xl">فضای کار مستندات لیارا</EmptyTitle>
        <EmptyDescription className="max-w-lg text-sm leading-7">
          برای پیکربندی، دیپلوی، خطاهای اجرا یا خواندن مستندات دقیق کمک بگیرید. پاسخ‌ها همراه با منبع ارائه می‌شوند.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl items-stretch gap-2">
        <p className="text-right text-xs font-medium text-muted-foreground">از یکی از نقطه‌های شروع استفاده کنید</p>
        <div className="grid grid-cols-1 gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
          {STARTING_POINTS.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.title}
                type="button"
                variant="ghost"
                className="h-auto justify-between rounded-none bg-background px-4 py-3 text-right hover:bg-accent"
                onClick={() => onSelect(item.prompt)}
              >
                <span className="flex items-center gap-3">
                  <Icon data-icon="inline-start" />
                  <span>{item.title}</span>
                </span>
                <ArrowUpLeft data-icon="inline-end" />
              </Button>
            );
          })}
        </div>
      </EmptyContent>
    </Empty>
  );
}
