/**
 * Shared Gemini client + API-key resolution (consolidates gemini-common setup).
 * Every module depends on this — never instantiate GoogleGenAI directly.
 */
import { GoogleGenAI } from "@google/genai";

export function resolveApiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error(
      "Missing API key: set GEMINI_API_KEY or GOOGLE_API_KEY in your shell environment.",
    );
  }
  return key;
}

export function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: resolveApiKey() });
}
