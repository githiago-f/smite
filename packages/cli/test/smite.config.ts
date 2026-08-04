import { defineSmiteConfig } from "@smite/cli";
import { client } from "@smite/client";

export default defineSmiteConfig({
  entry: "packages/cli/test/app.ts",
  plugins: [client({ outfile: "packages/cli/test/.out/app.client.ts" })],
});
