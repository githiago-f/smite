import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "@smite/client";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

await generate({
  entry: join(here, "app.mjs"),
  outfile: join(here, "generated-client.ts"),
  alias: {
    "@smite/core": join(root, "packages/core/src/index.ts"),
    "@smite/http": join(root, "packages/http/src/index.ts"),
  },
});

console.log("Generated examples/typed-client/src/generated-client.ts");
