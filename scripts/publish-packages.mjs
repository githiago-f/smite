import { spawn } from "node:child_process";
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

for (const workspace of workspaces) {
  console.log(`Publishing ${workspace.packageJson.name}@${version}`);

  await run("npm", ["publish", workspace.relativeDir, "--access", "public"]);
}
