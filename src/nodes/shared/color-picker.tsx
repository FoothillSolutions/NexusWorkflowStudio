"use client";

import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESET_COLORS } from "@/nodes/agent/constants";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";

interface ColorPickerProps {
  control: FormControl;
  setValue: FormSetValue;
  color: string;
  defaultColor: string;
}

export function ColorPicker({
  control,
  setValue,
  color,
  defaultColor,
}: ColorPickerProps) {
  return (
    <div className="space-y-2.5">
      <Label>Color</Label>
      <div className="overflow-hidden rounded-xl border border-zinc-700/40 bg-zinc-800/20">
        <div
          className="h-2 w-full transition-colors duration-200"
          style={{ backgroundColor: color }}
        />
        <div className="p-3 pb-2.5">
          <div className="flex flex-wrap justify-center gap-1.5">
            {PRESET_COLORS.map((preset) => {
              const isActive = color === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setValue("color" as never, preset as never, { shouldDirty: true })
                  }
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full ring-offset-1 ring-offset-zinc-900 transition-all duration-150",
                    isActive
                      ? "scale-110 ring-2 ring-white/60"
                      : "hover:scale-110 hover:ring-1 hover:ring-white/20",
                  )}
                  style={{ backgroundColor: preset }}
                  title={preset}
                >
                  {isActive && (
                    <Check className="h-2.5 w-2.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-3 pb-3">
          <Controller
            name="color"
            control={control}
            render={({ field }) => {
              const value = field.value?.trim() ? field.value : defaultColor;
              return (
                <div className="flex items-center gap-2 rounded-lg border border-zinc-700/30 bg-zinc-900/60 px-2 py-1.5">
                  <div className="relative">
                    <input
                      type="color"
                      value={value}
                      onChange={(event) => field.onChange(event.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      title="Pick custom color"
                    />
                    <div
                      className="h-6 w-6 cursor-pointer rounded-md border border-zinc-600/50 shadow-sm"
                      style={{ backgroundColor: value }}
                    />
                  </div>
                  <Input
                    value={value}
                    onChange={(event) => field.onChange(event.target.value)}
                    className="h-6 border-0 bg-transparent px-1 font-mono text-xs uppercase text-zinc-300 shadow-none focus-visible:ring-0"
                    placeholder={defaultColor}
                    maxLength={7}
                  />
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

