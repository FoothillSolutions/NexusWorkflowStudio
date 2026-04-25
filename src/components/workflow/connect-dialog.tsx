"use client";

import { useCallback, useMemo, useState } from "react";
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
import {
  DEFAULT_ACP_BRIDGE_URL,
  DEFAULT_DIRECT_OPENCODE_URL,
  getAIConnectionPresets,
} from "@/lib/opencode/config";
import { useOpenCodeStore } from "@/store/opencode";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ConnectionPresetId = "claude-code-bridge" | "opencode-bridge" | "opencode-direct" | "custom";

interface SetupStep {
  title: string;
  description: string;
  command: string | null;
}

function inferPresetId(url: string): ConnectionPresetId {
  const trimmed = url.trim();
  if (trimmed === DEFAULT_DIRECT_OPENCODE_URL) return "opencode-direct";
  if (trimmed === DEFAULT_ACP_BRIDGE_URL) return "claude-code-bridge";
  return "custom";
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
  const [manualPresetId, setManualPresetId] = useState<ConnectionPresetId | null>(null);
  const selectedPresetId = manualPresetId ?? inferPresetId(url);

  const presets = useMemo(
    () => getAIConnectionPresets(typeof window === "undefined" ? undefined : window.location.origin),
    [],
  );

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;

  const steps = useMemo<SetupStep[]>(() => {
    if (!selectedPreset) {
      return [
        {
          title: "Start your endpoint",
          description: "Launch an OpenCode-compatible server or an ACP bridge endpoint.",
          command: null,
        },
        {
          title: "Connect below",
          description: "Enter the endpoint URL and click Connect.",
          command: null,
        },
      ];
    }

    return [
      ...(selectedPreset.installCommand
        ? [{
            title: "Install runtime",
            description: "Install the runtime required for this endpoint preset.",
            command: selectedPreset.installCommand,
          } satisfies SetupStep]
        : []),
      ...(selectedPreset.setupCommand
        ? [{
            title: "One-time setup",
            description: "Prepare the Claude Code ACP wrapper used by the bridge preset.",
            command: selectedPreset.setupCommand,
          } satisfies SetupStep]
        : []),
      {
        title: selectedPreset.id === "opencode-direct" ? "Start OpenCode" : "Start the ACP bridge",
        description: selectedPreset.description,
        command: selectedPreset.startCommand,
      },
      {
        title: "Connect below",
        description: `Use ${selectedPreset.url} as the endpoint URL and click Connect.`,
        command: null,
      },
    ];
  }, [selectedPreset]);

  const handleConnect = useCallback(async () => {
    await connect();
    const newStatus = useOpenCodeStore.getState().status;
    if (newStatus === "connected") {
      toast.success("Connected to AI endpoint");
    }
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    toast("Disconnected from AI endpoint", { icon: "🔌" });
  }, [disconnect]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }, []);

  const handlePresetSelect = useCallback((presetId: ConnectionPresetId) => {
    setManualPresetId(presetId);
    const preset = presets.find((item) => item.id === presetId);
    if (preset) {
      setUrl(preset.url);
    }
  }, [presets, setUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 p-0 overflow-hidden gap-0">
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-blue-600/8 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600/20 to-blue-900/20 border border-blue-700/30 shadow-lg shadow-blue-900/20">
            <Radio className="h-8 w-8 text-blue-400" />
          </div>

          <DialogHeader className="items-center gap-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-100">
              Connect AI Endpoint
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Use the bundled ACP bridge for Claude Code or OpenCode, or connect directly to OpenCode
            </DialogDescription>
          </DialogHeader>

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

        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">Quick start presets</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Claude Code and OpenCode are both supported through the ACP bridge. Direct OpenCode is still available.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {presets.map((preset) => {
              const isActive = selectedPresetId === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id as ConnectionPresetId)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    isActive
                      ? "border-blue-500/40 bg-blue-500/10"
                      : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight text-zinc-100">{preset.label}</p>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        isActive
                          ? "border-blue-500/30 bg-blue-500/15 text-blue-200"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400",
                      )}
                    >
                      {preset.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{preset.description}</p>
                  <p className="mt-2 text-[11px] font-mono text-zinc-400">{preset.url}</p>
                </button>
              );
            })}
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        <div className="px-6 py-5 space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex shrink-0 h-6 w-6 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700/50 text-[11px] font-bold text-zinc-400 mt-0.5">
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
                      type="button"
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

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Endpoint URL
            </label>
            <Input
              value={url}
              onChange={(e) => {
                setManualPresetId("custom");
                setUrl(e.target.value);
              }}
              placeholder={DEFAULT_ACP_BRIDGE_URL}
              disabled={isConnecting}
              className="bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:border-blue-600 focus-visible:ring-blue-600/20 h-10 font-mono text-sm"
            />
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Default bridge endpoint: {DEFAULT_ACP_BRIDGE_URL}. Direct OpenCode default: {DEFAULT_DIRECT_OPENCODE_URL}.
            </p>
          </div>

          {isError && error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2.5">
              <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300/80 leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {isConnected && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300/80 leading-relaxed">
                Successfully connected to the configured AI endpoint
                {version ? ` (v${version})` : ""}.
              </p>
            </div>
          )}

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

