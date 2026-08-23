import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { syncVersions } from "./release-workspaces.mjs";

const rootPackage = JSON.parse(
  await readFile(path.join(process.cwd(), "package.json"), "utf8"),
);
const version = rootPackage.version;

if (!version || typeof version !== "string") {
  throw new Error(`Root package.json must define a "version". Got: ${version}`);
}

const synced = await syncVersions(version);
if (synced.length > 0) {
  console.log(`Synced ${synced.length} workspace package(s) -> ${version}`);
}
