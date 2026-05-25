// Declarative field model for editing a node in the panel form. Fields are DYNAMIC:
// which ones show depends on the chosen action (and aiAssisted for ask). Values are all
// strings in the form; valuesToNode coerces them into a WorkflowNode (and back).
import type { Action, Variant, WorkflowNode } from "../types.ts";

export type FieldKind = "text" | "enum";
export interface FormField {
	id: string;
	label: string;
	kind: FieldKind;
	values?: string[];
}
export type FormValues = Record<string, string>;

const ACTIONS = ["bash", "flag", "llm", "ask"];
const VARIANTS = ["low", "medium", "high"];

/** The fields to show for the current values (action drives the set). */
export function fieldsFor(v: FormValues): FormField[] {
	const fields: FormField[] = [
		{ id: "id", label: "id", kind: "text" },
		{ id: "action", label: "action", kind: "enum", values: ACTIONS },
		{ id: "depends_on", label: "depends_on", kind: "text" },
	];
	switch (v.action || "bash") {
		case "bash":
			fields.push({ id: "command", label: "command", kind: "text" });
			break;
		case "flag":
			fields.push({ id: "flag", label: "flag", kind: "text" }, { id: "args", label: "args", kind: "text" });
			break;
		case "llm":
			fields.push(
				{ id: "provider", label: "provider", kind: "text" },
				{ id: "model", label: "model", kind: "text" },
				{ id: "variant", label: "variant", kind: "enum", values: VARIANTS },
				{ id: "prompt", label: "prompt", kind: "text" },
				{ id: "instructions", label: "instructions", kind: "text" },
			);
			break;
		case "ask":
			fields.push({ id: "aiAssisted", label: "aiAssisted", kind: "enum", values: ["true", "false"] });
			fields.push({ id: "prompt", label: v.aiAssisted === "false" ? "question" : "prompt", kind: "text" });
			break;
	}
	return fields;
}

/** Blank values for a new node (defaults to a bash node). */
export function freshValues(): FormValues {
	return { id: "", action: "bash", depends_on: "", variant: "low", aiAssisted: "true" };
}

/** Existing node → editable string values. */
export function nodeToValues(n: WorkflowNode): FormValues {
	return {
		id: n.id,
		action: n.action,
		depends_on: n.depends_on.join(", "),
		command: n.command ?? "",
		flag: n.flag ?? "",
		args: n.args ?? "",
		provider: n.provider ?? "",
		model: n.model ?? "",
		variant: n.variant ?? "low",
		prompt: n.prompt ?? n.questions?.[0]?.label ?? "",
		instructions: n.instructions ?? "",
		aiAssisted: String(n.aiAssisted),
	};
}

/** Form values → a WorkflowNode, coercing aiAssisted and per-action fields. */
export function valuesToNode(v: FormValues): WorkflowNode {
	const action = (v.action || "bash") as Action;
	const depends_on = (v.depends_on || "").split(",").map((s) => s.trim()).filter(Boolean);
	const node: WorkflowNode = { id: v.id || "node", action, aiAssisted: false, depends_on };
	if (action === "bash") node.command = v.command || "";
	else if (action === "flag") {
		node.flag = v.flag || "";
		if (v.args) node.args = v.args;
	} else if (action === "llm") {
		node.aiAssisted = true;
		node.provider = v.provider || "";
		node.model = v.model || "";
		node.variant = (v.variant || "low") as Variant;
		node.prompt = v.prompt || "";
		if (v.instructions) node.instructions = v.instructions;
	} else if (action === "ask") {
		const ai = v.aiAssisted === "true";
		node.aiAssisted = ai;
		if (ai) node.prompt = v.prompt || "";
		else node.questions = [{ id: "q1", type: "text", label: v.prompt || "Answer" }];
	}
	return node;
}
