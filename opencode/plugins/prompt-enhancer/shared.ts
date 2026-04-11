// shared.ts — Types and constants shared between server and TUI

export type PromptCategory =
  | "debug"
  | "code-change"
  | "refactor"
  | "question"
  | "tooling"
  | "general"

export const CLASSIFIER_RULES: Array<{
  pattern: RegExp
  category: PromptCategory
}> = [
  {
    pattern:
      /\b(fix|bug|error|crash|fail|broken|issue|not working|exception|undefined|null pointer|stack trace|traceback)\b/i,
    category: "debug",
  },
  {
    pattern:
      /\b(create|add|implement|build|new|feature|make|setup|install|generate|scaffold)\b/i,
    category: "code-change",
  },
  {
    pattern:
      /\b(refactor|rename|move|extract|clean|split|reorganize|decouple|simplify|restructure)\b/i,
    category: "refactor",
  },
  {
    pattern:
      /\b(what|how|why|explain|where|show me|tell me|describe|understand|walk me through)\b/i,
    category: "question",
  },
  {
    pattern: /\b(plugin|config|opencode|mcp|hook|skill|AGENTS\.md)\b/i,
    category: "tooling",
  },
]

export function classify(prompt: string): PromptCategory {
  for (const { pattern, category } of CLASSIFIER_RULES) {
    if (pattern.test(prompt)) return category
  }
  return "general"
}

export const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "this", "that", "it", "its", "my",
  "our", "your", "their", "i", "me", "we", "you", "he", "she", "they",
  "and", "or", "but", "not", "no", "if", "then", "else", "when", "up",
  "out", "so", "as", "just", "also", "into", "about", "than", "some",
  "very", "make", "please", "want", "need", "help", "let", "como",
  "que", "para", "los", "las", "una", "del", "por", "con", "pero",
  "mas", "est", "esto", "esta", "ese", "esa",
])

// Words that are intent signals, not content keywords
const INTENT_WORDS = new Set([
  "fix", "bug", "error", "crash", "fail", "broken", "issue", "create",
  "add", "implement", "build", "new", "feature", "make", "setup",
  "install", "refactor", "rename", "move", "extract", "clean", "split",
  "what", "how", "why", "explain", "where", "show", "tell", "describe",
  "arregla", "crea", "agrega", "implementa", "construye", "mueve",
])

export function extractKeywords(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !STOP_WORDS.has(w))
    .filter((w) => !INTENT_WORDS.has(w))
    .slice(0, 5)
}

export const REWRITE_SYSTEM_PROMPT = `You are a prompt engineer. Your job is to take a rough, vague user prompt and rewrite it into a clear, specific, actionable prompt for an AI coding assistant.

You will receive:
1. The user's raw prompt
2. Project context (directory structure, git state, tech stack, related files)

Rules:
- Preserve the user's INTENT completely
- Add specificity: which files, which functions, which patterns
- Add constraints: error handling, types, edge cases, existing patterns
- Reference specific files from the context when relevant
- Keep the language of the original prompt (if Spanish, write in Spanish)
- Output ONLY the enhanced prompt text, nothing else
- Do NOT add explanations, metadata, or markdown formatting
- Keep it concise — longer is not better, SPECIFIC is better
- Do NOT wrap the output in quotes or code blocks`

export const TECH_INDICATORS = [
  { file: "package.json", label: "Node.js" },
  { file: "tsconfig.json", label: "TypeScript" },
  { file: "go.mod", label: "Go" },
  { file: "Cargo.toml", label: "Rust" },
  { file: "requirements.txt", label: "Python" },
  { file: "pyproject.toml", label: "Python" },
  { file: "pom.xml", label: "Java (Maven)" },
  { file: "build.gradle", label: "Java (Gradle)" },
  { file: "Gemfile", label: "Ruby" },
  { file: "sst.config.ts", label: "SST" },
  { file: "next.config.js", label: "Next.js" },
  { file: "next.config.ts", label: "Next.js" },
  { file: "nuxt.config.ts", label: "Nuxt" },
  { file: "astro.config.mjs", label: "Astro" },
  { file: "vite.config.ts", label: "Vite" },
  { file: "tailwind.config.js", label: "Tailwind CSS" },
  { file: "tailwind.config.ts", label: "Tailwind CSS" },
  { file: "docker-compose.yml", label: "Docker" },
  { file: "Dockerfile", label: "Docker" },
] as const
