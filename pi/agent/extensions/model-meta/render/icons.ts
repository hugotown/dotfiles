export interface CapabilityIcons {
  text: string;
  image: string;
  pdf: string;
  video: string;
  reasoning: string;
  tools: string;
}

export const CAPABILITY_ICONS: CapabilityIcons = {
  text: "📝",
  image: "🖼️",
  pdf: "📄",
  video: "🎬",
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
