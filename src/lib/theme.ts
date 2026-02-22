/* eslint-disable @typescript-eslint/no-unused-vars */
// ── Theme constants ──────────────────────────────────────────────────────────
// Single source of truth for all recurring background, border, text and
// surface colors used across the Nexus Workflow Studio UI.

// ── Backgrounds ─────────────────────────────────────────────────────────────
/** Darkest app background – used for the root shell and properties panel */
export const BG_APP       = "bg-zinc-950";
/** Primary surface – panels, header, node cards, dialogs */
export const BG_SURFACE   = "bg-zinc-900";
/** Elevated surface – hover states, active tabs, minimap toggle */
export const BG_ELEVATED  = "bg-zinc-800";
/** Canvas background hex – used in ReactFlow inline style */
export const BG_CANVAS_HEX = "#09090b";

// ── Borders ──────────────────────────────────────────────────────────────────
/** Default separator / panel border */
export const BORDER_DEFAULT  = "border-zinc-800";
/** Subtle node / item border */
export const BORDER_MUTED    = "border-zinc-700";
/** Node border at 50% opacity */
export const BORDER_NODE     = "border-zinc-700/50";
/** Selected-node ring + border */
export const BORDER_SELECTED = "border-zinc-500";
export const RING_SELECTED   = "ring-zinc-500/50";

// ── Text ─────────────────────────────────────────────────────────────────────
/** High-emphasis text */
export const TEXT_PRIMARY   = "text-zinc-100";
/** Medium-emphasis text */
export const TEXT_SECONDARY = "text-zinc-300";
/** Low-emphasis / label text */
export const TEXT_MUTED     = "text-zinc-400";
/** Placeholder / disabled text */
export const TEXT_SUBTLE    = "text-zinc-500";

// ── Canvas / ReactFlow decorations ───────────────────────────────────────────
/** Dot-grid color hex */
export const CANVAS_DOT_COLOR   = "#333";
/** Edge stroke color hex */
export const CANVAS_EDGE_STROKE = "#555";
/** MiniMap node fill hex */
export const MINIMAP_NODE_COLOR = "#444";
/** MiniMap mask color */
export const MINIMAP_MASK_COLOR = "rgba(0,0,0,0.5)";

