export interface CapabilityIcons {
  image: string;
  pdf: string;
  reasoning: string;
  tools: string;
}

export const CAPABILITY_ICONS: CapabilityIcons = {
  image: "🖼️",
  pdf: "📄",
  reasoning: "🧠",
  tools: "🔧",
};

export const PROVIDER_EMOJI: Record<string, string> = {
  anthropic: "🎀",
  "google-vertex-anthropic": "🎀",
  "amazon-bedrock-anthropic": "🎀",
  openai: "⚫",
  google: "🔷",
  "google-vertex": "🔷",
  xai: "✨",
  meta: "🔵",
  mistral: "🟠",
};

export function providerEmoji(providerId: string): string {
  return PROVIDER_EMOJI[providerId] ?? "🔌";
}
