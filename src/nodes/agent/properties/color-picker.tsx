"use client";

import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESET_COLORS } from "../constants";
import type { FormControl, FormSetValue } from "@/nodes/shared/form-types";

interface ColorPickerProps {
  control: FormControl;
  setValue: FormSetValue;
  color: string;
  defaultColor: string;
}

export function ColorPicker({ control, setValue, color, defaultColor }: ColorPickerProps) {
  return (
    <div className="space-y-2.5">
      <Label>Color</Label>
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 overflow-hidden">
        <div className="h-2 w-full transition-colors duration-200" style={{ backgroundColor: color }} />
        <div className="p-3 pb-2.5">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {PRESET_COLORS.map((preset) => {
              const isActive = color === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setValue("color" as never, preset as never, { shouldDirty: true })}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all duration-150 flex items-center justify-center ring-offset-1 ring-offset-zinc-900",
                    isActive
                      ? "ring-2 ring-white/60 scale-110"
                      : "hover:scale-110 hover:ring-1 hover:ring-white/20",
                  )}
                  style={{ backgroundColor: preset }}
                  title={preset}
                >
                  {isActive && <Check className="h-2.5 w-2.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />}
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
              const val = field.value?.trim() ? field.value : defaultColor;
              return (
                <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 border border-zinc-700/30 px-2 py-1.5">
                  <div className="relative">
                    <input
                      type="color"
                      value={val}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="Pick custom color"
                    />
                    <div className="w-6 h-6 rounded-md border border-zinc-600/50 cursor-pointer shadow-sm" style={{ backgroundColor: val }} />
                  </div>
                  <Input
                    value={val}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="bg-transparent border-0 shadow-none focus-visible:ring-0 font-mono text-xs uppercase text-zinc-300 h-6 px-1"
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

