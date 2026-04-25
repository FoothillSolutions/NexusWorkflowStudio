import { createHash } from "node:crypto";

export function sha256(content: string | Buffer | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof content === "string") {
    hash.update(content, "utf8");
  } else {
    hash.update(Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  return hash.digest("hex");
}

export function computeContentHash(content: string | Buffer | Uint8Array): string {
  return sha256(content);
}

export function buildHashManifest(entries: Record<string, string | Buffer | Uint8Array>): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const [path, value] of Object.entries(entries)) {
    manifest[path] = sha256(value);
  }
  return manifest;
}
