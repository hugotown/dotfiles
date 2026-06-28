import { registerObraSpFlow } from "./src/extension/register.ts";
import type { PiCommandApi } from "./src/types/command.ts";

export default function obraSpFlowExtension(pi: PiCommandApi): void {
	registerObraSpFlow(pi);
}
