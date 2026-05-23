// tests/compress.test.ts
import { describe, expect, test } from "bun:test";
import { compressTree, compressPackageJson, compressConfig } from "../lib/compress.ts";

describe("compressTree", () => {
  test("filters out node_modules, .git, dist, build", () => {
    const tree = `src
├── index.ts
├── utils.ts
node_modules
├── react
│   └── index.js
.git
├── config
dist
├── bundle.js
build
├── output.js
__pycache__
├── mod.cpython-39.pyc`;

    const result = compressTree(tree);
    expect(result).toContain("src");
    expect(result).toContain("index.ts");
    expect(result).not.toContain("node_modules");
    expect(result).not.toContain(".git");
    expect(result).not.toContain("dist");
    expect(result).not.toContain("build");
    expect(result).not.toContain("__pycache__");
  });
});

describe("compressPackageJson", () => {
  test("extracts name, dep keys, script keys", () => {
    const pkg = JSON.stringify({
      name: "my-app",
      version: "1.0.0",
      description: "A long description that should be omitted",
      dependencies: { react: "^18.0.0", next: "^14.0.0" },
      devDependencies: { typescript: "^5.0.0", jest: "^29.0.0" },
      scripts: { dev: "next dev", build: "next build", test: "jest" },
    });

    const result = compressPackageJson(pkg);
    expect(result).toContain("my-app");
    expect(result).toContain("react");
    expect(result).toContain("next");
    expect(result).toContain("typescript");
    expect(result).toContain("dev");
    expect(result).toContain("build");
    expect(result).not.toContain("A long description");
    expect(result).not.toContain("^18.0.0");
  });
});

describe("compressConfig", () => {
  test("extracts project name and dependency list from Cargo.toml", () => {
    const toml = `[package]
name = "my-crate"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1", features = ["full"] }`;

    const result = compressConfig("Cargo.toml", toml);
    expect(result).toContain("my-crate");
    expect(result).toContain("serde");
    expect(result).toContain("tokio");
  });
});
