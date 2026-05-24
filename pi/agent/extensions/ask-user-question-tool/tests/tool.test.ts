// tests/tool.test.ts — legacy test file; imports now come from result.ts via tool.ts re-export
import { expect, test } from "bun:test";
import { buildToolText } from "../tool.ts";

test("cancelled produces a clear instruction", () => {
	const out = buildToolText({ kind: "cancelled" });
	expect(out).toContain("cancelled");
});

test("answers list each question => answer", () => {
	const out = buildToolText({
		kind: "answers",
		answers: [{ question: "Where to show error?", answer: "Banner" }],
		comments: "",
	});
	expect(out).toContain("Where to show error? => Banner");
});

test("comments are appended when present", () => {
	const out = buildToolText({
		kind: "answers",
		answers: [{ question: "Style?", answer: "Dark" }],
		comments: "please use tailwind",
	});
	expect(out).toContain("please use tailwind");
	expect(out).toContain("User comments:");
});

test("multiselect answer shown as comma-joined string", () => {
	const out = buildToolText({
		kind: "answers",
		answers: [{ question: "Pick frameworks", answer: "React, Vue" }],
		comments: "",
	});
	expect(out).toContain("Pick frameworks => React, Vue");
});
