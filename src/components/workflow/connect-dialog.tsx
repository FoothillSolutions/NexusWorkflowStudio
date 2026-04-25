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
  DEFAULT_OPENCODE_BRIDGE_URL,
  getAIConnectionPresets,
} from "@/lib/opencode/config";
import { useOpenCodeStore } from "@/store/opencode";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ConnectionPresetId = "claude-code-bridge" | "opencode-bridge" | "custom";

interface SetupStep {
  title: string;
  description: string;
  command: string | null;
}

function inferPresetId(url: string): ConnectionPresetId {
  const trimmed = url.trim();
  if (trimmed === DEFAULT_OPENCODE_BRIDGE_URL) return "opencode-bridge";
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
  const connectedAgent = useOpenCodeStore((s) => s.connectedAgent);
  const setUrl = useOpenCodeStore((s) => s.setUrl);
  const connect = useOpenCodeStore((s) => s.connect);
  const disconnect = useOpenCodeStore((s) => s.disconnect);

  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const isError = status === "error";
  const [manualPresetId, setManualPresetId] = useState<ConnectionPresetId | null>(null);
  const selectedPresetId = manualPresetId ?? inferPresetId(url);
  const isClaudeSelected = selectedPresetId === "claude-code-bridge";

  // Claude Code uses Anthropic's signature amber/orange. Other presets use blue.
  const accent = isClaudeSelected
    ? {
        cardActive: "border-amber-500/40 bg-amber-500/10",
        badgeActive: "border-amber-500/30 bg-amber-500/15 text-amber-200",
        iconBg: "from-amber-600/20 to-orange-900/20 border-amber-700/30 shadow-amber-900/20",
        iconText: "text-amber-400",
        ring: "from-amber-600/8",
        glow: "bg-amber-500/5",
        button: "bg-amber-600 hover:bg-amber-500 shadow-amber-900/30",
        focus: "focus-visible:border-amber-600 focus-visible:ring-amber-600/20",
      }
    : {
        cardActive: "border-blue-500/40 bg-blue-500/10",
        badgeActive: "border-blue-500/30 bg-blue-500/15 text-blue-200",
        iconBg: "from-blue-600/20 to-blue-900/20 border-blue-700/30 shadow-blue-900/20",
        iconText: "text-blue-400",
        ring: "from-blue-600/8",
        glow: "bg-blue-500/5",
        button: "bg-blue-600 hover:bg-blue-500 shadow-blue-900/30",
        focus: "focus-visible:border-blue-600 focus-visible:ring-blue-600/20",
      };

  const presets = useMemo(
    () => getAIConnectionPresets(typeof window === "undefined" ? undefined : window.location.origin),
    [],
  );

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? null;

  const steps = useMemo<SetupStep[]>(() => {
    if (!selectedPreset) {
      return [
        {
          title: "Start the local server",
          description: "Launch the bundled local agent server.",
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
      {
        title: "Start the local server",
        description: selectedPreset.description,
        command: selectedPreset.startCommand,
      },
      {
        title: "Connect below",
        description: "Click Connect to attach Nexus to the running server.",
        command: null,
      },
    ];
  }, [selectedPreset]);

  const handleConnect = useCallback(async () => {
    await connect();
    const newStatus = useOpenCodeStore.getState().status;
    if (newStatus === "connected") {
      toast.success("Connected to AI Agent");
    }
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    toast("Disconnected from AI Agent");
  }, [disconnect]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }, []);

  const handlePresetSelect = useCallback((presetId: ConnectionPresetId) => {
    setManualPresetId(presetId);
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;

    // Stage the URL only. Picking a preset should NOT auto-reconnect — the
    // user explicitly clicks Connect after selecting. `setUrl` itself tears
    // down the existing client + disposes downstream sessions via the
    // connector-change bus, so the badge correctly flips to "Disconnected"
    // when the staged URL differs from the active connection.
    setUrl(preset.url);
  }, [presets, setUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 p-0 overflow-hidden gap-0">
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
          <div className={cn("absolute inset-0 bg-linear-to-b via-transparent to-transparent pointer-events-none", accent.ring)} />
          <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none", accent.glow)} />

          <div className={cn(
            "relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br border shadow-lg",
            accent.iconBg,
          )}>
            <Radio className={cn("h-8 w-8", accent.iconText)} />
          </div>

          <DialogHeader className="items-center gap-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-100">
              Connect AI Agent
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Connect an AI agent to Nexus.
            </DialogDescription>
          </DialogHeader>

          {isConnected && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-300">
                {connectedAgent ?? "Connected"}{version ? ` · v${version}` : ""}
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
              Pick the agent you want to use.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
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
                      ? accent.cardActive
                      : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight text-zinc-100">{preset.label}</p>
                    {preset.badge && (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          isActive
                            ? accent.badgeActive
                            : "border-zinc-700 bg-zinc-900 text-zinc-400",
                        )}
                      >
                        {preset.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{preset.description}</p>
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
              className={cn(
                "bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 h-10 font-mono text-sm",
                accent.focus,
              )}
            />
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
                Successfully connected{connectedAgent ? ` to ${connectedAgent}` : ""}
                {version ? ` (v${version})` : ""}.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !url.trim()}
                className={cn(
                  "flex-1 h-9 text-white text-sm font-medium shadow-sm disabled:opacity-50",
                  accent.button,
                )}
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

