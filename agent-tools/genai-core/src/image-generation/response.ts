/** Map MIME → extension and diagnose why Gemini returned no image. */
export function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": case "image/jpg": return "jpg";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return "png";
  }
}

export function diagnoseEmptyResponse(response: unknown): string {
  const r = response as {
    promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
      safetyRatings?: Array<{ category?: string; probability?: string; blocked?: boolean }>;
    }>;
  };

  const promptBlock = r.promptFeedback?.blockReason;
  if (promptBlock) {
    const detail = r.promptFeedback?.blockReasonMessage;
    return `Prompt blocked by safety filter (${promptBlock})${detail ? `: ${detail}` : ""}.`;
  }

  const candidate = r.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const textParts = candidate?.content?.parts?.map((p) => p.text).filter((t): t is string => !!t) ?? [];
  const modelText = textParts.join(" ").trim();

  if (finishReason && finishReason !== "STOP") {
    const blockedRatings = (candidate?.safetyRatings ?? [])
      .filter((s) => s.blocked || s.probability === "HIGH")
      .map((s) => `${s.category}=${s.probability}`).join(", ");
    const safetyHint = blockedRatings ? ` Safety: ${blockedRatings}.` : "";
    const textHint = modelText ? ` Model said: "${modelText.slice(0, 200)}".` : "";
    return `Generation stopped (${finishReason}).${safetyHint}${textHint}`;
  }

  if (modelText) return `Model returned text instead of an image: "${modelText.slice(0, 300)}"`;
  return "Empty response from Gemini. Try a different model, simpler prompt, or retry.";
}
