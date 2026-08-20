/**
 * اسکریپت اجرای Ingestion از خط فرمان
 * نحوه اجرا:
 *   npm run ingest          -> فقط سندهای جدید/تغییریافته را ایمپورت می‌کند
 *   npm run ingest:clean    -> ابتدا همه chunk/document های قبلی را پاک می‌کند، سپس ایمپورت کامل انجام می‌دهد
 */
import { ingestFromGitHub } from "../lib/ingestion/ingest";

async function main() {
  const clean = process.argv.includes("--clean");

  console.log("🚀 شروع Ingestion مستندات لیارا از ریپوی گیت‌هاب...");
  if (clean) {
    console.log("⚠️  حالت clean فعال است؛ همه اسناد قبلی حذف خواهند شد.");
  }

  const stats = await ingestFromGitHub({ clean });

  console.log("\n✅ Ingestion به پایان رسید:");
  console.log(`   کل فایل‌ها: ${stats.totalFiles}`);
  console.log(`   به‌روزرسانی‌شده: ${stats.updated}`);
  console.log(`   بدون تغییر (رد شد): ${stats.skippedUnchanged}`);
  console.log(`   ناموفق: ${stats.failed}`);
  console.log(`   تعداد کل chunk ها: ${stats.totalChunks}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ خطا در اجرای Ingestion:", error);
  process.exit(1);
});
