import { spawn } from "node:child_process";
import semver from "semver";
import {
  collectPublishableWorkspaces,
  getReleaseVersion,
} from "./release-workspaces.mjs";

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`${command} ${args.join(" ")} failed with code ${code}`),
      );
    });
  });

const version = getReleaseVersion();
const workspaces = await collectPublishableWorkspaces();

const registry = process.argv.includes("--npm")
  ? "https://registry.npmjs.org"
  : "http://localhost:4873";

const versionArgs =
  version === "" && !semver.valid(version)
    ? []
    : ["--new-version", version, "--no-git-tag-version"];

for (const workspace of workspaces) {
  const target = version === "" ? workspace.packageJson.version : version;
  console.log(`Publishing ${workspace.packageJson.name}@${target} -> ${registry}`);

  await run("yarn", [
    "workspace",
    workspace.packageJson.name,
    "publish",
    "--registry",
    registry,
    "--access",
    "public",
    ...versionArgs,
  ]);
}
