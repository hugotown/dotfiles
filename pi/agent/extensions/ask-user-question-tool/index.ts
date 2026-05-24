// index.ts — extension entry point; handlers MUST be registered before schema is built
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAllHandlers } from "./handlers/register-all.ts";
import { registerAskUserQuestion } from "./tool.ts";

export default function askUserQuestionTool(pi: ExtensionAPI): void {
	registerAllHandlers();
	registerAskUserQuestion(pi);
}
