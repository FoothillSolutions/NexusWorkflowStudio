// ── Node size definitions ────────────────────────────────────────────────────
// Extracted into a standalone module to avoid circular dependencies.
// base-node.tsx (a React component) imports from the store, and the store
// imports from node constants that reference NodeSize — keeping the enum
// here breaks that cycle.

export enum NodeSize {
  Small  = "small",
  Medium = "medium",
  Large  = "large",
  XL     = "xl",
}

/**
 * Layout dimensions (in px) used by the auto-layout algorithm.
 * Width uses the midpoint between min-w and max-w of each size class.
 * Height is an estimate based on typical node content.
 */
export const NODE_SIZE_DIMENSIONS: Record<NodeSize, { width: number; height: number }> = {
  [NodeSize.Small]:  { width: 180, height: 80 },
  [NodeSize.Medium]: { width: 250, height: 100 },
  [NodeSize.Large]:  { width: 350, height: 120 },
  [NodeSize.XL]:     { width: 460, height: 140 },
};

