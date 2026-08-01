import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { renderExpressSpec, renderPlantUml } from "@smite/spec";

const usage = `usage: node scripts/spec.mjs <entry> [outDir]

Reads the application code of a compiled Smite application entry and writes
the two canonical specifications next to each other:

  <outDir>/express.spec.md  — Express runtime wiring specification
  <outDir>/plantuml.puml    — PlantUML documentation diagram

<entry>   compiled module (ESM) exporting a "controllers" array
outDir    output directory (default: current directory)

example: node scripts/spec.mjs examples/http/dist/components.js examples/http/spec`;

const main = async () => {
  const [, , entry, outDir = "."] = process.argv;

  if (!entry) {
    console.error(usage);
    process.exit(1);
  }

  const moduleUrl = pathToFileURL(path.resolve(entry)).href;
  const loaded = await import(moduleUrl);

  const controllers = extractControllers(loaded);

  if (controllers.length === 0) {
    console.error(`No controllers exported by "${entry}".`);
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  const expressSpec = renderExpressSpec(controllers);
  const plantuml = renderPlantUml(controllers);

  const expressFile = path.join(outDir, "express.spec.md");
  const plantumlFile = path.join(outDir, "plantuml.puml");

  await writeFile(expressFile, expressSpec);
  await writeFile(plantumlFile, plantuml);

  console.log(`Wrote ${path.relative(process.cwd(), expressFile)}`);
  console.log(`Wrote ${path.relative(process.cwd(), plantumlFile)}`);
};

const extractControllers = (loaded) => {
  if (Array.isArray(loaded.controllers)) {
    return loaded.controllers;
  }

  if (loaded.controllers !== undefined) {
    return [loaded.controllers];
  }

  return [];
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
