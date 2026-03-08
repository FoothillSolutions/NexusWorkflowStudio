import type { HttpClient, RequestOptions } from "../client";
import type { Part } from "../types";

export function createPartService(http: HttpClient) {
  return {
    /** DELETE /session/{sessionID}/message/{messageID}/part/{partID} — Delete a part. */
    async delete(
      sessionID: string,
      messageID: string,
      partID: string,
      opts?: RequestOptions,
    ): Promise<boolean> {
      return http.delete<boolean>(
        `/session/${encodeURIComponent(sessionID)}/message/${encodeURIComponent(messageID)}/part/${encodeURIComponent(partID)}`,
        undefined,
        opts,
      );
    },

    /** PATCH /session/{sessionID}/message/{messageID}/part/{partID} — Update a part. */
    async update(
      sessionID: string,
      messageID: string,
      partID: string,
      part: Part,
      opts?: RequestOptions,
    ): Promise<Part> {
      return http.patch<Part>(
        `/session/${encodeURIComponent(sessionID)}/message/${encodeURIComponent(messageID)}/part/${encodeURIComponent(partID)}`,
        part,
        opts,
      );
    },
  } as const;
}

export type PartService = ReturnType<typeof createPartService>;

