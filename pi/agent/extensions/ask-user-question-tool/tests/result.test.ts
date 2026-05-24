// tests/result.test.ts — buildToolText unit tests
import { expect, test } from "bun:test";
import { buildToolText } from "../result.ts";

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

test("no answer shows (no answer)", () => {
	const out = buildToolText({
		kind: "answers",
		answers: [{ question: "Q1?", answer: "" }],
		comments: "",
	});
	expect(out).toContain("(no answer)");
});

test("custom note overrides default prefix", () => {
	const out = buildToolText({
		kind: "answers",
		answers: [],
		comments: "",
		note: "Custom note here",
	});
	expect(out).toContain("Custom note here");
	expect(out).not.toContain("The user answered the form:");
});
