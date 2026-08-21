import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";
import { listLiaraProjects, normalizeLiaraApiKey, type LiaraProjectSummary } from "@/lib/liara/api";

const CONNECTION_TTL_MS = 8 * 60 * 60 * 1000;

interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface ActiveLiaraConnection {
  apiKey: string;
  teamId: string;
  expiresAt: Date;
}

export interface LiaraConnectionStatus {
  connected: boolean;
  teamId?: string;
  expiresAt?: string;
  lastValidatedAt?: string;
}

export async function validateAndSaveLiaraConnection(params: {
  sessionId: string;
  apiKey: string;
  teamId: string;
}): Promise<{ status: LiaraConnectionStatus; projects: LiaraProjectSummary[] }> {
  const apiKey = normalizeLiaraApiKey(params.apiKey);
  const teamId = params.teamId.trim();
  const projects = await listLiaraProjects(apiKey, teamId);
  const encrypted = encryptToken(apiKey);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONNECTION_TTL_MS);

  await prisma.liaraSessionConnection.upsert({
    where: { sessionId: params.sessionId },
    create: {
      sessionId: params.sessionId,
      tokenCiphertext: encrypted.ciphertext,
      encryptionIv: encrypted.iv,
      encryptionAuthTag: encrypted.authTag,
      tokenFingerprint: fingerprint(apiKey),
      teamId,
      lastValidatedAt: now,
      expiresAt,
    },
    update: {
      tokenCiphertext: encrypted.ciphertext,
      encryptionIv: encrypted.iv,
      encryptionAuthTag: encrypted.authTag,
      tokenFingerprint: fingerprint(apiKey),
      teamId,
      lastValidatedAt: now,
      expiresAt,
    },
  });

  return {
    status: { connected: true, teamId, expiresAt: expiresAt.toISOString(), lastValidatedAt: now.toISOString() },
    projects,
  };
}

export async function getLiaraConnectionStatus(sessionId: string): Promise<LiaraConnectionStatus> {
  const connection = await prisma.liaraSessionConnection.findUnique({ where: { sessionId } });
  if (!connection) return { connected: false };

  if (connection.expiresAt <= new Date()) {
    await prisma.liaraSessionConnection.delete({ where: { sessionId } });
    return { connected: false };
  }

  return {
    connected: true,
    teamId: connection.teamId,
    expiresAt: connection.expiresAt.toISOString(),
    lastValidatedAt: connection.lastValidatedAt.toISOString(),
  };
}

export async function getActiveLiaraConnection(sessionId: string): Promise<ActiveLiaraConnection | null> {
  const connection = await prisma.liaraSessionConnection.findUnique({ where: { sessionId } });
  if (!connection) return null;

  if (connection.expiresAt <= new Date()) {
    await prisma.liaraSessionConnection.delete({ where: { sessionId } });
    return null;
  }

  try {
    return {
      apiKey: decryptToken({
        ciphertext: connection.tokenCiphertext,
        iv: connection.encryptionIv,
        authTag: connection.encryptionAuthTag,
      }),
      teamId: connection.teamId,
      expiresAt: connection.expiresAt,
    };
  } catch (error) {
    logger.error("liara_connection_decrypt_failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    await prisma.liaraSessionConnection.delete({ where: { sessionId } });
    return null;
  }
}

export async function deleteLiaraConnection(sessionId: string): Promise<void> {
  await prisma.liaraSessionConnection.deleteMany({ where: { sessionId } });
}

function encryptToken(token: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptToken(encrypted: EncryptedToken): string {
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function getEncryptionKey(): Buffer {
  const value = process.env.LIARA_CONNECTION_ENCRYPTION_KEY;
  if (!value) throw new Error("Liara connection encryption key is not configured");

  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Liara connection encryption key has an invalid length");
  return key;
}

function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
