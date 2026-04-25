// ─── OpenCode API Error Classes ─────────────────────────────────────────────
// Strongly-typed error hierarchy that mirrors the OpenCode OpenAPI error schemas.

/** Base class for every error thrown by the OpenCode client. */
export class OpenCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenCodeError";
  }
}

/** HTTP 400 – Bad request. Carries the structured `errors` array from the API. */
export class BadRequestError extends OpenCodeError {
  readonly status = 400 as const;
  readonly errors: Array<Record<string, unknown>>;
  readonly data: unknown;

  constructor(body: { data?: unknown; errors?: Array<Record<string, unknown>> }) {
    const msg =
      body.errors?.[0]?.["message"] ??
      body.errors?.[0]?.["msg"] ??
      "Bad request";
    super(String(msg));
    this.name = "BadRequestError";
    this.errors = body.errors ?? [];
    this.data = body.data ?? null;
  }
}

/** HTTP 404 – Resource not found. */
export class NotFoundError extends OpenCodeError {
  readonly status = 404 as const;
  readonly errorName: string;

  constructor(body: { name?: string; data?: { message?: string } }) {
    super(body.data?.message ?? "Not found");
    this.name = "NotFoundError";
    this.errorName = body.name ?? "NotFoundError";
  }
}

/** Network-level timeout (AbortController). */
export class TimeoutError extends OpenCodeError {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** Could not reach the server at all. */
export class ConnectionError extends OpenCodeError {
  constructor(cause?: unknown) {
    const detail =
      cause instanceof TypeError
        ? "Could not reach server — please check the port and make sure the server is running"
        : cause instanceof Error
          ? cause.message
          : "Connection failed";
    super(detail);
    this.name = "ConnectionError";
  }
}

/** Generic HTTP error for any non-2xx status that doesn't match 400/404. */
export class HttpError extends OpenCodeError {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const msg =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as Record<string, unknown>).message)
        : `HTTP ${status}`;
    super(msg);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

