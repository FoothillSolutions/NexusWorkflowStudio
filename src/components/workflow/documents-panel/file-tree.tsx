"use client";

import { useMemo } from "react";
import { ChevronRight, File, FileText, Wrench, BookOpen, FileWarning, Code, Image } from "lucide-react";
import type { LibraryDocumentRecord, DocumentRole } from "@/lib/library-store/types";

const ROLE_ICONS: Record<DocumentRole, React.ComponentType<{ className?: string; size?: number }>> = {
  "skill-entrypoint": Wrench,
  reference: BookOpen,
  doc: FileText,
  rule: FileWarning,
  template: File,
  example: File,
  asset: Image,
  script: Code,
  manifest: File,
};

const ROLE_LABELS: Record<DocumentRole, string> = {
  "skill-entrypoint": "SKILL.md",
  reference: "References",
  doc: "Docs",
  rule: "Rules",
  template: "Templates",
  example: "Examples",
  asset: "Assets",
  script: "Scripts",
  manifest: "Manifests",
};

interface FileTreeProps {
  documents: LibraryDocumentRecord[];
  selectedDocId: string | null;
  onSelect: (docId: string) => void;
  onCreate?: (role: DocumentRole) => void;
  onDelete?: (docId: string) => void;
}

export function FileTree({ documents, selectedDocId, onSelect, onCreate, onDelete }: FileTreeProps) {
  const grouped = useMemo(() => {
    const map = new Map<DocumentRole, LibraryDocumentRecord[]>();
    for (const doc of documents.filter((d) => d.deletedAt === null)) {
      const list = map.get(doc.role) ?? [];
      list.push(doc);
      map.set(doc.role, list);
    }
    return map;
  }, [documents]);

  return (
    <div className="space-y-3">
      {(Object.keys(ROLE_LABELS) as DocumentRole[]).map((role) => {
        const items = grouped.get(role) ?? [];
        const Icon = ROLE_ICONS[role];
        return (
          <div key={role} className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <span className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" /> {ROLE_LABELS[role]}
              </span>
              {onCreate && (
                <button type="button" onClick={() => onCreate(role)} className="text-cyan-400 hover:text-cyan-300 text-[10px]">
                  + add
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-[11px] text-zinc-600 italic pl-4">empty</p>
            ) : (
              <ul className="space-y-0.5">
                {items.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(doc.id)}
                      className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 group ${selectedDocId === doc.id ? "bg-cyan-950/60 text-cyan-100" : "text-zinc-300 hover:bg-zinc-800/50"}`}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate font-mono">{doc.path}</span>
                      {onDelete && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(doc.id);
                          }}
                          className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-zinc-500 hover:text-red-400 px-1"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
