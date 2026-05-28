/** gemini-image-generation core: text prompt → saved image file. */
import { getClient } from "../client";
import { outputPath, saveBytes } from "../output";
import { diagnoseEmptyResponse, extensionFor } from "./response";
import type { GeneratedImageDetails, ImageForm } from "./types";

export async function generateImage(form: ImageForm, cwd: string): Promise<GeneratedImageDetails> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: form.model,
    contents: form.prompt,
    config: {
      responseModalities: ["IMAGE"],
      temperature: form.temperature,
      ...(form.seed !== null ? { seed: form.seed } : {}),
      imageConfig: { aspectRatio: form.aspectRatio, imageSize: form.imageSize },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
    if (inline?.data) {
      const mimeType = inline.mimeType ?? "image/png";
      const path = saveBytes(outputPath(cwd, "images", form.prompt, extensionFor(mimeType)), inline.data);
      return {
        path, base64: inline.data, mimeType,
        model: form.model, aspectRatio: form.aspectRatio, imageSize: form.imageSize,
      };
    }
  }
  throw new Error(diagnoseEmptyResponse(response));
}
