import { defineSmiteConfig } from "@smite/cli";
import { client } from "@smite/client";
import { openapi } from "@smite/openapi";

export default defineSmiteConfig({
  entry: "./src/app.mjs",
  plugins: [
    client({ outfile: "./src/app.client.ts" }),
    openapi({ outfile: "./openapi.json", title: "Pets API" }),
  ],
});
