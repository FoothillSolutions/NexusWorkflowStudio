import type { HttpClient, RequestOptions } from "../client";
import type { QuestionRequest, QuestionAnswer } from "../types";

export function createQuestionService(http: HttpClient) {
  return {
    /** GET /question — List all pending question requests. */
    async list(opts?: RequestOptions): Promise<QuestionRequest[]> {
      return http.get<QuestionRequest[]>("/question", opts);
    },

    /** POST /question/{requestID}/reply — Answer a question request. */
    async reply(
      requestID: string,
      answers: QuestionAnswer[],
      opts?: RequestOptions,
    ): Promise<boolean> {
      return http.post<boolean>(
        `/question/${encodeURIComponent(requestID)}/reply`,
        { answers },
        opts,
      );
    },

    /** POST /question/{requestID}/reject — Reject a question request. */
    async reject(requestID: string, opts?: RequestOptions): Promise<boolean> {
      return http.post<boolean>(
        `/question/${encodeURIComponent(requestID)}/reject`,
        undefined,
        opts,
      );
    },
  } as const;
}

export type QuestionService = ReturnType<typeof createQuestionService>;

