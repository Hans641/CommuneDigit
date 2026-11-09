const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const platform = process.argv[2];
if (!["android", "ios"].includes(platform))
  throw new Error("Platform required");
const output = join(__dirname, "..", "build", platform);
mkdirSync(output, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    join(__dirname, "..", "node_modules", "react-native", "cli.js"),
    "bundle",
    "--platform",
    platform,
    "--dev",
    "false",
    "--entry-file",
    "index.js",
    "--max-workers",
    "2",
    "--bundle-output",
    join(output, "index.bundle"),
    "--assets-dest",
    join(output, "assets"),
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
