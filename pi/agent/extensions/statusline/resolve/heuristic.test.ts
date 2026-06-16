import { expect, test } from "bun:test";
import type { CatalogData } from "../types";
import { heuristicLookup } from "./heuristic";

test("maps pi openai-codex provider ids to the OpenAI models.dev provider", () => {
  const catalog: CatalogData = {
    openai: {
      id: "openai",
      name: "OpenAI",
      models: {
        "gpt-5.5": {
          id: "gpt-5.5",
          name: "GPT-5.5",
        },
      },
    },
  };

  const hit = heuristicLookup(catalog, "openai-codex", "gpt-5.5");

  expect(hit?.provider).toBe("openai");
  expect(hit?.id).toBe("gpt-5.5");
  expect(hit?.model.name).toBe("GPT-5.5");
});
