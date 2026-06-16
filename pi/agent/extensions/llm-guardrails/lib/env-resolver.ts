const ENV_REF = /^\$([A-Z_][A-Z0-9_]*)(?::(.*))?$/s;

export function resolveValue<T>(value: T): T | string {
  if (typeof value !== "string") return value;

  const match = value.match(ENV_REF);
  if (!match) return value;

  const [, name, fallback] = match;
  return process.env[name] ?? fallback ?? value;
}

export function deepResolve(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepResolve);

  if (value && typeof value === "object") {
    const resolved: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) resolved[key] = deepResolve(nested);
    return resolved;
  }

  return resolveValue(value);
}
