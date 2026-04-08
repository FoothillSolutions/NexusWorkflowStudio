import { readJsonStorage, writeJsonStorage } from "@/lib/browser-storage";
import type {
  KnowledgeDoc,
  KnowledgeBrain,
  KnowledgeFeedback,
} from "@/types/knowledge";

const BRAIN_KEY = "nexus:knowledge-brain";

function readBrain(): KnowledgeDoc[] {
  const stored = readJsonStorage<{ version: string; docs: KnowledgeDoc[] } | KnowledgeDoc[]>(
    BRAIN_KEY,
    [],
    () => { console.error("Failed to read brain storage"); },
  );
  // Handle both old array format and new versioned format
  if (Array.isArray(stored)) return stored;
  return stored.docs ?? [];
}

function writeBrain(docs: KnowledgeDoc[]): void {
  writeJsonStorage(BRAIN_KEY, { version: "1", docs }, () => {
    console.error("Failed to write brain storage");
  });
}

export function getAllKnowledgeDocs(): KnowledgeDoc[] {
  return readBrain();
}

export function getKnowledgeDoc(id: string): KnowledgeDoc | null {
  return readBrain().find((d) => d.id === id) ?? null;
}

export function saveKnowledgeDoc(doc: KnowledgeDoc): void {
  const docs = readBrain();
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx >= 0) {
    docs[idx] = doc;
  } else {
    docs.unshift(doc); // newest first
  }
  writeBrain(docs);
}

export function deleteKnowledgeDoc(id: string): void {
  writeBrain(readBrain().filter((d) => d.id !== id));
}

export function incrementDocView(id: string): void {
  const docs = readBrain();
  const doc = docs.find((d) => d.id === id);
  if (doc) {
    doc.metrics.views += 1;
    doc.metrics.lastViewedAt = new Date().toISOString();
    writeBrain(docs);
  }
}

export function addDocFeedback(id: string, feedback: KnowledgeFeedback): void {
  const docs = readBrain();
  const doc = docs.find((d) => d.id === id);
  if (doc) {
    doc.metrics.feedback.push(feedback);
    writeBrain(docs);
  }
}

export function exportBrainFile(): void {
  const docs = readBrain();
  const brain: KnowledgeBrain = {
    version: "1",
    exportedAt: new Date().toISOString(),
    docs,
  };
  const json = JSON.stringify(brain, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `nexus-brain-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseBrainImport(file: File): Promise<KnowledgeBrain> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid brain file");
  const obj = parsed as Record<string, unknown>;

  // Support both array format and versioned format
  if (Array.isArray(obj)) {
    return { version: "1", exportedAt: new Date().toISOString(), docs: obj as KnowledgeDoc[] };
  }
  if (obj.version === "1" && Array.isArray(obj.docs)) {
    return obj as unknown as KnowledgeBrain;
  }
  throw new Error("Unrecognized brain file format");
}

export function mergeBrainImport(imported: KnowledgeBrain): void {
  const existing = readBrain();
  const map = new Map(existing.map((d) => [d.id, d]));
  for (const doc of imported.docs) {
    const current = map.get(doc.id);
    if (!current || doc.updatedAt > current.updatedAt) {
      map.set(doc.id, doc);
    }
  }
  // Newest first by updatedAt
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  writeBrain(merged);
}

/** Replace the entire brain with a new set of docs (used by Y.js sync). */
export function replaceAllKnowledgeDocs(docs: KnowledgeDoc[]): void {
  writeBrain(docs);
}
