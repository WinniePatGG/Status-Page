import type { Service } from "@status-page/database";

export interface CheckResult {
  success: boolean;
  statusCode: number | null;
  responseTime: number | null;
  error: string | null;
}

export async function performCheck(service: Service): Promise<CheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), service.timeout);

  const start = Date.now();

  try {
    const response = await fetch(service.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent": "StatusPage-Monitor/1.0",
        accept: "text/plain,application/json;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    const responseTime = Date.now() - start;
    clearTimeout(timeout);

    const ok = response.ok;
    return {
      success: ok,
      statusCode: response.status,
      responseTime,
      error: ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    const responseTime = Date.now() - start;
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      statusCode: null,
      responseTime,
      error: message,
    };
  }
}
