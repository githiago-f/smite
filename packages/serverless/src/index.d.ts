declare const { App } = import("@smite/core");

declare module "@smite/serverless" {
  module "aws" {
    function lambdaify(internal: App): (event: any, ctx: any) => any;
  }
  // ... other options
}
