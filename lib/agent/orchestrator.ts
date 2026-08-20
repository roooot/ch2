import type { CoreMessage, LanguageModel } from "ai";
import { cheapModel, strongModel } from "@/lib/ai/models";
import { classifyIntent } from "@/lib/agent/intent-classifier";
import { retrieveContext, isRetrievalConfident } from "@/lib/rag/retrieval";
import {
  analyzeErrorLog,
  analyzeLiariaJson,
  extractJsonBlock,
  isLikelyLog,
} from "@/lib/agent/config-analyzer";
import { createGuidedTourState, advanceTourStep } from "@/lib/agent/guided-tour";
import { createAgentTools } from "@/lib/agent/tools";
import {
  buildClarifySystemPrompt,
  buildConfigAnalysisSystemPrompt,
  buildFaqSystemPrompt,
  buildGuidedTourSystemPrompt,
  buildTroubleshootSystemPrompt,
  buildUserMemoryContext,
} from "@/lib/agent/prompts";
import { pushTopicMemory } from "@/lib/agent/state";
import { detectPromptInjection, sanitizeUserInput } from "@/lib/security/prompt-injection";
import type { AgentState, Citation, IntentType, ThinkingStep } from "@/types";

export interface OrchestrationResult {
  intent: IntentType;
  thinkingSteps: ThinkingStep[];
  model: LanguageModel;
  system: string;
  messages: CoreMessage[];
  tools?: ReturnType<typeof createAgentTools>;
  maxSteps: number;
  newAgentState: AgentState;
  /** آیا این پاسخ قابل کش شدن است (فقط FAQ های ساده و بدون توهین/تزریق) */
  cacheable: boolean;
  citationsRef: { current: Citation[] };
}

const HISTORY_LIMIT = 6; // حداکثر تعداد پیام قبلی برای حفظ context بدون افزایش زیاد هزینه

/**
 * قلب معماری Agentic: State Machine
 * Intent Classification → Router → (RAG | Clarify | Troubleshoot | Config Analysis | Guided Tour)
 */
export async function orchestrate(
  rawUserMessage: string,
  priorMessages: CoreMessage[],
  agentState: AgentState,
  userMemory = ""
): Promise<OrchestrationResult> {
  const steps: ThinkingStep[] = [];
  const citationsRef: { current: Citation[] } = { current: [] };

  const userMessage = sanitizeUserInput(rawUserMessage);

  // --- گام صفر: بررسی امنیتی Prompt Injection ---
  const injectionCheck = detectPromptInjection(userMessage);
  if (injectionCheck.suspicious) {
    steps.push({
      type: "intent_detection",
      label: "بررسی امنیتی ورودی",
      detail: "الگوی مشکوک به تزریق پرامپت شناسایی و خنثی شد",
      status: "done",
    });
  }

  const recentHistoryTexts = priorMessages
    .slice(-HISTORY_LIMIT)
    .map((m) => `${m.role === "user" ? "کاربر" : "دستیار"}: ${contentToText(m.content)}`);

  // --- گام ۱: تشخیص Intent ---
  const t0 = Date.now();
  const classification = await classifyIntent(userMessage, recentHistoryTexts);
  steps.push({
    type: "intent_detection",
    label: `تشخیص هدف پیام: ${translateIntent(classification.intent)}`,
    detail: classification.reasoning,
    status: "done",
    durationMs: Date.now() - t0,
  });

  let newState = pushTopicMemory(agentState, classification.topic);
  const messages: CoreMessage[] = [...priorMessages, { role: "user", content: userMessage }];

  // --- Router: مسیریابی بر اساس Intent و وضعیت فعلی گفتگو ---

  // اگر در میانه یک تور راهنما هستیم و کاربر درخواست ادامه دارد
  if (agentState.phase === "guided_tour" && agentState.guidedTour && isContinueSignal(userMessage)) {
    const advanced = advanceTourStep(agentState.guidedTour);
    newState = { ...newState, phase: "guided_tour", guidedTour: advanced };

    const retrieval = await retrieveContext(
      `${advanced.topic} - ${advanced.steps[advanced.currentStepIndex]}`
    );
    citationsRef.current = retrieval.citations;

    steps.push(buildRetrievalStep(retrieval.chunks.length));

    return {
      intent: "guided_tour",
      thinkingSteps: steps,
      model: strongModel,
      system: buildGuidedTourSystemPrompt(
        advanced.topic,
        advanced.currentStepIndex,
        advanced.totalSteps,
        retrieval.contextText,
        userMemory
      ),
      messages,
      tools: createAgentTools((c) => citationsRef.current.push(...c)),
      maxSteps: 3,
      newAgentState: newState,
      cacheable: false,
      citationsRef,
    };
  }

  // اگر در میانه عیب‌یابی هستیم، ادامه همان مسیر (حفظ Context چندمرحله‌ای)
  if (agentState.phase === "troubleshooting" && agentState.troubleshoot && classification.intent !== "config_analysis") {
    const troubleshoot = {
      ...agentState.troubleshoot,
      stepsAsked: [...agentState.troubleshoot.stepsAsked, userMessage],
      currentStep: agentState.troubleshoot.currentStep + 1,
    };
    newState = { ...newState, phase: "troubleshooting", troubleshoot };

    const retrieval = await retrieveContext(`${troubleshoot.problemSummary} ${userMessage}`);
    citationsRef.current = retrieval.citations;
    steps.push(buildRetrievalStep(retrieval.chunks.length));

    return {
      intent: "troubleshoot",
      thinkingSteps: steps,
      model: strongModel,
      system: buildTroubleshootSystemPrompt(
        retrieval.contextText,
        troubleshoot.problemSummary,
        troubleshoot.currentStep,
        userMemory
      ),
      messages,
      tools: createAgentTools((c) => citationsRef.current.push(...c)),
      maxSteps: 4,
      newAgentState: newState,
      cacheable: false,
      citationsRef,
    };
  }

  switch (classification.intent as IntentType) {
    case "clarify_needed": {
      newState = { ...newState, phase: "clarifying" };
      steps.push({
        type: "clarify",
        label: "آماده‌سازی سوال تکمیلی",
        status: "done",
      });
      return {
        intent: "clarify_needed",
        thinkingSteps: steps,
        model: cheapModel,
        system: buildClarifySystemPrompt(userMemory),
        messages,
        maxSteps: 1,
        newAgentState: newState,
        cacheable: false,
        citationsRef,
      };
    }

    case "config_analysis": {
      newState = { ...newState, phase: "analyzing_config" };
      const jsonBlock = extractJsonBlock(userMessage);
      const analysisResult =
        jsonBlock && !isLikelyLog(userMessage)
          ? analyzeLiariaJson(jsonBlock)
          : analyzeErrorLog(userMessage);

      steps.push({
        type: "config_analysis",
        label: "تحلیل خودکار فایل پیکربندی/لاگ",
        detail: analysisResult.summary,
        status: "done",
      });

      const retrieval = await retrieveContext(`liara.json ${analysisResult.summary} ${classification.topic}`);
      citationsRef.current = retrieval.citations;
      steps.push(buildRetrievalStep(retrieval.chunks.length));

      return {
        intent: "config_analysis",
        thinkingSteps: steps,
        model: strongModel,
        system: buildConfigAnalysisSystemPrompt(
          JSON.stringify(analysisResult, null, 2),
          retrieval.contextText,
          userMemory
        ),
        messages,
        tools: createAgentTools((c) => citationsRef.current.push(...c)),
        maxSteps: 3,
        newAgentState: newState,
        cacheable: false,
        citationsRef,
      };
    }

    case "troubleshoot": {
      const troubleshootState = {
        problemSummary: classification.topic,
        stepsAsked: [userMessage],
        currentStep: 1,
        resolved: false,
      };
      newState = { ...newState, phase: "troubleshooting", troubleshoot: troubleshootState };

      const retrieval = await retrieveContext(userMessage);
      citationsRef.current = retrieval.citations;
      steps.push(buildRetrievalStep(retrieval.chunks.length));

      return {
        intent: "troubleshoot",
        thinkingSteps: steps,
        model: strongModel,
        system: buildTroubleshootSystemPrompt(
          retrieval.contextText,
          troubleshootState.problemSummary,
          1,
          userMemory
        ),
        messages,
        tools: createAgentTools((c) => citationsRef.current.push(...c)),
        maxSteps: 4,
        newAgentState: newState,
        cacheable: false,
        citationsRef,
      };
    }

    case "guided_tour": {
      const tourState = createGuidedTourState(classification.topic);
      newState = { ...newState, phase: "guided_tour", guidedTour: tourState };

      const retrieval = await retrieveContext(`${tourState.topic} ${tourState.steps[0]}`);
      citationsRef.current = retrieval.citations;
      steps.push(buildRetrievalStep(retrieval.chunks.length));

      return {
        intent: "guided_tour",
        thinkingSteps: steps,
        model: strongModel,
        system: buildGuidedTourSystemPrompt(
          tourState.topic,
          0,
          tourState.totalSteps,
          retrieval.contextText,
          userMemory
        ),
        messages,
        tools: createAgentTools((c) => citationsRef.current.push(...c)),
        maxSteps: 3,
        newAgentState: newState,
        cacheable: false,
        citationsRef,
      };
    }

    case "chitchat": {
      newState = { ...newState, phase: "answering" };
      steps.push({ type: "generation", label: "پاسخ مکالمه‌ای عمومی", status: "done" });
      return {
        intent: "chitchat",
        thinkingSteps: steps,
        model: cheapModel,
        system: [
          "تو Liara Copilot هستی، دستیار مستندات لیارا.",
          "کاربر یک پیام غیرفنی (احوال‌پرسی و ...) فرستاده. مودبانه و کوتاه پاسخ بده و بگو آماده کمک درباره لیارا هستی.",
          buildUserMemoryContext(userMemory),
        ].join("\n"),
        messages,
        maxSteps: 1,
        newAgentState: newState,
        cacheable: false,
        citationsRef,
      };
    }

    case "faq":
    default: {
      newState = { ...newState, phase: "retrieving" };
      const retrieval = await retrieveContext(userMessage);
      citationsRef.current = retrieval.citations;
      steps.push(buildRetrievalStep(retrieval.chunks.length));

      if (!isRetrievalConfident(retrieval)) {
        steps.push({
          type: "retrieval",
          label: "اطمینان بازیابی پایین است",
          detail: "پاسخ با احتیاط و همراه با پیشنهاد تماس با پشتیبانی ارائه می‌شود",
          status: "done",
        });
      }

      newState = { ...newState, phase: "answering" };

      return {
        intent: "faq",
        thinkingSteps: steps,
        model: strongModel,
        system: buildFaqSystemPrompt(retrieval.contextText, userMemory),
        messages,
        tools: createAgentTools((c) => citationsRef.current.push(...c)),
        maxSteps: 3,
        newAgentState: newState,
        cacheable: true,
        citationsRef,
      };
    }
  }
}

function buildRetrievalStep(chunkCount: number): ThinkingStep {
  return {
    type: "retrieval",
    label: `جستجوی هیبریدی در مستندات (${chunkCount} نتیجه مرتبط)`,
    status: "done",
  };
}

function translateIntent(intent: IntentType): string {
  const map: Record<IntentType, string> = {
    faq: "پرسش و پاسخ عمومی",
    troubleshoot: "عیب‌یابی خطا",
    config_analysis: "تحلیل پیکربندی",
    guided_tour: "تور راهنما",
    clarify_needed: "نیاز به توضیح بیشتر",
    chitchat: "گفتگوی عمومی",
    unknown: "نامشخص",
  };
  return map[intent] ?? intent;
}

function isContinueSignal(message: string): boolean {
  return /ادامه|مرحله بعد|next|بعدی|continue/i.test(message);
}

function contentToText(content: CoreMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => ("text" in part ? part.text : ""))
      .join(" ");
  }
  return "";
}
