export type CanvasMode = "hand" | "selection";
export type EdgeStyle = "bezier" | "smoothstep";

export type DeleteTarget = {
  type: "node" | "edge" | "selection";
  id: string;
  scope?: "root" | "subworkflow";
  count?: number;
};

