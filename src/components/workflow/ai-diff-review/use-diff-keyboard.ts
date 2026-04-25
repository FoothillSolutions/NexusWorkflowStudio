"use client";

import { useEffect, type RefObject } from "react";

// ─── Diff Review Keyboard Shortcuts ─────────────────────────────────────────
// Binds keydown on a scoped ref rather than `window` so the shortcuts only
// fire while the dialog is focused. Events that originate inside inputs,
// textareas, or contenteditable regions are ignored to keep the dialog safe
// from stealing keystrokes from future embedded controls.

interface Handlers {
  onNext: () => void;
  onPrev: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggle: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onExpand: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useDiffKeyboard(
  scopeRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  handlers: Handlers,
) {
  useEffect(() => {
    if (!enabled) return;
    const el = scopeRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Esc always closes, even from within inputs/textareas, since there's
      // no shadcn Dialog wrapper to provide default escape handling.
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handlers.onCancel();
        return;
      }

      if (isTypingTarget(e.target)) return;

      const key = e.key;
      const lower = key.toLowerCase();

      if (e.shiftKey && (lower === "a")) {
        e.preventDefault();
        handlers.onAcceptAll();
        return;
      }
      if (e.shiftKey && (lower === "r")) {
        e.preventDefault();
        handlers.onRejectAll();
        return;
      }

      switch (key) {
        case "j":
        case "J":
        case "ArrowDown":
          e.preventDefault();
          handlers.onNext();
          return;
        case "k":
        case "K":
        case "ArrowUp":
          e.preventDefault();
          handlers.onPrev();
          return;
        case "y":
        case "Y":
        case "a":
        case "A":
          e.preventDefault();
          handlers.onAccept();
          return;
        case "n":
        case "N":
        case "r":
        case "R":
          e.preventDefault();
          handlers.onReject();
          return;
        case "u":
        case "U":
          e.preventDefault();
          handlers.onToggle();
          return;
        case " ":
          e.preventDefault();
          handlers.onExpand();
          return;
        case "Enter":
          e.preventDefault();
          handlers.onConfirm();
          return;
        default:
          return;
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [scopeRef, enabled, handlers]);
}
