// Custom tool `catalog_work`: the boundary between the LLM's fuzzy semantic
// classification and our exact, programmatic capture. The LLM calls it with two
// typed lists; execute() validates, counts, and hands the catalog to a sink.
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { buildCatalog, type Catalog } from "../lib/work-catalog.ts";

export const CatalogWorkParams = Type.Object({
  requirements: Type.Array(Type.String(), {
    description:
      "New features, capabilities, or change-requests. One entry per distinct requirement. Example: 'kiosk screen for the HRM'.",
  }),
  issues: Type.Array(Type.String(), {
    description:
      "Bugs, defects, or things to fix/repair. One entry per distinct issue. Example: 'fix the authentication'.",
  }),
});

/**
 * Build the tool. `onCataloged` is the sink for the captured catalog (record in
 * the session store, emit on the bus — wired in index.ts).
 */
export function createCatalogWorkTool(
  onCataloged: (catalog: Catalog) => void,
): ToolDefinition<typeof CatalogWorkParams> {
  return {
    name: "catalog_work",
    label: "Catalog work (requirements vs issues)",
    description:
      "Record the classification of an incoming request into requirements (change-requests) and issues (bugs). Call this exactly once after classifying.",
    parameters: CatalogWorkParams,
    async execute(_id, params) {
      const catalog = buildCatalog(params.requirements, params.issues);
      onCataloged(catalog);
      const { requirements, issues } = catalog.counts;
      return {
        content: [
          {
            type: "text",
            text: `Cataloged: ${requirements} requirement(s), ${issues} issue(s).`,
          },
        ],
        details: catalog,
      };
    },
  };
}
