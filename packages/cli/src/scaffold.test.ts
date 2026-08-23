import { spawn } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { createApp } from "./create.js";

const rootDir = process.cwd().endsWith("/packages/cli")
  ? join(process.cwd(), "../..")
  : process.cwd();

const BINS = {
  tsc: join(rootDir, "node_modules", ".bin", "tsc"),
  vitest: join(rootDir, "node_modules", ".bin", "vitest"),
  biome: join(rootDir, "node_modules", ".bin", "biome"),
};

const run = (
  binPath: string,
  args: readonly string[],
  cwd: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(binPath, [...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `\`${binPath} ${args.join(" ")}\` exited ${code}\n${output}`,
          ),
        );
      }
    });
  });

const scaffoldApplication = async (template: "http" | "serverless") => {
  const dir = await mkdtemp(join(tmpdir(), `smite-scaffold-${template}-`));
  try {
    const appDir = await createApp({
      name: `my-${template}-app`,
      baseDir: dir,
      template,
    });
    await symlink(
      join(rootDir, "node_modules"),
      join(appDir, "node_modules"),
      "dir",
    );
    return { appDir, dir };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
};

describe("scaffolded templates pass the same checks as the monorepo", () => {
  for (const template of ["http", "serverless"] as const) {
    describe(`--template ${template}`, () => {
      it("typechecks, lints, and passes its own test suite", async () => {
        const { appDir, dir } = await scaffoldApplication(template);
        try {
          await run(BINS.tsc, ["--noEmit", "--skipLibCheck"], appDir);
          await run(BINS.biome, ["check", "."], appDir);
          await run(BINS.vitest, ["run"], appDir);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      });
    });
  }
});
