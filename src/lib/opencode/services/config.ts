import type { HttpClient, RequestOptions } from "../client";
import type { Config, ConfigProviders } from "../types";

export function createConfigService(http: HttpClient) {
  return {
    /** GET /config — Get instance configuration. */
    async get(opts?: RequestOptions): Promise<Config> {
      return http.get<Config>("/config", opts);
    },

    /** PATCH /config — Update instance configuration. */
    async update(config: Partial<Config>, opts?: RequestOptions): Promise<Config> {
      return http.patch<Config>("/config", config, opts);
    },

    /** GET /global/config — Get global configuration. */
    async getGlobal(opts?: RequestOptions): Promise<Config> {
      return http.get<Config>("/global/config", opts);
    },

    /** PATCH /global/config — Update global configuration. */
    async updateGlobal(config: Partial<Config>, opts?: RequestOptions): Promise<Config> {
      return http.patch<Config>("/global/config", config, opts);
    },

    /** GET /config/providers — List configured providers with defaults. */
    async getProviders(opts?: RequestOptions): Promise<ConfigProviders> {
      return http.get<ConfigProviders>("/config/providers", opts);
    },
  } as const;
}

export type ConfigService = ReturnType<typeof createConfigService>;

