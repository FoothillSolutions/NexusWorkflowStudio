"use client"

import type { CSSProperties } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const TOAST_CLASSNAMES: NonNullable<ToasterProps["toastOptions"]>["classNames"] = {
  toast:
    "group toast pointer-events-auto w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-zinc-700/70 bg-zinc-950/92 px-3.5 py-3 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl [&_[data-icon]]:mt-0.5 [&_[data-icon]]:text-zinc-300",
  content: "gap-0.5",
  title: "text-[13px] font-semibold leading-5 text-zinc-100",
  description: "text-[12px] leading-5 text-zinc-400",
  actionButton:
    "h-7 rounded-xl border border-zinc-700/80 bg-zinc-800/85 px-2.5 text-[11px] font-medium text-zinc-100 transition-colors hover:bg-zinc-700",
  cancelButton:
    "h-7 rounded-xl border border-zinc-700/80 bg-transparent px-2.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100",
  closeButton:
    "border-zinc-700/80 bg-zinc-900/90 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100",
  success: "[&_[data-icon]]:text-emerald-300",
  info: "[&_[data-icon]]:text-sky-300",
  warning: "[&_[data-icon]]:text-amber-300",
  error: "[&_[data-icon]]:text-red-300",
  loading: "[&_[data-icon]]:text-violet-300",
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-left"
      visibleToasts={4}
      expand
      offset={16}
      mobileOffset={12}
      gap={10}
      toastOptions={{
        classNames: TOAST_CLASSNAMES,
      }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "rgba(9, 9, 11, 0.92)",
          "--normal-text": "rgb(244 244 245)",
          "--normal-border": "rgba(63, 63, 70, 0.72)",
          "--border-radius": "1rem",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
