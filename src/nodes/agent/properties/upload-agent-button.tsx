"use client";

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import type { FormSetValue } from "@/nodes/shared/form-types";
import { parseAgentFile } from "../parse-agent-file";
import { toast } from "sonner";

interface UploadAgentButtonProps {
  setValue: FormSetValue;
}

export function UploadAgentButton({ setValue }: UploadAgentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".md")) {
        toast.error("Only .md agent files are supported");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseAgentFile(reader.result as string);
          const fields = [
            "description", "model", "memory", "temperature",
            "color", "disabledTools", "variableMappings", "promptText",
          ] as const;
          for (const key of fields) {
            if (parsed[key] !== undefined) {
              setValue(key as never, parsed[key] as never, { shouldDirty: true });
            }
          }
          const baseName = file.name.replace(/\.md$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-");
          if (baseName) setValue("name" as never, baseName as never, { shouldDirty: true });
          toast.success(`Loaded agent from ${file.name}`);
        } catch {
          toast.error("Failed to parse agent file");
        }
      };
      reader.onerror = () => toast.error("Failed to read file");
      reader.readAsText(file);
      e.target.value = "";
    },
    [setValue],
  );

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept=".md" onChange={handleUpload} className="hidden" />
      <Button
        type="button"
        variant="ghost"
        onClick={() => inputRef.current?.click()}
        className="w-full h-16 rounded-xl border-2 border-dashed border-zinc-700/60 hover:border-violet-700/60 text-zinc-500 hover:text-violet-400 transition-all flex flex-col gap-1"
      >
        <Upload size={18} />
        <span className="text-xs">Upload Agent <code className="font-mono text-[10px] text-zinc-600">.md</code></span>
      </Button>
      <p className="text-[10px] text-zinc-600 text-center">Import an existing agent file</p>
    </div>
  );
}

