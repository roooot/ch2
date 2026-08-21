import "server-only";
export class PayloadTooLargeError extends Error {
  constructor() {
    super("Request body is too large");
  }
}

/**
 * برخلاف req.json()، بدنه را هنگام خواندن محدود می‌کند تا یک درخواست chunked
 * حجیم قبل از parse شدن در حافظه، متوقف شود.
 */
export async function readJsonBodyWithLimit(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new PayloadTooLargeError();
  }

  if (!request.body) throw new SyntaxError("Missing request body");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(text);
}
