import type { HttpClient, RequestOptions } from "../client";
import type { OpenCodeEvent, GlobalEvent } from "../types";

export function createEventService(http: HttpClient) {
  return {
    /**
     * GET /event — Subscribe to instance events via SSE.
     * Returns an async generator that yields parsed event objects.
     *
     * @example
     * ```ts
     * const abort = new AbortController();
     * for await (const event of client.events.subscribe({ signal: abort.signal })) {
     *   console.log(event.type, event.properties);
     * }
     * ```
     */
    subscribe(opts?: RequestOptions): AsyncGenerator<OpenCodeEvent> {
      return http.stream<OpenCodeEvent>("/event", opts);
    },

    /**
     * GET /global/event — Subscribe to global events across all instances.
     * Each event includes the `directory` of the originating instance.
     */
    subscribeGlobal(opts?: RequestOptions): AsyncGenerator<GlobalEvent> {
      return http.stream<GlobalEvent>("/global/event", opts);
    },
  } as const;
}

export type EventService = ReturnType<typeof createEventService>;

