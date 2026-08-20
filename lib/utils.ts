import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** ابزار ترکیب کلاس‌های Tailwind (الگوی استاندارد shadcn/ui) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
