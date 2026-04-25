import type { Provider } from "@/lib/opencode/types";

export interface DynamicModel {
  value: string;
  displayName: string;
}

export interface ModelGroup {
  label: string;
  providerId: string;
  color: string;
  textColor: string;
  models: DynamicModel[];
}

export interface VendorInfo {
  label: string;
  color: string;
  textColor: string;
  order: number;
}

const PROVIDER_COLORS: Array<{ color: string; textColor: string }> = [
  { color: "bg-blue-400", textColor: "text-blue-400/70" },
  { color: "bg-emerald-400", textColor: "text-emerald-400/70" },
  { color: "bg-orange-400", textColor: "text-orange-400/70" },
  { color: "bg-violet-400", textColor: "text-violet-400/70" },
  { color: "bg-rose-400", textColor: "text-rose-400/70" },
  { color: "bg-cyan-400", textColor: "text-cyan-400/70" },
  { color: "bg-amber-400", textColor: "text-amber-400/70" },
  { color: "bg-pink-400", textColor: "text-pink-400/70" },
];

const KNOWN_PROVIDER_COLORS: Record<string, { color: string; textColor: string }> = {
  "claude-code": { color: "bg-orange-400", textColor: "text-orange-400/70" },
  "github-copilot": { color: "bg-blue-400", textColor: "text-blue-400/70" },
  anthropic: { color: "bg-orange-400", textColor: "text-orange-400/70" },
  google: { color: "bg-cyan-400", textColor: "text-cyan-400/70" },
  opencode: { color: "bg-emerald-400", textColor: "text-emerald-400/70" },
  openai: { color: "bg-emerald-400", textColor: "text-emerald-400/70" },
};

const FAMILY_VENDOR_MAP: Record<string, VendorInfo> = {
  claude: {
    label: "Anthropic",
    color: "bg-orange-400",
    textColor: "text-orange-400/70",
    order: 0,
  },
  gemini: {
    label: "Google",
    color: "bg-cyan-400",
    textColor: "text-cyan-400/70",
    order: 1,
  },
  gpt: {
    label: "OpenAI",
    color: "bg-emerald-400",
    textColor: "text-emerald-400/70",
    order: 2,
  },
  grok: {
    label: "xAI",
    color: "bg-rose-400",
    textColor: "text-rose-400/70",
    order: 3,
  },
};

/** Threshold: if a provider has more models than this, sub-group by family vendor */
export const SUB_GROUP_THRESHOLD = 6;

export function getProviderColors(id: string, index: number) {
  return KNOWN_PROVIDER_COLORS[id] ?? PROVIDER_COLORS[index % PROVIDER_COLORS.length];
}

export function resolveVendor(family: string | undefined): VendorInfo | null {
  if (!family) return null;

  for (const [prefix, info] of Object.entries(FAMILY_VENDOR_MAP)) {
    if (family.startsWith(prefix)) return info;
  }

  return null;
}

export function buildModelGroups(providers: Provider[]): ModelGroup[] {
  const result: ModelGroup[] = [];

  for (const [providerIndex, provider] of providers.entries()) {
    const activeModels = Object.values(provider.models).filter((model) => model.status === "active");
    if (activeModels.length === 0) continue;

    const vendorCount = new Set(
      activeModels.map((model) => resolveVendor(model.family)?.label).filter(Boolean),
    ).size;
    const shouldSubgroup = vendorCount > 1 && activeModels.length > SUB_GROUP_THRESHOLD;

    if (!shouldSubgroup) {
      const models = activeModels
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((model) => ({
          value: `${provider.id}/${model.id}`,
          displayName: model.name,
        }));
      const colors = getProviderColors(provider.id, providerIndex);

      result.push({
        label: provider.name,
        providerId: provider.id,
        color: colors.color,
        textColor: colors.textColor,
        models,
      });
      continue;
    }

    const vendorBuckets = new Map<string, { info: VendorInfo; models: DynamicModel[] }>();
    const ungrouped: DynamicModel[] = [];

    for (const model of activeModels) {
      const vendor = resolveVendor(model.family);
      const mappedModel: DynamicModel = {
        value: `${provider.id}/${model.id}`,
        displayName: model.name,
      };

      if (!vendor) {
        ungrouped.push(mappedModel);
        continue;
      }

      const bucket = vendorBuckets.get(vendor.label);
      if (bucket) {
        bucket.models.push(mappedModel);
        continue;
      }

      vendorBuckets.set(vendor.label, { info: vendor, models: [mappedModel] });
    }

    const sortedBuckets = [...vendorBuckets.values()].sort(
      (left, right) => left.info.order - right.info.order,
    );

    for (const bucket of sortedBuckets) {
      bucket.models.sort((left, right) => left.displayName.localeCompare(right.displayName));
      result.push({
        label: `${provider.name} · ${bucket.info.label}`,
        providerId: provider.id,
        color: bucket.info.color,
        textColor: bucket.info.textColor,
        models: bucket.models,
      });
    }

    if (ungrouped.length > 0) {
      ungrouped.sort((left, right) => left.displayName.localeCompare(right.displayName));
      const fallback = getProviderColors(provider.id, providerIndex);
      result.push({
        label: `${provider.name} · Other`,
        providerId: provider.id,
        color: fallback.color,
        textColor: fallback.textColor,
        models: ungrouped,
      });
    }
  }

  return result;
}

