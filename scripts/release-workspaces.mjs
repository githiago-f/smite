import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, "packages");

export const getReleaseVersion = () => {
  const positionalArg = process.argv
    .slice(2)
    .find((arg) => !arg.startsWith("--"));

  const refName =
    process.env.RELEASE_VERSION ??
    process.env.GITHUB_REF_NAME ??
    positionalArg ??
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

const isWorkspaceScope = (name) =>
  name.startsWith("@smitejs/") ||
  name === "create-smite-app" ||
  name === "smite-cli";

const syncRange = (range, nextVersion) =>
  range.startsWith("^") ? `^${nextVersion}` : nextVersion;

const workspacePackagePaths = async () => {
  const packagePaths = [path.join(rootDir, "package.json")];
  for (const workspaceDir of ["packages", "examples"]) {
    const base = path.join(rootDir, workspaceDir);
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        packagePaths.push(path.join(base, entry.name, "package.json"));
      }
    }
  }
  return packagePaths;
};

/**
 * Rewrites every workspace package's own `version` and all cross-workspace
 * dependency ranges (`@smitejs/*`, `create-smite-app`, `smite-cli`) to
 * `nextVersion`. The root package's own version is left untouched; only its
 * workspace-scoped dependencies are updated. Returns the synced file paths.
 */
export const syncVersions = async (nextVersion) => {
  const synced = [];
  for (const packagePath of await workspacePackagePaths()) {
    let source;
    try {
      source = await readFile(packagePath, "utf8");
    } catch {
      continue;
    }

    const packageJson = JSON.parse(source);
    let changed = false;

    if (
      packagePath !== path.join(rootDir, "package.json") &&
      isWorkspaceScope(packageJson.name) &&
      packageJson.version !== nextVersion
    ) {
      packageJson.version = nextVersion;
      changed = true;
    }

    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
    ]) {
      const deps = packageJson[field];
      if (!deps) {
        continue;
      }
      for (const [depName, depRange] of Object.entries(deps)) {
        if (isWorkspaceScope(depName)) {
          const next = syncRange(depRange, nextVersion);
          if (next !== depRange) {
            deps[depName] = next;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      synced.push(path.relative(rootDir, packagePath));
    }
  }
  return synced;
};
