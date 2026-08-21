import "server-only";
import { redactSensitiveData, sanitizeExternalData } from "@/lib/security/sensitive-data";

const LIARA_API_BASE_URL = "https://api.iran.liara.ir";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_LOG_ENTRIES = 80;
const MAX_LOG_MESSAGE_LENGTH = 2_000;

export interface LiaraProjectSummary {
  id: string;
  projectId: string;
  type: string;
  status: string;
  scale: number | null;
  planId: string | null;
  createdAt: string | null;
  isDeployed: boolean | null;
}

export interface LiaraLogEntry {
  type: string;
  datetime: string;
  message: string;
}

export class LiaraApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function normalizeLiaraApiKey(value: string): string {
  return value.trim().replace(/^Bearer\s+/i, "");
}

/** اعتبارسنجی فقط‌خواندنیِ کلید و Team ID با فهرست اپلیکیشن‌های همان تیم. */
export async function listLiaraProjects(apiKey: string, teamId: string): Promise<LiaraProjectSummary[]> {
  const data = await requestLiaraJson("/v1/projects", apiKey, teamId);
  const projects = isRecord(data) && Array.isArray(data.projects) ? data.projects : [];

  return projects.slice(0, 100).map((project) => {
    const record = isRecord(project) ? project : {};
    return {
      id: stringValue(record._id),
      projectId: stringValue(record.project_id),
      type: stringValue(record.type),
      status: stringValue(record.status),
      scale: numberValue(record.scale),
      planId: stringOrNull(record.planID),
      createdAt: stringOrNull(record.created_at),
      isDeployed: booleanOrNull(record.isDeployed),
    };
  });
}

/** دریافت فقط‌خواندنی لاگ‌های یک اپ؛ نام اپ صرفاً در مسیر encode می‌شود. */
export async function getLiaraAppLogs(
  apiKey: string,
  teamId: string,
  appName: string,
  sinceEpochSeconds: number
): Promise<LiaraLogEntry[]> {
  const safeName = encodeURIComponent(appName);
  const data = await requestLiaraJson(
    `/v1/projects/${safeName}/logs?since=${Math.max(0, Math.floor(sinceEpochSeconds))}`,
    apiKey,
    teamId
  );
  const entries = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.logs) ? data.logs : [];

  return entries.slice(-MAX_LOG_ENTRIES).map((entry) => {
    const record = isRecord(entry) ? entry : {};
    return {
      type: stringValue(record.type),
      datetime: stringValue(record.datetime),
      message: redactSensitiveData(stringValue(record.message).slice(0, MAX_LOG_MESSAGE_LENGTH)),
    };
  });
}

async function requestLiaraJson(path: string, apiKey: string, teamId: string): Promise<unknown> {
  const url = new URL(path, LIARA_API_BASE_URL);
  url.searchParams.set("teamID", teamId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${normalizeLiaraApiKey(apiKey)}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new LiaraApiError(response.status, "Liara API request was rejected");
    }

    try {
      return sanitizeExternalData(JSON.parse(text));
    } catch {
      throw new LiaraApiError(502, "Liara API returned invalid JSON");
    }
  } catch (error) {
    if (error instanceof LiaraApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LiaraApiError(504, "Liara API request timed out");
    }
    throw new LiaraApiError(502, "Could not reach Liara API");
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
