import { tauriInvoke } from "./tauriClient";
import type { ModelInfo } from "../types";

export async function getAvailableModels(input: {
  provider: string;
  baseUrl: string;
  apiKey: string;
}): Promise<ModelInfo[]> {
  return tauriInvoke<ModelInfo[]>("get_available_models", {
    provider: input.provider,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
  });
}
