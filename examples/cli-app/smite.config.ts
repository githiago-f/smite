import { defineSmiteConfig } from "@smitejs/cli";
import { client } from "@smitejs/client";
import { openapi } from "@smitejs/openapi";

export default defineSmiteConfig({
  entry: "./src/app.mjs",
  plugins: [
    client({ outfile: "./src/app.client.ts" }),
    openapi({ outfile: "./openapi.json", title: "Pets API" }),
  ],
});
