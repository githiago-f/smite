import { defineSmiteConfig } from "@smitejs/cli";
import { serverless } from "@smitejs/serverless";

export default defineSmiteConfig({
  entry: "./src/handler.ts",
  plugins: [
    serverless({
      service: "{{name}}",
    }),
  ],
});
