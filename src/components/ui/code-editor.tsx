"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import "prismjs/themes/prism-tomorrow.css";
import { cn } from "@/lib/utils";
import { highlightCode, resolveCodeLanguage } from "./code-highlighting";

const SimpleCodeEditor = dynamic(() => import("react-simple-code-editor"), { ssr: false });

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: number | string;
  placeholder?: string;
  id?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  scrollElementRef?: (element: HTMLElement | null) => void;
}

export function CodeEditor({
  value,
  onChange,
  language = "typescript",
  height = 220,
  placeholder = "Write code…",
  id,
  readOnly = false,
  disabled = false,
  className,
  scrollElementRef,
}: CodeEditorProps) {
  const prismLanguage = resolveCodeLanguage(language);
  const resolvedHeight = typeof height === "number" ? `${height}px` : height;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollElementRef) return;

    const resolveScrollElement = () => {
      const element = containerRef.current?.querySelector<HTMLElement>(".nexus-code-editor__textarea");
      scrollElementRef(element ?? null);
    };

    resolveScrollElement();
    const frameId = window.requestAnimationFrame(resolveScrollElement);

    return () => {
      window.cancelAnimationFrame(frameId);
      scrollElementRef(null);
    };
  }, [scrollElementRef, value, language, readOnly, disabled]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "nexus-code-editor custom-scroll overflow-auto rounded-xl border border-zinc-700/60 bg-zinc-950/80",
        disabled && "opacity-60",
        className,
      )}
      style={resolvedHeight ? { height: resolvedHeight } : undefined}
    >
      <SimpleCodeEditor
        value={value}
        onValueChange={(nextValue) => {
          if (!readOnly && !disabled) {
            onChange(nextValue);
          }
        }}
        highlight={(code) => highlightCode(code, prismLanguage)}
        padding={16}
        textareaId={id}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        textareaClassName="nexus-code-editor__textarea"
        preClassName={`nexus-code-editor__pre language-${prismLanguage}`}
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 13,
          lineHeight: 1.65,
          minHeight: "100%",
          background: "transparent",
        }}
        insertSpaces
        tabSize={2}
      />
    </div>
  );
}

