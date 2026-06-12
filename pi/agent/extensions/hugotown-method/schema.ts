import { Type } from "typebox";

export const RunWorkflowParams = Type.Object({
  flow: Type.String({
    description: "Workflow name; resolved from .hugotown/workflows/<flow>.yaml or bundled.",
  }),
  arguments: Type.Optional(
    Type.String({ description: "Free-form input passed to the workflow as $ARGUMENTS." }),
  ),
});
