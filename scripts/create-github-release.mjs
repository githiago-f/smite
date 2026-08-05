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

const capture = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "inherit"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim());
        return;
      }

      reject(
        new Error(`${command} ${args.join(" ")} failed with code ${code}`),
      );
    });
  });

const version = getReleaseVersion();

if (!semver.valid(version)) {
  throw new Error(`Release version must be SemVer. Received: ${version}`);
}

const tag = `v${version}`;
const workspaces = await collectPublishableWorkspaces();

const body = [
  `## ${tag}`,
  "",
  "Published to npm:",
  "",
  ...workspaces.map(
    (workspace) =>
      `- [${workspace.packageJson.name}](https://www.npmjs.com/package/${workspace.packageJson.name}) — \`${workspace.packageJson.version}\``,
  ),
  "",
  "### Links",
  "",
  "- [npm organization: smitejs](https://www.npmjs.com/org/smitejs)",
  "- [Documentation](https://githiago-f.github.io/smite/)",
  "- [Repository](https://github.com/githiago-f/smite)",
].join("\n");

const existing = await capture("gh", ["release", "view", tag]).catch(() => "");

if (existing !== "") {
  console.log(`Release ${tag} already exists; skipping.`);
} else {
  await run("gh", ["release", "create", tag, "--title", tag, "--notes", body]);
  console.log(`Created release ${tag}.`);
}
