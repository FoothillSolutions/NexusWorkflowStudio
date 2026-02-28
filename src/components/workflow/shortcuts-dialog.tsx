"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MOD, SHIFT, ALT, DEL, PLATFORM } from "@/lib/platform";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KBD = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1.5 rounded bg-zinc-700 border border-zinc-600 text-zinc-200 text-[11px] font-mono leading-none">
    {children}
  </kbd>
);

const Row = ({ keys, label }: { keys: React.ReactNode[]; label: string }) => (
  <div className="flex items-center justify-between gap-4 py-2 border-b border-zinc-800 last:border-0">
    <span className="text-zinc-400 text-sm">{label}</span>
    <div className="flex items-center gap-1 shrink-0">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-600 text-xs">+</span>}
          <KBD>{k}</KBD>
        </span>
      ))}
    </div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 mt-4 first:mt-0">
      {title}
    </div>
    {children}
  </div>
);

const platformLabel =
  PLATFORM === "mac" ? "macOS" : PLATFORM === "linux" ? "Linux" : "Windows";

export default function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 text-base flex items-center gap-2">
            Keyboard Shortcuts
            <span className="text-[10px] font-normal text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5 uppercase tracking-wider">
              {platformLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-1 max-h-[60vh] overflow-y-auto pr-1">
          <Section title="File">
            <Row keys={[MOD, ALT, "N"]} label="New workflow" />
            <Row keys={[MOD, "S"]} label="Save to library" />
            <Row keys={[MOD, ALT, "E"]} label="Export workflow" />
            <Row keys={[MOD, ALT, "O"]} label="Import workflow" />
            <Row keys={[MOD, ALT, "G"]} label="Generate & download" />
            <Row keys={[MOD, ALT, "P"]} label="Preview output" />
          </Section>

          <Section title="Tools">
            <Row keys={["H"]} label="Hand tool (pan mode)" />
            <Row keys={["V"]} label="Selection tool (marquee)" />
          </Section>

          <Section title="Selection">
            <Row keys={[MOD, "A"]} label="Select all nodes" />
            <Row keys={["Click"]} label="Select node" />
          </Section>

          <Section title="Edit">
            <Row keys={[MOD, "D"]} label="Duplicate selected" />
            <Row keys={[DEL]} label="Delete selected" />
            <Row keys={[MOD, "Z"]} label="Undo" />
            <Row keys={[MOD, SHIFT, "Z"]} label="Redo" />
            <Row keys={[MOD, SHIFT, "L"]} label="Auto-layout" />
          </Section>

          <Section title="Canvas">
            <Row keys={["Scroll"]} label="Zoom in / out" />
            <Row keys={["Middle drag"]} label="Pan canvas" />
            <Row keys={["Double-click"]} label="Open node properties" />
          </Section>

          <Section title="General">
            <Row keys={["Esc"]} label="Close panel / dialog" />
            <Row keys={["?"]} label="Show this dialog" />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

