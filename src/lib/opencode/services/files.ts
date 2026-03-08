import type { HttpClient, RequestOptions } from "../client";
import type { FileNode, FileContent, FileStatus } from "../types";

export function createFileService(http: HttpClient) {
  return {
    /** GET /file — List files and directories at a path. */
    async list(path: string, opts?: RequestOptions): Promise<FileNode[]> {
      return http.get<FileNode[]>("/file", {
        ...opts,
        query: { ...opts?.query, path },
      });
    },

    /** GET /file/content — Read the content of a file. */
    async read(path: string, opts?: RequestOptions): Promise<FileContent> {
      return http.get<FileContent>("/file/content", {
        ...opts,
        query: { ...opts?.query, path },
      });
    },

    /** GET /file/status — Get git status of all project files. */
    async status(opts?: RequestOptions): Promise<FileStatus[]> {
      return http.get<FileStatus[]>("/file/status", opts);
    },
  } as const;
}

export type FileService = ReturnType<typeof createFileService>;

