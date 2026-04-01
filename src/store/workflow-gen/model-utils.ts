/** Separator between provider and model IDs in the workflow generator's selected model value. */
export const MODEL_SELECTION_SEPARATOR = "/";

export interface ParsedSelectedModel {
  providerId: string;
  modelId: string;
}

export function parseSelectedModel(selectedModel: string | null): ParsedSelectedModel | null {
  if (!selectedModel) {
    return null;
  }

  const separatorIndex = selectedModel.indexOf(MODEL_SELECTION_SEPARATOR);
  if (separatorIndex <= 0) {
    return {
      providerId: "",
      modelId: selectedModel,
    };
  }

  return {
    providerId: selectedModel.slice(0, separatorIndex),
    modelId: selectedModel.slice(separatorIndex + MODEL_SELECTION_SEPARATOR.length),
  };
}

