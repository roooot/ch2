"use client";

import { Rocket, Database, Bug, FileJson, Globe, Container } from "lucide-react";
import { Card } from "@/components/ui/card";

const SCENARIOS = [
  {
    icon: Rocket,
    title: "دیپلوی پروژه Next.js",
    prompt: "چطور می‌توانم یک پروژه Next.js را روی لیارا دیپلوی کنم؟",
  },
  {
    icon: Database,
    title: "اتصال به دیتابیس MySQL",
    prompt: "چطور از اپلیکیشن Node.js خودم به دیتابیس MySQL لیارا وصل شوم؟",
  },
  {
    icon: Bug,
    title: "عیب‌یابی خطای دیپلوی",
    prompt: "اپلیکیشن من بعد از دیپلوی با خطا مواجه می‌شود، کمکم کن عیب‌یابی کنم.",
  },
  {
    icon: FileJson,
    title: "تحلیل فایل liara.json",
    prompt: "این فایل liara.json من است، لطفاً بررسی کن مشکلی ندارد:\n```json\n{\n  \"platform\": \"next\",\n  \"app\": \"my-app\"\n}\n```",
  },
  {
    icon: Container,
    title: "دیپلوی با Docker",
    prompt: "چطور یک اپلیکیشن را با Dockerfile روی لیارا دیپلوی کنم؟",
  },
  {
    icon: Globe,
    title: "اتصال دامنه اختصاصی",
    prompt: "چطور دامنه اختصاصی خودم را به اپ لیارا متصل کنم؟",
  },
];

export function EmptyState({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-10 text-center">
      <div className="mb-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">به Liara Copilot خوش آمدید 👋</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          دستیار هوشمند مستندات ابر لیارا. سوالات خود را بپرسید، فایل liara.json یا لاگ خطا را برای
          تحلیل ارسال کنید یا یکی از سناریوهای زیر را انتخاب کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
        {SCENARIOS.map((s) => (
          <Card
            key={s.title}
            onClick={() => onSelect(s.prompt)}
            className="p-4 cursor-pointer text-right transition-colors hover:border-primary/60 hover:bg-accent/40"
          >
            <s.icon className="h-5 w-5 text-primary mb-2" />
            <p className="text-sm font-medium">{s.title}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
