import { defineSmiteConfig } from "@smitejs/cli";
import { client } from "@smitejs/client";
import { openapi } from "@smitejs/openapi";

export default defineSmiteConfig({
  entries: ["./src/app.ts"],
  plugins: [
    client({ outfile: "./src/app.client.ts" }),
    openapi({ outfile: "./openapi.json", title: "{{Title}}" }),
  ],
});
