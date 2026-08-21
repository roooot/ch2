# 🚀 Liara Copilot

دستیار هوشمند **ایجنتیک** برای مستندات ابر [لیارا](https://liara.ir) (Liara Cloud) — پاسخ‌گویی دقیق مبتنی بر RAG با Citation، تشخیص Intent، پرسش تکمیلی، عیب‌یابی چندمرحله‌ای، تحلیل `liara.json`/لاگ خطا و تور راهنمای گام‌به‌گام.

هدف پروژه: **کاهش تیکت‌های پشتیبانی لیارا** با ارائه پاسخ سریع، دقیق و شفاف به کاربران، مستقیماً بر اساس مستندات رسمی ([docs.liara.ir](https://docs.liara.ir) / [github.com/liara-cloud/docs](https://github.com/liara-cloud/docs)).

همه چیز در **یک پروژه Next.js واحد** (فرانت + بک‌اند + پایگاه‌دانش) پیاده‌سازی شده و برای دیپلوی روی پلتفرم Next.js لیارا آماده است.

**نسخهٔ آنلاین:** [liara-copilot.liara.run](https://liara-copilot.liara.run) · **شاخهٔ انتشار:** `main`
**محیط آزمایشی:** [liara-copilot-dev.liara.run](https://liara-copilot-dev.liara.run) · **شاخه:** `dev`

---

## فهرست مطالب

- [معماری](#معماری)
- [قابلیت‌های نسخهٔ فعلی](#قابلیتهای-نسخهٔ-فعلی)
- [استک فنی](#استک-فنی)
- [ساختار پروژه](#ساختار-پروژه)
- [راه‌اندازی لوکال](#راه‌اندازی-لوکال)
- [تنظیم Environment Variables](#تنظیم-environment-variables)
- [اجرای Ingestion مستندات](#اجرای-ingestion-مستندات)
- [دیپلوی روی لیارا (گام‌به‌گام)](#دیپلوی-روی-لیارا-گام‌به‌گام)
- [معماری Agentic به‌تفصیل](#معماری-agentic-به‌تفصیل)
- [نکات امنیتی](#نکات-امنیتی)
- [بهینه‌سازی هزینه](#بهینه‌سازی-هزینه)
- [توسعه و نگهداری](#توسعه-و-نگهداری)

---

## معماری

```
┌─────────────────────────────────────────────────────────────────────┐
│                           کاربر (مرورگر)                            │
│         UI چت فارسی/RTL  (Next.js App Router + React 19)            │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ useChat (Vercel AI SDK) + Data Stream
┌───────────────────────────────▼───────────────────────────────────────┐
│                      app/api/chat/route.ts                          │
│  Rate Limit → Prompt Injection Guard → Query Cache Check            │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────────┐
│                 Agent Orchestrator (State Machine)                  │
│                                                                       │
│   Intent Classification (مدل ارزان) → Router                        │
│        ├── clarify_needed      → پرسش تکمیلی                        │
│        ├── faq                 → Hybrid Retrieval + Rerank → RAG     │
│        ├── troubleshoot        → عیب‌یابی چندمرحله‌ای (حفظ Context)  │
│        ├── config_analysis     → تحلیل قانون‌محور liara.json/لاگ     │
│        └── guided_tour         → تور راهنمای گام‌به‌گام              │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────────┐
│              streamText (مدل قوی) + Tools + maxSteps                │
│   ابزارها: RAG / تحلیل فایل / خواندن اپ و لاگِ حسابِ متصلِ کاربر    │
│   محافظت: Circuit Breaker روی هر فراخوانی سرویس AI                  │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────────┐
│                     MySQL (لیارا DBaaS یا لوکال)                    │
│  documents / chunks (embedding=JSON) / conversations / messages /   │
│  feedback / query_cache / api_logs                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### چرا بدون pgvector؟

طبق الزامات پروژه، به‌جای وابستگی به `pgvector` یا یک وکتور دیتابیس جداگانه، بردارهای Embedding به‌صورت **JSON** در ستون `embedding` جدول `chunks` (MySQL) ذخیره می‌شوند و محاسبه **Cosine Similarity** به‌طور کامل در Node.js انجام می‌شود (`lib/utils/vector.ts`). این روش برای مقیاس داکیومنت‌های یک پایگاه‌دانش مستندات (چند هزار chunk) کاملاً کافی و قابل‌قبول است.

### Hybrid Retrieval

1. **Vector Search**: محاسبه Cosine Similarity بین Embedding سوال و Embedding تمام chunk‌های کاندید.
2. **Full-Text Search**: استفاده از ایندکس `FULLTEXT` بومی MySQL (`MATCH ... AGAINST`) روی ستون `content`.
3. **ترکیب امتیاز** با وزن‌دهی (۶۵٪ وکتور / ۳۵٪ متنی) و در نهایت **Rerank** با یک مدل زبانی ارزان برای افزایش دقت نهایی.

---

## استک فنی

| بخش | تکنولوژی |
|---|---|
| فریم‌ورک | Next.js 16 (App Router) + TypeScript + React 19 |
| استایل | Tailwind CSS + shadcn/ui (Sidebar، Sheet، Command، Alert Dialog و …) |
| هوش مصنوعی | Vercel AI SDK (`ai` + `@ai-sdk/openai` + `@ai-sdk/react`) |
| دیتابیس | MySQL از طریق Prisma ORM |
| فونت | Vazirmatn (فارسی، از طریق `next/font/google`) |
| احراز نشست | کوکی ناشناس `httpOnly` و `secure` در production (بدون نیاز به لاگین) |

---

## قابلیت‌های نسخهٔ فعلی

- **پاسخ مستند و قابل پیگیری:** پاسخ‌های RAG با Citation به صفحهٔ رسمی مستندات لیارا نمایش داده می‌شوند.
- **پایگاه‌دانش کامل و بدون تکرار:** تنها corpus مخصوص LLM در `public/llms` مخزن رسمی لیارا وارد می‌شود؛ لینک اصلی هر سند برای Citation حفظ می‌شود.
- **رابط فارسی و واکنش‌گرا:** فونت Vazirmatn، راست‌به‌چپ واقعی، جداسازی درست متن‌های فارسی و انگلیسی، سایدبار موبایل و میان‌بر `Ctrl/Cmd + K` برای فرمان‌ها و جست‌وجوی گفتگوها.
- **حافظهٔ کاربر و تاریخچه:** خلاصهٔ کنترل‌شدهٔ زمینهٔ گفتگو در کنار تاریخچه ذخیره می‌شود و از سایدبار قابل پاک‌سازی است.
- **اتصال موقت حساب لیارا:** کاربر می‌تواند API Key و Team ID خود را برای همان نشست متصل کند؛ ایجنت فقط فهرست اپ‌ها و لاگ‌های خطا را می‌خواند و هرگز deploy، restart، حذف یا تغییر تنظیمات انجام نمی‌دهد.
- **تجربهٔ گفتگو:** هالهٔ ظریف رنگی فقط هنگام شروع گفتگوی جدید دیده می‌شود و پس از نخستین پیام محو می‌گردد.
- **عملیات ایمن:** endpoint ادمین برای Ingestion با `ADMIN_SECRET` محافظت شده، بدنهٔ درخواست و پیام چت سقف دارند، فایل‌های ورودی پیش از تحلیل اعتبارسنجی می‌شوند و داده‌های حساس در ورودی/فایل/لاگ ماسک می‌شوند.

---

## ساختار پروژه

```
liara-copilot/
├── app/
│   ├── api/
│   │   ├── admin/ingest/route.ts     # Ingestion مرحله‌ای و محافظت‌شده
│   │   ├── chat/route.ts            # اصلی‌ترین Endpoint - استریم پاسخ ایجنت
│   │   ├── feedback/route.ts        # ثبت 👍/👎
│   │   ├── conversations/route.ts   # لیست/حذف گفتگوها
│   │   ├── conversations/[id]/route.ts
│   │   └── health/route.ts          # Health check برای مانیتورینگ
│   ├── layout.tsx                   # RTL + فونت + تم
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── chat/                        # کامپوننت‌های چت (Container, MessageBubble, ...)
│   ├── sidebar/                     # سایدبار تاریخچه گفتگو
│   ├── providers/                   # ThemeProvider
│   └── ui/                          # کامپوننت‌های shadcn/ui
├── lib/
│   ├── agent/                       # ⭐ لایه Agentic: orchestrator, intent, prompts, tools, state
│   ├── rag/                         # ⭐ Embedding, Hybrid Search, Rerank, Retrieval
│   ├── security/                    # Rate Limit, Prompt Injection Guard, Circuit Breaker
│   ├── cache/                       # Query Cache
│   ├── ingestion/                   # پایپلاین Ingestion از گیت‌هاب
│   ├── memory/                       # حافظهٔ خلاصه‌شدهٔ بین‌گفت‌وگویی هر کاربر
│   ├── ai/                          # پیکربندی مدل‌های دو سطحی
│   ├── db/                          # Prisma Client (Singleton)
│   └── utils/                       # ابزارهای عمومی (vector, tokens, logger, annotations)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   └── ingest.ts                    # CLI اجرای Ingestion
├── types/
│   └── index.ts                     # تایپ‌های مشترک
├── liara.json                       # پیکربندی دیپلوی روی لیارا
└── .env.example
```

### حافظه و حریم خصوصی

- **تاریخچهٔ گفتگو** در دیتابیس ذخیره می‌شود و با بازکردن همان گفتگو دوباره از سرور خوانده می‌شود.
- **حافظهٔ بین‌گفت‌وگویی** یک خلاصهٔ محدود از زمینهٔ فنی، پروژه‌ها و مسئله‌های باز کاربر است. این حافظه با `sessionId` کوکی ناشناس مرتبط است؛ بنابراین بین مرورگرها یا پس از پاک‌شدن کوکی قابل شناسایی نیست.
- کلید API، رمز عبور و Connection String در خلاصهٔ حافظه نگه‌داری نمی‌شوند. کاربر می‌تواند از سایدبار گزینهٔ «پاک‌کردن حافظهٔ بین‌گفت‌وگویی» را بزند؛ این کار تاریخچهٔ پیام‌های گفتگو را حذف نمی‌کند.
- **کلید اتصال حساب لیارا** هرگز به مرورگر برنمی‌گردد، در کوکی هم ذخیره نمی‌شود و فقط به‌صورت رمزنگاری‌شده با AES-256-GCM در سرور نگه‌داری می‌گردد. اتصال پس از حداکثر ۸ ساعت منقضی می‌شود یا کاربر می‌تواند فوراً آن را قطع کند.

---

## راه‌اندازی لوکال

### پیش‌نیازها

- Node.js ۲۰ یا بالاتر
- یک دیتابیس MySQL ۸ (لوکال، Docker، یا سرویس MySQL لیارا)
- یک API Key سازگار با OpenAI (خود OpenAI یا هر Proxy سازگار)

### مراحل

```bash
# ۱. نصب پکیج‌ها
npm install

# ۲. کپی فایل env و تنظیم مقادیر
cp .env.example .env.local
# سپس DATABASE_URL و OPENAI_API_KEY را در .env.local پر کنید

# ۳. اجرای Migration روی دیتابیس
npx prisma migrate dev --name init

# ۴. (اختیاری ولی پیشنهادی) ایمپورت مستندات لیارا از گیت‌هاب
npm run ingest

# ۵. اجرای پروژه در حالت توسعه
npm run dev
```

سپس به آدرس `http://localhost:3000` بروید.

> 💡 اگر دیتابیس MySQL لوکال ندارید، سریع‌ترین راه اجرای یک کانتینر است:
> ```bash
> docker run --name liara-copilot-db -e MYSQL_ROOT_PASSWORD=password \
>   -e MYSQL_DATABASE=liara_copilot -p 3306:3306 -d mysql:8
> ```

---

## تنظیم Environment Variables

تمام متغیرها در `.env.example` مستند شده‌اند. مهم‌ترین‌ها:

| متغیر | توضیح |
|---|---|
| `DATABASE_URL` | Connection String کامل MySQL، فرمت: `mysql://user:pass@host:port/db` |
| `OPENAI_API_KEY` | کلید API مدل زبانی (اجباری) |
| `OPENAI_BASE_URL` | در صورت استفاده از سرویس سازگار با OpenAI (اختیاری) |
| `MODEL_CHEAP` | مدل ارزان برای Intent/Rerank (پیش‌فرض `gpt-4o-mini`) |
| `MODEL_STRONG` | مدل قوی برای پاسخ نهایی (پیش‌فرض `gpt-4o`) |
| `MODEL_EMBEDDING` | مدل Embedding (پیش‌فرض `text-embedding-3-small`) |
| `ADMIN_SECRET` | کلید موردنیاز برای endpoint محافظت‌شدهٔ Ingestion در `/api/admin/ingest` |
| `LIARA_CONNECTION_ENCRYPTION_KEY` | کلید Base64 با ۳۲ بایت تصادفی برای رمزنگاری اتصال موقت حساب کاربران؛ با `openssl rand -base64 32` تولید کنید |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` | تنظیمات Rate Limiting |
| `DOCS_GITHUB_REPO` / `DOCS_GITHUB_BRANCH` | ریپو/شاخه منبع Ingestion (پیش‌فرض `liara-cloud/docs` / `master`) |
| `GITHUB_TOKEN` | (اختیاری) برای افزایش Rate Limit فراخوانی GitHub API در Ingestion |
| `NEXT_PUBLIC_APP_URL` | آدرس عمومی اپلیکیشن، مانند `https://your-app.liara.run` |

⚠️ **هرگز** فایل `.env.local` یا هر فایل حاوی کلید واقعی را کامیت نکنید (در `.gitignore` مسدود شده است). فایل `.env.example` نیز باید فقط placeholder داشته باشد. روی پنل لیارا این مقادیر باید از بخش **Environment Variables** تنظیم شوند، نه در کد. مقدار `LIARA_CONNECTION_ENCRYPTION_KEY` را بعد از راه‌اندازی تغییر ندهید؛ با تغییر آن اتصال‌های موقت پیشین دیگر قابل رمزگشایی نیستند و به‌صورت امن نامعتبر می‌شوند.

---

## اجرای Ingestion مستندات

پایپلاین Ingestion (`lib/ingestion/`) فقط سندهای Markdown بخش `public/llms` از مخزن رسمی `liara-cloud/docs` را دریافت، Chunk، Embed و در MySQL ذخیره می‌کند. این بخش برای مصرف مدل زبانی آماده است، از ورود نسخه‌های تکراری جلوگیری می‌کند و Citation را به لینک اصلی `docs.liara.ir` متصل نگه می‌دارد.

```bash
# ایمپورت فقط فایل‌های جدید/تغییریافته (بر اساس هش محتوا)
npm run ingest

# پاکسازی کامل و ایمپورت مجدد از صفر
npm run ingest:clean
```

### ورود مرحله‌ای در production

در production، برای جلوگیری از timeout، endpoint محافظت‌شدهٔ `POST /api/admin/ingest`
هر بار یک batch کوچک از corpus رسمی را وارد می‌کند. هدر `x-admin-secret` باید با
`ADMIN_SECRET` برابر باشد. پاسخ شامل `nextCursor` و `completed` است؛ مقدار `nextCursor`
را تا زمان `completed: true` در فراخوانی بعدی بفرستید. `GET /api/admin/ingest` نیز با
همان هدر، تعداد `documents`، `chunks` و embeddingهای آماده را برمی‌گرداند.

منبع canonical فقط `public/llms` از شاخهٔ `master` مخزن رسمی است تا اسناد مخصوص LLM
بدون تکرار و بدون JSX وارد شوند. پاسخ `GET /api/admin/ingest` وضعیت فعلی ایندکس را برمی‌گرداند؛ برای نمونهٔ وضعیت:

```bash
curl https://<your-app>.liara.run/api/admin/ingest \
  -H "x-admin-secret: <ADMIN_SECRET>"
```

برای یک batch جدید، ابتدا بدون Cursor اجرا کنید و سپس `nextCursor` برگشتی را تا `completed: true` به فراخوانی بعدی بدهید:

```bash
curl -X POST https://<your-app>.liara.run/api/admin/ingest \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  --data '{"limit":24}'
```

نحوه عملکرد:
1. دریافت لیست فایل‌های `.md` از مسیر canonical در GitHub API (`git/trees?recursive=1`).
2. برای هر فایل: پارس Frontmatter، محاسبه `sha256` محتوا.
3. اگر هش نسبت به قبل تغییر نکرده باشد، فایل رد می‌شود (صرفه‌جویی در هزینه Embedding).
4. متن به Chunk‌های ۳۵۰ توکنی با هم‌پوشانی ۵۰ توکن تقسیم می‌شود.
5. برای هر Chunk، Embedding به‌صورت Batch گرفته و در دیتابیس ذخیره می‌شود.

> این اسکریپت را می‌توانید به‌صورت دوره‌ای (مثلاً هفتگی) با یک Cron Job روی لیارا یا GitHub Actions اجرا کنید تا پایگاه‌دانش همیشه به‌روز باشد.

---

## دیپلوی روی لیارا (گام‌به‌گام)

### روش رسمی این مخزن: انتشار خودکار از GitHub Actions

هر Push روی شاخهٔ `main` به‌صورت خودکار این مسیر را اجرا می‌کند:

```
main → GitHub Actions → ساخت Docker image → GHCR → Liara deploy → Prisma migrate deploy
```

Workflow در [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) تعریف شده است. بنابراین برای انتشار تغییرات معمول، فقط کافی است تغییرات بررسی‌شده را روی `main` Push کنید. اجرای Build روی GitHub انجام می‌شود تا محدودیت زمانی Build در لیارا مانع انتشار نشود.

### پیش‌نیازهای یک‌باره

### ۱. نصب CLI لیارا

```bash
npm install -g @liara/cli
liara login
```

### ۲. ساخت دیتابیس MySQL روی پنل لیارا

از پنل لیارا → **دیتابیس‌ها** → **ساخت دیتابیس جدید** → نوع `MySQL` را انتخاب کنید. بعد از ساخت، از بخش **اتصال به دیتابیس**، مقدار **Connection String** را کپی کنید (شبیه `mysql://user:pass@host:port/dbname`).

### ۳. ساخت اپلیکیشن Next.js روی پنل لیارا

از پنل لیارا → **اپلیکیشن‌ها** → **ساخت اپلیکیشن جدید** → پلتفرم `Next.js` را انتخاب کنید. نام اپ باید با فیلد `app` در `liara.json` یکسان باشد.

### ۴. تنظیم Environment Variables روی پنل

از بخش **متغیرهای محیطی** اپلیکیشن، مقادیر زیر را (مطابق `.env.example`) وارد کنید:

```
DATABASE_URL=mysql://...   (از مرحله ۲)
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.avalai.ir/v1  # فقط برای ارائه‌دهندهٔ سازگار با OpenAI
MODEL_CHEAP=gpt-4o-mini
MODEL_STRONG=gpt-4o
MODEL_EMBEDDING=text-embedding-3-small
ADMIN_SECRET=<یک رشته تصادفی و امن>
RATE_LIMIT_MAX_REQUESTS=20
RATE_LIMIT_WINDOW_MS=60000
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://<your-app>.liara.run
DOCS_GITHUB_REPO=liara-cloud/docs
DOCS_GITHUB_BRANCH=master
```

### ۵. تنظیم Secret مربوط به GitHub Actions

در تنظیمات مخزن GitHub، از مسیر **Settings → Secrets and variables → Actions** یک Secret با نام زیر بسازید:

```bash
LIARA_API_TOKEN=<Liara API token>
```

این توکن فقط در زمان اجرای Workflow استفاده می‌شود و نباید در کد، فایل `.env` یا README قرار بگیرد.

### ۶. انتشار نسخه

بعد از Commit و Push روی `main`:

```bash
git push origin main
```

GitHub Actions image را در GitHub Container Registry منتشر می‌کند و همان image را در لیارا deploy می‌کند. Migrationهای Prisma نیز هنگام راه‌اندازی container و در شبکهٔ خصوصی دیتابیس به‌شکل idempotent اجرا می‌شوند؛ در روند عادی، اجرای دستی Migration لازم نیست.

### ۷. اجرای Ingestion برای اولین‌بار (روی Production)

برای corpus بزرگ مستندات، از endpoint مرحله‌ای توضیح‌داده‌شده در بخش [اجرای Ingestion مستندات](#اجرای-ingestion-مستندات) استفاده کنید. اجرای همهٔ اسناد در یک درخواست یا از داخل image production توصیه نمی‌شود؛ batchهای کوچک با Cursor در برابر Timeout مقاوم هستند.

### ۸. بررسی سلامت سرویس

```bash
curl https://<your-app>.liara.run/api/health
```

باید خروجی مشابه زیر دریافت کنید:

```json
{ "status": "ok", "database": "connected", "aiCircuitBreaker": "CLOSED" }
```

---

## معماری Agentic به‌تفصیل

پیاده‌سازی در `lib/agent/orchestrator.ts` قرار دارد و هسته State Machine ایجنت است:

1. **Prompt Injection Guard** روی ورودی خام کاربر.
2. **Intent Classification** با مدل ارزان (`lib/agent/intent-classifier.ts`) — خروجی: `faq` / `troubleshoot` / `config_analysis` / `guided_tour` / `clarify_needed` / `chitchat`. برخی موارد ساده (متن خیلی کوتاه، وجود JSON/لاگ) بدون فراخوانی مدل و صرفاً با Regex تشخیص داده می‌شوند تا هزینه/تاخیر کم شود.
3. **Router**: بر اساس Intent و وضعیت فعلی گفتگو (ذخیره‌شده در `Conversation.agentState`)، مسیر مناسب انتخاب می‌شود:
   - **Clarify**: یک سوال کوتاه و دقیق پرسیده می‌شود (بدون فراخوانی مدل قوی).
   - **FAQ (RAG)**: بازیابی Hybrid + Rerank، سپس پاسخ با ارجاع `[منبع N]`.
   - **Troubleshoot**: فرآیند چندمرحله‌ای؛ وضعیت (`problemSummary`, `stepsAsked`, `currentStep`) بین پیام‌ها در دیتابیس حفظ می‌شود.
   - **Config Analysis**: تحلیل قانون‌محور و قطعی (`lib/agent/config-analyzer.ts`) روی `liara.json`/لاگ خطا، سپس توضیح آن به زبان طبیعی توسط مدل.
   - **Guided Tour**: تورهای از پیش تعریف‌شده (`lib/agent/guided-tour.ts`) با پیشروی مرحله‌به‌مرحله.
4. **Tools (`lib/agent/tools.ts`)**: مدل قوی می‌تواند در طول تولید پاسخ (`maxSteps` > 1) به‌صورت خودمختار `searchLiariaDocs` یا `analyzeLiariaConfig` را دوباره صدا بزند اگر Context اولیه کافی نبود.
5. **شفافیت (Thinking Steps)**: هر مرحله از تصمیم‌گیری ایجنت به‌صورت `ThinkingStep` ثبت و از طریق Message Annotations به UI استریم می‌شود؛ کاربر می‌تواند با کلیک روی «مراحل فکر کردن ایجنت» آن‌ها را ببیند.
6. **Suggested Actions**: بعد از هر پاسخ، ۲ تا ۳ قدم بعدی پیشنهادی (به‌صورت دکمه) بر اساس Intent و Citation‌ها تولید می‌شود.

---

## نکات امنیتی

- **کلیدهای API**: فقط از طریق Environment Variables خوانده می‌شوند (`process.env`)، هرگز در کد Hardcode نشده‌اند.
- **اتصال حساب کاربر**: اعتبارسنجی با درخواست `GET` به API رسمی لیارا انجام می‌شود و ابزارهای ایجنت صرفاً از endpointهای read-only فهرست اپ‌ها و لاگ استفاده می‌کنند. توکن رمزنگاری‌شده، زمان‌دار و قابل حذف فوری است.
- **حدود ورودی**: هر پیام چت حداکثر ۴٬۰۰۰ کاراکتر است؛ بدنهٔ چت پیش از JSON parse به ۱ مگابایت محدود می‌شود. فایل‌های پیوست فقط JSON/TXT/LOG حداکثر ۲۰۰ کیلوبایت هستند و هم پسوند و هم محتوای متنی/JSON آن‌ها بررسی می‌شود.
- **ماسک داده‌های حساس**: توکن‌ها، API Keyها، گذرواژه‌ها، Connection Stringها و مقادیر متغیر محیطی پیش از ذخیره در حافظه یا ارائه به مدل از متن‌های ورودی و لاگ‌های بازیابی‌شده حذف می‌شوند.
- **Prompt Injection Guard** (`lib/security/prompt-injection.ts`): تشخیص الگوهای رایج حمله + Sanitize محتوای بازیابی‌شده از اسناد قبل از تزریق به پرامپت + دستورالعمل امنیتی صریح در تمام System Prompt‌ها.
- **Rate Limiting** (`lib/security/rate-limit.ts`): محدودیت نرخ درخواست بر اساس IP + Session (پیش‌فرض ۲۰ درخواست در دقیقه). برای دیپلوی با چند Instance، توصیه می‌شود این بخش با Redis (`REDIS_URL`) جایگزین شود.
- **Circuit Breaker** (`lib/security/circuit-breaker.ts`): در صورت خرابی متوالی سرویس AI (۵ خطای پیاپی)، درخواست‌های بعدی به‌جای انتظار طولانی و ارور، فوراً fallback می‌گیرند (fail-fast) و بعد از ۳۰ ثانیه به‌صورت Half-Open دوباره تست می‌شوند.
- **Logging ساخت‌یافته** (`lib/utils/logger.ts`): خروجی JSON با سطح‌بندی `debug/info/warn/error` برای سازگاری با ابزارهای لاگ‌آگریگیشن.
- **کوکی نشست**: `httpOnly` + `SameSite=lax`، بدون افشای اطلاعات حساس.

---

## بهینه‌سازی هزینه

- **مدل دو سطحی**: مدل ارزان (`MODEL_CHEAP`) برای Intent Classification و Rerank، مدل قوی (`MODEL_STRONG`) فقط برای تولید پاسخ نهایی.
- **Query Cache** (`lib/cache/query-cache.ts`): پاسخ سوالات پرتکرار (FAQ) با TTL ۲۴ ساعته کش می‌شود؛ فراخوانی مدل قوی برای سوالات تکراری حذف می‌شود.
- **محدودیت Context**: حداکثر ۳۰۰۰ توکن تخمینی از اسناد بازیابی‌شده به مدل قوی داده می‌شود (`lib/rag/retrieval.ts`)، و حداکثر ۵ چانک نهایی بعد از Rerank انتخاب می‌شوند.
- **میانبرهای Regex** در Intent Classification برای پیام‌های واضح (JSON/لاگ/پیام خیلی کوتاه) بدون فراخوانی مدل.
- **Ingestion افزایشی**: فقط اسنادی که هش محتوایشان تغییر کرده دوباره Embed می‌شوند.

---

## توسعه و نگهداری

```bash
npm run dev            # اجرای توسعه
npm run build           # Build نهایی
npm run type-check      # بررسی تایپ‌ها
npm run lint            # بررسی کیفیت کد
npm run ingest          # Ingestion افزایشی مستندات در محیط لوکال
npm run prisma:studio   # مشاهده گرافیکی دیتابیس
npm run prisma:migrate:dev  # ساخت Migration جدید بعد از تغییر schema.prisma
```

### افزودن Intent یا مسیر جدید به ایجنت

1. نوع Intent را به `IntentType` در `types/index.ts` اضافه کنید.
2. آن را به Enum مربوطه در `lib/agent/prompts.ts` (`INTENT_CLASSIFIER_SYSTEM_PROMPT`) و schema در `lib/agent/intent-classifier.ts` اضافه کنید.
3. یک `case` جدید در Router (`lib/agent/orchestrator.ts`) اضافه کنید که System Prompt، مدل و Tools مناسب را برمی‌گرداند.

### به‌روزرسانی وابستگی‌ها

این پروژه روی Next.js 16 نگه‌داری می‌شود. قبل از هر به‌روزرسانی وابستگی، `npm audit`، `npm run lint` و `npm run type-check` را اجرا و راهنمای امنیتی رسمی Next.js/Vercel را بررسی کنید.

---

**Liara Copilot** با ❤️ برای جامعه توسعه‌دهندگان ایرانی ساخته شده است.

**طراحی و توسعه توسط تیم فایتر**
