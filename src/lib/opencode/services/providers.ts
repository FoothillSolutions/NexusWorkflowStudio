import type { HttpClient, RequestOptions } from "../client";
import type {
  ProviderListResult,
  ProviderAuthMethod,
  ProviderAuthAuthorization,
} from "../types";

export function createProviderService(http: HttpClient) {
  return {
    /** GET /provider — List all available providers with models and connection status. */
    async list(opts?: RequestOptions): Promise<ProviderListResult> {
      return http.get<ProviderListResult>("/provider", opts);
    },

    /** GET /provider/auth — Get authentication methods for all providers. */
    async getAuth(opts?: RequestOptions): Promise<Record<string, ProviderAuthMethod[]>> {
      return http.get<Record<string, ProviderAuthMethod[]>>("/provider/auth", opts);
    },

    /** POST /provider/{providerID}/oauth/authorize — Start OAuth flow for a provider. */
    async oauthAuthorize(
      providerID: string,
      method: number,
      opts?: RequestOptions,
    ): Promise<ProviderAuthAuthorization> {
      return http.post<ProviderAuthAuthorization>(
        `/provider/${encodeURIComponent(providerID)}/oauth/authorize`,
        { method },
        opts,
      );
    },

    /** POST /provider/{providerID}/oauth/callback — Complete OAuth callback. */
    async oauthCallback(
      providerID: string,
      payload: { method: number; code?: string },
      opts?: RequestOptions,
    ): Promise<boolean> {
      return http.post<boolean>(
        `/provider/${encodeURIComponent(providerID)}/oauth/callback`,
        payload,
        opts,
      );
    },
  } as const;
}

export type ProviderService = ReturnType<typeof createProviderService>;
