import { defineSmiteConfig } from "@smitejs/cli";
import { client } from "@smitejs/client";

export default defineSmiteConfig({
  entry: "packages/cli/test/app.ts",
  plugins: [client({ outfile: "packages/cli/test/.out/app.client.ts" })],
});
