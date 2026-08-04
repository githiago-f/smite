import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileApp, dispatch, loadConfig } from "@smitejs/cli";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

// In a user project these resolve from node_modules; in the monorepo we point
// them at the source so the example runs without a build.
const alias = {
  "@smitejs/core": join(root, "packages/core/src/index.ts"),
  "@smitejs/fp": join(root, "packages/fp/src/index.ts"),
  "@smitejs/http": join(root, "packages/http/src/index.ts"),
  "@smitejs/cli": join(root, "packages/cli/src/index.ts"),
  "@smitejs/client": join(root, "packages/client/src/index.ts"),
  "@smitejs/openapi": join(root, "packages/openapi/src/index.ts"),
};

const config = await loadConfig(join(here, "../smite.config.ts"), alias);
const app = await compileApp({ entry: config.entry, alias });

for (const plugin of config.plugins) {
  await dispatch(config.plugins, plugin.name, { app });
  console.log(`smite generate ${plugin.name} → done`);
}
