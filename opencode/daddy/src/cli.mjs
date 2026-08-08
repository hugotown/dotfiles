#!/usr/bin/env node
import {promises as nodeFs} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {loadConfig, prepareRun, runPreparedRun} from "./runtime.mjs";

const option = (args, name) => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} is required`);
  return args[index + 1];
};

export async function main(args = process.argv.slice(2), deps = {}) {
  const fs = deps.fs ?? nodeFs;
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  try {
    const [command] = args;
    let result;
    if (command === "prepare") {
      const config = await loadConfig(deps.configPath, {fs});
      result = await prepareRun({repo: option(args, "--repo"), config, fs, clock: deps.clock, id: deps.id});
    } else if (command === "run") {
      const runDir = path.resolve(option(args, "--run-dir"));
      const lockPath = path.join(runDir, "run.lock");
      let lock;
      try {
        lock = await fs.open(lockPath, "wx");
      } catch (error) {
        if (error.code === "EEXIST") throw new Error("run is already locked");
        throw error;
      }
      try {
        const state = JSON.parse(await fs.readFile(path.join(runDir, "state", "run.json"), "utf8"));
        if (state.status !== "created") throw new Error(`run cannot start from status ${state.status}`);
        const metadata = JSON.parse(await fs.readFile(path.join(runDir, "metadata.json"), "utf8"));
        const config = JSON.parse(await fs.readFile(path.join(runDir, "config.json"), "utf8"));
        result = await runPreparedRun({runId: metadata.run_id, runDir, repositoryRoot: metadata.repository_root, requestPath: metadata.request_path, config, metadata}, deps);
      } finally {
        try {
          await lock.close();
        } finally {
          await fs.unlink(lockPath);
        }
      }
    } else {
      throw new Error("usage: daddy <prepare --repo PATH | run --run-dir PATH>");
    }
    stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    stderr.write(`daddy: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
