"use client";

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Radio,
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal,
  Globe,
  Unplug,
  Copy,
} from "lucide-react";
import { useOpenCodeStore } from "@/store/opencode";
import { toast } from "sonner";

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    title: "Install opencode",
    description: "If you haven't already, install the opencode CLI.",
    command: "npm i -g opencode-ai",
  },
  {
    title: "Start the server",
    description: "Run the serve command from your project directory.",
    command: null as string | null, // filled dynamically with current origin
  },
  {
    title: "Connect below",
    description:
      "Enter the server URL and click Connect.",
    command: null,
  },
];

/** Build the serve command using the current origin for CORS. */
function getServeCommand() {
  if (typeof window === "undefined") return "opencode serve";
  const origin = window.location.origin;
  return `opencode serve --cors ${origin}`;
}

export default function ConnectDialog({
  open,
  onOpenChange,
}: ConnectDialogProps) {
  const url = useOpenCodeStore((s) => s.url);
  const status = useOpenCodeStore((s) => s.status);
  const version = useOpenCodeStore((s) => s.version);
  const error = useOpenCodeStore((s) => s.error);
  const setUrl = useOpenCodeStore((s) => s.setUrl);
  const connect = useOpenCodeStore((s) => s.connect);
  const disconnect = useOpenCodeStore((s) => s.disconnect);

  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const isError = status === "error";

  // Fill in the dynamic serve command for step 2
  const steps = STEPS.map((step, i) =>
    i === 1 ? { ...step, command: getServeCommand() } : step,
  );

  const handleConnect = useCallback(async () => {
    await connect();
    const newStatus = useOpenCodeStore.getState().status;
    if (newStatus === "connected") {
      toast.success("Connected to opencode server");
    }
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    toast("Disconnected from opencode server", { icon: "🔌" });
  }, [disconnect]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 p-0 overflow-hidden gap-0">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/8 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/20 to-blue-900/20 border border-blue-700/30 shadow-lg shadow-blue-900/20">
            <Radio className="h-8 w-8 text-blue-400" />
          </div>

          <DialogHeader className="items-center gap-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-100">
              Connect to OpenCode
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Link your workflow studio to a running opencode server
            </DialogDescription>
          </DialogHeader>

          {/* Status badge */}
          {isConnected && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-300">
                Connected{version ? ` · v${version}` : ""}
              </span>
            </div>
          )}
          {isError && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span className="text-xs font-medium text-red-300">
                Connection failed
              </span>
            </div>
          )}
        </div>

        <Separator className="bg-zinc-800" />

        {/* ── Steps ─────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              {/* Step number */}
              <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700/50 text-[11px] font-bold text-zinc-400 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">
                  {step.title}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {step.description}
                </p>
                {step.command && (
                  <div className="mt-2 flex items-center gap-1 rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 group">
                    <Terminal className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                    <code className="flex-1 text-xs text-zinc-300 font-mono select-all">
                      {step.command}
                    </code>
                    <button
                      onClick={() => handleCopy(step.command!)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator className="bg-zinc-800" />

        {/* ── Connection form ───────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Server URL
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://127.0.0.1:4096"
              disabled={isConnecting}
              className="bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:border-blue-600 focus-visible:ring-blue-600/20 h-10 font-mono text-sm"
            />
          </div>

          {/* Error message */}
          {isError && error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2.5">
              <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300/80 leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {/* Connected message */}
          {isConnected && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300/80 leading-relaxed">
                Successfully connected to opencode server
                {version ? ` (v${version})` : ""}.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !url.trim()}
                className="flex-1 h-9 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-sm shadow-blue-900/30 disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <Radio className="h-4 w-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  className="flex-1 h-9 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800"
                >
                  <Unplug className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-9 text-sm text-zinc-300 hover:text-zinc-100 border border-zinc-800"
                >
                  Done
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

