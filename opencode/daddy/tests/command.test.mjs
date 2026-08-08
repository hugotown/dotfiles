import test from "node:test";
import assert from "node:assert/strict";
import {promises as fs} from "node:fs";
import path from "node:path";

test("daddy-init preserves the request outside shell and monitors a terminal contract", async () => {
  const commandPath = path.resolve("../commands/daddy-init.md");
  const command = await fs.readFile(commandPath, "utf8");
  assert.match(command, /\$ARGUMENTS/);
  assert.match(command, /write the request text between the markers\s+verbatim/);
  assert.match(command, /Do not use shell interpolation/);
  assert.match(command, /prepare --repo \"\$PWD\"/);
  assert.match(command, /run --run-dir/);
  assert.match(command, /delivery\/ship\.json/);
  assert.match(command, /halted\/halt\.json/);
  assert.doesNotMatch(command, /!`/);
  assert.doesNotMatch(command, /model:/);
});
