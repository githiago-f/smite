import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, "packages");

export const getReleaseVersion = () => {
  const refName =
    process.env.RELEASE_VERSION ??
    process.env.GITHUB_REF_NAME ??
    process.argv[2] ??
    "";

  return refName.startsWith("v") ? refName.slice(1) : refName;
};

export const collectPublishableWorkspaces = async () => {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const workspaces = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dir = path.join(packagesDir, entry.name);

    let packageSource;
    try {
      packageSource = await readFile(path.join(dir, "package.json"), "utf8");
    } catch {
      continue;
    }

    const packageJson = JSON.parse(packageSource);

    if (packageJson.private === true) {
      continue;
    }

    workspaces.push({
      dir,
      packageJson,
      relativeDir: path.relative(rootDir, dir),
    });
  }

  return workspaces.sort((left, right) =>
    left.packageJson.name.localeCompare(right.packageJson.name),
  );
};
