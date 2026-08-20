/**
 * تایپ‌های مشترک پروژه Liara Copilot
 */

// -------------------- Intent --------------------
export type IntentType =
  | "faq" // سوال متداول ساده قابل پاسخ با RAG
  | "troubleshoot" // عیب‌یابی خطا / مشکل فنی
  | "config_analysis" // تحلیل فایل liara.json یا لاگ
  | "guided_tour" // درخواست تور راهنما / آموزش قدم‌به‌قدم
  | "clarify_needed" // سوال مبهم است، نیاز به توضیح بیشتر
  | "chitchat" // گفتگوی عمومی / خارج از موضوع
  | "unknown";

// -------------------- Citation --------------------
export interface Citation {
  documentId: string;
  chunkId: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
}

// -------------------- Thinking Steps (شفافیت فکر ایجنت) --------------------
export type ThinkingStepType =
  | "intent_detection"
  | "retrieval"
  | "rerank"
  | "clarify"
  | "troubleshoot"
  | "config_analysis"
  | "generation"
  | "cache";

export interface ThinkingStep {
  type: ThinkingStepType;
  label: string;
  detail?: string;
  status: "pending" | "running" | "done" | "error";
  durationMs?: number;
}

// -------------------- Suggested Actions (قدم‌های بعدی) --------------------
export interface SuggestedAction {
  id: string;
  label: string;
  /** پیامی که با کلیک روی دکمه به عنوان پیام بعدی کاربر ارسال می‌شود */
  prompt: string;
}

// -------------------- Agent State (State Machine) --------------------
export type AgentPhase =
  | "idle"
  | "classifying"
  | "clarifying"
  | "retrieving"
  | "troubleshooting"
  | "analyzing_config"
  | "guided_tour"
  | "answering"
  | "done";

export interface TroubleshootState {
  problemSummary: string;
  stepsAsked: string[];
  currentStep: number;
  resolved: boolean;
}

export interface GuidedTourState {
  topic: string;
  currentStepIndex: number;
  totalSteps: number;
  steps: string[];
}

export interface AgentState {
  phase: AgentPhase;
  lastIntent?: IntentType;
  pendingClarifyQuestion?: string;
  troubleshoot?: TroubleshootState;
  guidedTour?: GuidedTourState;
  /** خلاصه‌ای از موضوعات مطرح‌شده در گفتگو برای حفظ context */
  topicMemory: string[];
}

export function createInitialAgentState(): AgentState {
  return {
    phase: "idle",
    topicMemory: [],
  };
}

// -------------------- Chat Message (سمت UI) --------------------
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  intent?: IntentType;
  thinkingSteps?: ThinkingStep[];
  citations?: Citation[];
  suggestedActions?: SuggestedAction[];
  createdAt: string;
  feedback?: "UP" | "DOWN" | null;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

// -------------------- liara.json Analysis --------------------
export interface LiariaConfigIssue {
  severity: "error" | "warning" | "info";
  field?: string;
  message: string;
  suggestion?: string;
}

export interface LiariaConfigAnalysisResult {
  valid: boolean;
  platform?: string;
  issues: LiariaConfigIssue[];
  summary: string;
}

// -------------------- Retrieval --------------------
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  url: string;
  content: string;
  vectorScore: number;
  textScore: number;
  hybridScore: number;
  rerankScore?: number;
}
