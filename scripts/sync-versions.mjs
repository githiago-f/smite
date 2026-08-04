import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const rootPackagePath = path.join(rootDir, "package.json");
const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
const version = rootPackage.version;

if (!version || typeof version !== "string") {
  throw new Error(`Root package.json must define a "version". Got: ${version}`);
}

const workspaceDirs = ["packages", "examples"];

const scopeNames = new Set();
const packagePaths = [rootPackagePath];

for (const workspaceDir of workspaceDirs) {
  const base = path.join(rootDir, workspaceDir);
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    continue;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    packagePaths.push(path.join(base, entry.name, "package.json"));
  }
}

const shouldSync = (name) =>
  name.startsWith("@smite/") || name === "create-smite-app";

const syncRange = (range, nextVersion) =>
  range.startsWith("^") ? `^${nextVersion}` : nextVersion;

for (const packagePath of packagePaths) {
  let source;
  try {
    source = await readFile(packagePath, "utf8");
  } catch {
    continue;
  }

  const packageJson = JSON.parse(source);
  if (shouldSync(packageJson.name)) {
    scopeNames.add(packageJson.name);
  }

  let changed = false;

  if (packagePath !== rootPackagePath && shouldSync(packageJson.name)) {
    if (packageJson.version !== version) {
      packageJson.version = version;
      changed = true;
    }
  }

  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = packageJson[field];
    if (!deps) {
      continue;
    }
    for (const [depName, depRange] of Object.entries(deps)) {
      if (scopeNames.size > 0 && shouldSync(depName)) {
        const next = syncRange(depRange, version);
        if (next !== depRange) {
          deps[depName] = next;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    console.log(`Synced ${path.relative(rootDir, packagePath)} -> ${version}`);
  }
}
