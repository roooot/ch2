import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  createDataStreamResponse,
  formatDataStreamPart,
  streamText,
  type CoreMessage,
  type DataStreamWriter,
  type JSONValue,
} from "ai";
import { prisma } from "@/lib/db/prisma";
import { orchestrate } from "@/lib/agent/orchestrator";
import { buildSuggestedActions } from "@/lib/agent/suggested-actions";
import { loadAgentState, saveAgentState } from "@/lib/agent/state";
import { getCachedResponse, setCachedResponse } from "@/lib/cache/query-cache";
import { checkRateLimit, getClientIdentifier } from "@/lib/security/rate-limit";
import { sanitizeUserInput } from "@/lib/security/prompt-injection";
import { loadUserMemory, updateUserMemory } from "@/lib/memory/user-memory";
import { logger } from "@/lib/utils/logger";
import { createInitialAgentState } from "@/types";
import type { Citation, ThinkingStep } from "@/types";

export const maxDuration = 60;

const SESSION_COOKIE = "lc_session";

/** کمکی برای دور زدن محدودیت تایپ سخت‌گیرانه JSONValue هنگام نوشتن annotation های ساخت‌یافته */
function annotate(dataStream: DataStreamWriter, value: Record<string, unknown>) {
  dataStream.writeMessageAnnotation(value as unknown as JSONValue);
}

function asPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const chatRequestSchema = z.object({
  // نسخه‌های قبلی کلاینت در گفت‌وگوی جدید `null` می‌فرستند. آن را مانند
  // نبود شناسه در نظر می‌گیریم تا درخواست معتبرِ کاربر به خطای 400 نرسد.
  conversationId: z.string().cuid().nullish().transform((value) => value ?? undefined),
  // useChat تاریخچه را نیز می‌فرستد، اما سرور فقط پیام آخر را می‌پذیرد.
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(4_000),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    sessionId = uuid();
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // شش ماه
    });
  }

  // --- Rate Limiting ---
  const identifier = getClientIdentifier(req.headers, sessionId);
  const rateLimitResult = checkRateLimit(identifier);
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: "تعداد درخواست‌های شما بیش از حد مجاز است. کمی صبر کنید و دوباره تلاش کنید.",
        retryAfterMs: rateLimitResult.retryAfterMs,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: z.infer<typeof chatRequestSchema>;
  try {
    const parsed = chatRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "بدنه درخواست نامعتبر است." }), { status: 400 });
    }
    body = parsed.data;
  } catch {
    return new Response(JSON.stringify({ error: "بدنه درخواست نامعتبر است." }), { status: 400 });
  }

  const { messages } = body;
  const lastUserMessage = messages.at(-1);
  if (!lastUserMessage || lastUserMessage.role !== "user") {
    return new Response(JSON.stringify({ error: "پیام آخر باید از کاربر باشد." }), { status: 400 });
  }

  const userText = sanitizeUserInput(lastUserMessage.content);
  if (!userText) {
    return new Response(JSON.stringify({ error: "متن پیام کاربر خالی است." }), { status: 400 });
  }

  // --- مدیریت گفتگو و تاریخچه: فقط از داده‌های تحت مالکیت همین session استفاده می‌شود. ---
  let priorMessages: CoreMessage[] = [];
  let conversation: { id: string };

  if (body.conversationId) {
    const existingConversation = await prisma.conversation.findFirst({
      where: { id: body.conversationId, sessionId },
      include: {
        messages: {
          where: { role: { in: ["USER", "ASSISTANT"] } },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: { role: true, content: true },
        },
      },
    });

    if (!existingConversation) {
      return new Response(JSON.stringify({ error: "گفتگو یافت نشد." }), { status: 404 });
    }

    priorMessages = existingConversation.messages.reverse().map((message) => ({
      role: message.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: sanitizeUserInput(message.content),
    }));
    conversation = existingConversation;
  } else {
    conversation = await prisma.conversation.create({
      data: {
        sessionId,
        title: userText.slice(0, 80),
        agentState: asPrismaJson(createInitialAgentState()),
      },
    });
  }

  // ذخیره پیام کاربر
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: userText,
    },
  });

  const [agentState, userMemory] = await Promise.all([
    loadAgentState(conversation.id),
    loadUserMemory(sessionId),
  ]);

  // --- بررسی Query Cache برای سوالات تکراری (کاهش هزینه) ---
  const cached = agentState.phase === "idle" || agentState.phase === "answering"
    ? await getCachedResponse(userText)
    : null;

  return createDataStreamResponse({
    execute: async (dataStream) => {
      annotate(dataStream, { type: "conversation_id", id: conversation!.id });

      if (cached) {
        const cacheStep: ThinkingStep = {
          type: "cache",
          label: "پاسخ از کش سوالات تکراری بازیابی شد ⚡",
          status: "done",
        };
        annotate(dataStream, { type: "thinking_steps", steps: [cacheStep] });
        annotate(dataStream, { type: "intent", intent: "faq" });
        annotate(dataStream, { type: "citations", citations: cached.citations });

        // استریم دستی متن کش‌شده برای حفظ تجربه یکسان با useChat
        dataStream.write(formatDataStreamPart("text", cached.response));

        const suggested = buildSuggestedActions("faq", userText, cached.citations);
        annotate(dataStream, { type: "suggested_actions", actions: suggested });

        const savedMessage = await prisma.message.create({
          data: {
            conversationId: conversation!.id,
            role: "ASSISTANT",
            content: cached.response,
            intent: "faq",
            thinkingSteps: asPrismaJson([cacheStep]),
            citations: asPrismaJson(cached.citations),
            suggestedActions: asPrismaJson(suggested),
          },
        });
        annotate(dataStream, { type: "message_id", id: savedMessage.id });

        await Promise.all([
          logApiCall({
            sessionId,
            conversationId: conversation!.id,
            intent: "faq",
            cacheHit: true,
            startedAt,
          }),
          updateUserMemory({
            sessionId,
            userMessage: userText,
            intent: "faq",
            topic: userText.slice(0, 160),
          }),
        ]);

        return;
      }

      const orchestration = await orchestrate(userText, priorMessages, agentState, userMemory);

      annotate(dataStream, {
        type: "thinking_steps",
        steps: orchestration.thinkingSteps,
      });
      annotate(dataStream, { type: "intent", intent: orchestration.intent });

      const result = streamText({
        model: orchestration.model,
        system: orchestration.system,
        messages: orchestration.messages,
        tools: orchestration.tools,
        maxSteps: orchestration.maxSteps,
        onFinish: async ({ text, usage }) => {
          const citations = dedupeCitations(orchestration.citationsRef.current);
          const suggestedActions = buildSuggestedActions(orchestration.intent, userText, citations);

          annotate(dataStream, { type: "citations", citations });
          annotate(dataStream, { type: "suggested_actions", actions: suggestedActions });

          const savedMessage = await prisma.message.create({
            data: {
              conversationId: conversation!.id,
              role: "ASSISTANT",
              content: text,
              intent: orchestration.intent,
              thinkingSteps: asPrismaJson(orchestration.thinkingSteps),
              citations: asPrismaJson(citations),
              suggestedActions: asPrismaJson(suggestedActions),
            },
          });
          annotate(dataStream, { type: "message_id", id: savedMessage.id });

          await Promise.all([
            saveAgentState(conversation!.id, orchestration.newAgentState),
            updateUserMemory({
              sessionId,
              userMessage: userText,
              intent: orchestration.intent,
              topic: orchestration.newAgentState.topicMemory.at(-1) ?? "",
            }),
            orchestration.cacheable && citations.length > 0
              ? setCachedResponse(userText, text, citations)
              : Promise.resolve(),
            logApiCall({
              sessionId,
              conversationId: conversation!.id,
              intent: orchestration.intent,
              cacheHit: false,
              startedAt,
              model: orchestration.model.modelId,
              promptTokens: usage?.promptTokens,
              completionTokens: usage?.completionTokens,
            }),
          ]);
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (error) => {
      logger.error("chat_route_stream_error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "متاسفانه در پردازش درخواست شما خطایی رخ داد. لطفاً دوباره تلاش کنید.";
    },
  });
}

function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const c of citations) {
    const existing = seen.get(c.chunkId);
    if (!existing || c.score > existing.score) {
      seen.set(c.chunkId, c);
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function logApiCall(params: {
  sessionId: string;
  conversationId: string;
  intent: string;
  cacheHit: boolean;
  startedAt: number;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}) {
  try {
    await prisma.apiLog.create({
      data: {
        sessionId: params.sessionId,
        conversationId: params.conversationId,
        route: "/api/chat",
        intent: params.intent,
        model: params.model,
        promptTokens: params.promptTokens ?? 0,
        completionTokens: params.completionTokens ?? 0,
        latencyMs: Date.now() - params.startedAt,
        cacheHit: params.cacheHit,
        statusCode: 200,
      },
    });
  } catch (error) {
    logger.error("api_log_write_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
