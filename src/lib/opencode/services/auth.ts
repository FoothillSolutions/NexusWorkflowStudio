import type { HttpClient, RequestOptions } from "../client";
import type { AuthCredentials } from "../types";

export function createAuthService(http: HttpClient) {
  return {
    /** PUT /auth/{providerID} — Set authentication credentials for a provider. */
    async set(providerID: string, credentials: AuthCredentials, opts?: RequestOptions): Promise<boolean> {
      return http.put<boolean>(`/auth/${encodeURIComponent(providerID)}`, credentials, opts);
    },

    /** DELETE /auth/{providerID} — Remove authentication credentials for a provider. */
    async remove(providerID: string, opts?: RequestOptions): Promise<boolean> {
      return http.delete<boolean>(`/auth/${encodeURIComponent(providerID)}`, undefined, opts);
    },
  } as const;
}

export type AuthService = ReturnType<typeof createAuthService>;