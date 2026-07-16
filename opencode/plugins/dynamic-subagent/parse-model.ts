export function parseModel(model: string): {
  providerID: string;
  modelID: string;
} {
  const slash = model.indexOf("/");

  if (slash <= 0 || slash === model.length - 1) {
    throw new Error(
      `Invalid model '${model}'. Use "provider/model", e.g. "opencode/claude-haiku-4-5".`,
    );
  }

  return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) };
}
