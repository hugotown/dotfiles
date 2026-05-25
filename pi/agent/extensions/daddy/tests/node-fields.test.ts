import { describe, expect, it } from "bun:test";
import { validateWorkflow } from "../lib/validate.ts";
import { fieldsFor, nodeToValues, valuesToNode } from "../panel/node-fields.ts";

describe("node-fields", () => {
	it("fieldsFor shows action-specific fields", () => {
		const llm = fieldsFor({ action: "llm" }).map((f) => f.id);
		expect(llm).toContain("provider");
		expect(llm).toContain("variant");
		expect(fieldsFor({ action: "bash" }).map((f) => f.id)).toContain("command");
	});

	it("valuesToNode builds a valid llm (AI) node", () => {
		const n = valuesToNode({ id: "scout", action: "llm", depends_on: "", provider: "x", model: "y", variant: "low", prompt: "go" });
		expect(n.aiAssisted).toBe(true);
		expect(validateWorkflow({ name: "w", vsm: [{ sipoc: "s", nodes: [n] }] })).toBeNull();
	});

	it("valuesToNode builds a non-AI ask node with a question", () => {
		const n = valuesToNode({ id: "q", action: "ask", depends_on: "", aiAssisted: "false", prompt: "Proceed?" });
		expect(n.aiAssisted).toBe(false);
		expect(n.questions?.[0]?.label).toBe("Proceed?");
	});

	it("nodeToValues round-trips through valuesToNode", () => {
		const original = valuesToNode({ id: "a", action: "bash", depends_on: "x, y", command: "echo hi" });
		const back = valuesToNode(nodeToValues(original));
		expect(back.command).toBe("echo hi");
		expect(back.depends_on).toEqual(["x", "y"]);
	});
});
