import type { HttpClient, RequestOptions } from "../client";
import type { HealthInfo } from "../types";

export function createHealthService(http: HttpClient) {
  return {
    /** GET /global/health — Check server health and version. */
    async check(opts?: RequestOptions): Promise<HealthInfo> {
      return http.get<HealthInfo>("/global/health", opts);
    },
  } as const;
}

export type HealthService = ReturnType<typeof createHealthService>;

