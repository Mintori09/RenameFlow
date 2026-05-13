export const PROVIDER_DEFAULTS: Record<string, string> = {
  "openai-compatible": "http://localhost:11434",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com",
};

export const AUTH_REQUIRED: Record<string, boolean> = {
  "openai-compatible": false,
  anthropic: true,
  google: true,
};

export const PROVIDER_LABELS: Record<string, string> = {
  "openai-compatible": "OpenAI Compatible",
  anthropic: "Anthropic",
  google: "Google",
};

export function isProviderConfigured(
  provider: string,
  baseUrl: string,
  apiKey: string,
): boolean {
  if (AUTH_REQUIRED[provider]) {
    return baseUrl.length > 0 && apiKey.length > 0;
  }
  return baseUrl.length > 0;
}

export function getEffectiveBaseUrl(provider: string, baseUrl: string): string {
  if (baseUrl) return baseUrl;
  return PROVIDER_DEFAULTS[provider] || "";
}

