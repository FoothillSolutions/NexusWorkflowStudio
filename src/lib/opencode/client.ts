// ─── OpenCode HTTP Client ───────────────────────────────────────────────────
// Low-level fetch wrapper shared by every service module. Handles:
//  • Base URL management
//  • Default `directory` / `workspace` query-param injection
//  • Timeout via AbortController
//  • Response → typed-error mapping
//  • JSON serialisation / deserialisation
//  • SSE stream parsing

import {
  BadRequestError,
  ConnectionError,
  HttpError,
  NotFoundError,
  OpenCodeError,
  TimeoutError,
} from "./errors";
import type { InstanceParams } from "./types";

// ── Options ──────────────────────────────────────────────────────────────────

export interface HttpClientOptions {
  /** Fully-qualified origin, e.g. `http://127.0.0.1:4096` */
  baseUrl: string;
  /** Default timeout in ms for every request (default 30 000). */
  timeout?: number;
  /** Default instance params injected into every request's query string. */
  defaultParams?: InstanceParams;
}

// ── Request helpers ──────────────────────────────────────────────────────────

export interface RequestOptions {
  /** Override per-request timeout (ms). */
  timeout?: number;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Per-request instance params (merged with defaults). */
  params?: InstanceParams;
  /** Arbitrary query-string entries. */
  query?: Record<string, string | number | boolean | undefined>;
  /** AbortSignal for external cancellation. */
  signal?: AbortSignal;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class HttpClient {
  private _baseUrl: string;
  private _timeout: number;
  private _defaultParams: InstanceParams;

  constructor(opts: HttpClientOptions) {
    this._baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this._timeout = opts.timeout ?? 30_000;
    this._defaultParams = opts.defaultParams ?? {};
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  get baseUrl() {
    return this._baseUrl;
  }

  set baseUrl(url: string) {
    this._baseUrl = url.replace(/\/+$/, "");
  }

  get defaultParams() {
    return this._defaultParams;
  }

  set defaultParams(p: InstanceParams) {
    this._defaultParams = p;
  }

  // ── Public verbs ───────────────────────────────────────────────────────

  async get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>("GET", path, undefined, opts);
  }

  async post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>("POST", path, body, opts);
  }

  async put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>("PUT", path, body, opts);
  }

  async patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>("PATCH", path, body, opts);
  }

  async delete<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", path, body, opts);
  }

  // ── SSE stream ─────────────────────────────────────────────────────────

  /**
   * Open an SSE connection and yield parsed JSON objects.
   * Automatically handles `data:` lines and ignores comments / keep-alives.
   */
  async *stream<T>(path: string, opts?: RequestOptions): AsyncGenerator<T> {
    const url = this.buildUrl(path, opts);
    const controller = new AbortController();
    const externalSignal = opts?.signal;
    const abortFromExternal = () => controller.abort(externalSignal?.reason);

    // Link external signal → internal controller
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener("abort", abortFromExternal, { once: true });
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "text/event-stream", ...opts?.headers },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError" && controller.signal.aborted) {
        return;
      }
      throw new ConnectionError(err);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw this.toError(res.status, body);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read().catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError" && controller.signal.aborted) {
            return { done: true, value: undefined };
          }
          throw err;
        });
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const raw = trimmed.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              yield JSON.parse(raw) as T;
            } catch {
              // skip un-parseable data lines
            }
          }
        }
      }
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener("abort", abortFromExternal);
      }
      reader.releaseLock();
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    opts?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, opts);
    const timeout = opts?.timeout ?? this._timeout;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const externalSignal = opts?.signal;

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason), { once: true });
      }
    }

    try {
      const headers: Record<string, string> = {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...opts?.headers,
      };

      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // 204 No Content – return `true` as convention
      if (res.status === 204) {
        return true as unknown as T;
      }

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw this.toError(res.status, json);
      }

      return json as T;
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof OpenCodeError) throw err;

      if (err instanceof DOMException && err.name === "AbortError") {
        throw new TimeoutError(timeout);
      }

      throw new ConnectionError(err);
    }
  }

  /** Build a full URL with merged query params. */
  private buildUrl(path: string, opts?: RequestOptions): string {
    const merged: Record<string, string> = {};

    // Default instance params
    if (this._defaultParams.directory) merged.directory = this._defaultParams.directory;
    if (this._defaultParams.workspace) merged.workspace = this._defaultParams.workspace;

    // Per-request instance params override defaults
    if (opts?.params?.directory) merged.directory = opts.params.directory;
    if (opts?.params?.workspace) merged.workspace = opts.params.workspace;

    // Extra query entries
    if (opts?.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) merged[k] = String(v);
      }
    }

    const qs = new URLSearchParams(merged).toString();
    const sep = qs ? "?" : "";
    return `${this._baseUrl}${path}${sep}${qs}`;
  }

  /** Map an HTTP status + body to the correct typed error. */
  private toError(status: number, body: unknown): OpenCodeError {
    switch (status) {
      case 400:
        return new BadRequestError(body as { data?: unknown; errors?: Array<Record<string, unknown>> });
      case 404:
        return new NotFoundError(body as { name?: string; data?: { message?: string } });
      default:
        return new HttpError(status, body);
    }
  }
}

