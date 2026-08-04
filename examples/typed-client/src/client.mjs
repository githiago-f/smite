import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

const dir = await mkdtemp(join(tmpdir(), "smite-example-client-"));
const bundlePath = join(dir, "client.cjs");

await esbuild.build({
  entryPoints: [join(here, "generated-client.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2022",
  alias: {
    "@smitejs/client/runtime": join(root, "packages/client/src/runtime.ts"),
  },
});

const { api, configure } = await import(pathToFileURL(bundlePath).href);

configure({ baseUrl: "http://127.0.0.1:4000" });

const health = await api.health.$get();
console.log("GET /health →", health.status, health.body);

const pets = await api.pets.$get({ query: { page: 2 } });
console.log("GET /pets?page=2 →", pets.status, pets.body);

const pet = await api.pets.$id.$get({ params: { id: 42 } });
console.log("GET /pets/42 →", pet.status, pet.body);

const created = await api.pets.$post({ body: { name: "Rex" } });
console.log("POST /pets →", created.status, created.body);
