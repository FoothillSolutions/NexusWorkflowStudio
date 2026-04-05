import { customAlphabet } from "nanoid";
import type { SwitchBranch } from "./types";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export function createSwitchBranchId() {
  return `switch-branch-${nanoid(8)}`;
}

export function createSwitchBranch(branch: Partial<SwitchBranch> = {}): SwitchBranch {
  return {
    id: branch.id ?? createSwitchBranchId(),
    label: branch.label ?? "",
    condition: branch.condition ?? "",
  };
}

export function createDefaultSwitchBranches(): SwitchBranch[] {
  return [
    createSwitchBranch({ label: "Case 1", condition: "" }),
    createSwitchBranch({ label: "Case 2", condition: "" }),
    createSwitchBranch({ label: "default", condition: "Other cases" }),
  ];
}

export function normalizeSwitchBranches(branches?: SwitchBranch[]): SwitchBranch[] {
  if (!branches?.length) return createDefaultSwitchBranches();
  return branches.map((branch) => createSwitchBranch(branch));
}

export function isDefaultSwitchBranch(branch: Pick<SwitchBranch, "label">, index: number, total: number) {
  return index === total - 1 || branch.label === "default";
}

export function getSwitchBranchHandleId(
  branch: Pick<SwitchBranch, "id" | "label">,
  index: number,
  total: number,
) {
  if (branch.id) return branch.id;
  if (isDefaultSwitchBranch(branch, index, total)) return "default";
  return `branch-${index}`;
}

export function getSwitchBranchHandleAliases(
  branch: Pick<SwitchBranch, "id" | "label">,
  index: number,
  total: number,
) {
  const aliases = new Set<string>();
  const primary = getSwitchBranchHandleId(branch, index, total);
  const indexHandle = `branch-${index}`;

  if (indexHandle !== primary) aliases.add(indexHandle);
  if (isDefaultSwitchBranch(branch, index, total) && primary !== "default") aliases.add("default");

  const trimmedLabel = branch.label.trim();
  if (trimmedLabel && trimmedLabel !== primary) aliases.add(trimmedLabel);

  return [...aliases];
}

export function findSwitchBranchIndexByHandle(
  branches: Array<Pick<SwitchBranch, "id" | "label">>,
  handle: string | null | undefined,
) {
  if (!handle) return -1;

  return branches.findIndex((branch, index) => {
    const primary = getSwitchBranchHandleId(branch, index, branches.length);
    if (handle === primary) return true;
    return getSwitchBranchHandleAliases(branch, index, branches.length).includes(handle);
  });
}

export function getSwitchBranchLabelFromHandle(
  branches: Array<Pick<SwitchBranch, "id" | "label">>,
  handle: string | null | undefined,
) {
  const index = findSwitchBranchIndexByHandle(branches, handle);
  if (index === -1) return null;

  const branch = branches[index];
  if (branch.label.trim()) return branch.label;
  return isDefaultSwitchBranch(branch, index, branches.length) ? "default" : `Case ${index + 1}`;
}

