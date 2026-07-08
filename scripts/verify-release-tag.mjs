import semver from "semver";
import {
  collectPublishableWorkspaces,
  getReleaseVersion,
} from "./release-workspaces.mjs";

const version = getReleaseVersion();

if (!semver.valid(version)) {
  throw new Error(
    `Release tag must be SemVer, usually prefixed with "v". Received: ${version}`,
  );
}

const workspaces = await collectPublishableWorkspaces();

if (workspaces.length === 0) {
  throw new Error("No publishable workspaces found.");
}

const mismatches = workspaces.filter(
  (workspace) => workspace.packageJson.version !== version,
);

if (mismatches.length > 0) {
  throw new Error(
    [
      `Release tag v${version} does not match every publishable workspace version.`,
      ...mismatches.map(
        (workspace) =>
          `- ${workspace.packageJson.name}: ${workspace.packageJson.version}`,
      ),
    ].join("\n"),
  );
}

console.log(
  `Release v${version} is valid for ${workspaces
    .map((workspace) => workspace.packageJson.name)
    .join(", ")}.`,
);
