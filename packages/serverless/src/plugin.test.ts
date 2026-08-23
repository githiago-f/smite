import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { provider } from "@smitejs/aws";
import { clear, lookupAll } from "@smitejs/core";
import { http } from "@smitejs/http";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { serverless } from "./plugin.js";

afterEach(() => clear());

describe("@smitejs/serverless plugin", () => {
  it("generates a Serverless Framework config from app routes", async () => {
    const app = http.app("orders");
    const routes = http.router();
    routes.accept("GET", "/orders/:id").handler(() => ({ status: 200 }));
    app.use(routes);
    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    // #section - Configure the Serverless Framework plugin
    const plugin = serverless({
      service: "orders-api",
      outfile,
      region: "us-east-1",
      plugins: ["serverless-offline"],
      custom: { offline: { httpPort: 4000 } },
      resources: {
        Resources: {
          AssetsBucket: {
            Type: "AWS::S3::Bucket",
            Properties: { BucketName: "orders-static-assets" },
          },
        },
      },
      functions: {
        api: { app: "orders", handler: "dist/handler.handler" },
      },
    });

    await plugin.run({ apps: [app] });
    // #endsection

    const config = await readFile(outfile, "utf8");
    expect(config).toContain("service: orders-api");
    expect(config).toContain("region: us-east-1");
    expect(config).toContain("handler: dist/handler.handler");
    expect(config).toContain("path: /orders/{id}");
    expect(config).toContain("method: get");
    expect(config).toContain("serverless-offline");
    expect(config).toContain("httpPort: 4000");
    expect(config).toContain("AWS::S3::Bucket");
    expect(config).toContain("orders-static-assets");
    expect(plugin.deploy).toBeTypeOf("function");
  });

  it("emits well-indented YAML that round-trips through the yaml parser", async () => {
    const app = http.app("orders");
    const routes = http.router();
    routes.accept("GET", "/orders/:id").handler(() => ({ status: 200 }));
    app.use(routes);
    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    const plugin = serverless({
      service: "orders-api",
      outfile,
      region: "us-east-1",
      functions: {
        api: { app: "orders", handler: "dist/handler.handler" },
      },
    });

    await plugin.run({ apps: [app] });

    const document = parse(await readFile(outfile, "utf8"));
    expect(document.service).toBe("orders-api");
    expect(document.provider.region).toBe("us-east-1");
    expect(document.functions.api.handler).toBe("dist/handler.handler");
    expect(document.functions.api.events).toEqual([
      { httpApi: { path: "/orders/{id}", method: "get" } },
    ]);
  });

  it("preserves explicit events when supplied", async () => {
    const app = http.app("explicit");
    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    const plugin = serverless({
      service: "explicit-api",
      outfile,
      functions: {
        worker: {
          handler: "dist/worker.handler",
          events: [{ path: "/jobs", method: "post" }],
        },
      },
    });

    await plugin.run({ apps: [app] });

    const config = await readFile(outfile, "utf8");
    expect(config).toContain("path: /jobs");
    expect(config).toContain("method: post");
  });

  it("discovers functions from config entries and build output", async () => {
    const orders = http.app("orders-entry");
    const ordersRoutes = http.router();
    ordersRoutes.accept("GET", "/orders").handler(() => ({ status: 200 }));
    orders.use(ordersRoutes);
    clear();
    const users = http.app("users-entry");
    const usersRoutes = http.router();
    usersRoutes.accept("POST", "/users").handler(() => ({ status: 201 }));
    users.use(usersRoutes);
    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    const plugin = serverless({
      service: "discovered-api",
      outfile,
    });

    await plugin.run({
      apps: [orders, users],
      entries: ["src/orders-entry.ts", "src/users-entry.ts"],
      build: { outdir: "build" },
    });

    const config = await readFile(outfile, "utf8");
    expect(config).toContain("  orders-entry:");
    expect(config).toContain("    handler: build/orders-entry.handler");
    expect(config).toContain("          path: /orders");
    expect(config).toContain("  users-entry:");
    expect(config).toContain("    handler: build/users-entry.handler");
    expect(config).toContain("          path: /users");
  });

  it("emits managed resources and entry-scoped IAM policies", async () => {
    const app = http.app("orders");
    const routes = http.router();
    routes.accept("GET", "/orders").handler(() => ({ status: 200 }));
    app.use(routes);
    const bucket = provider(
      "s3",
      { name: "Assets", bucketName: "orders-assets" },
      () => ({}),
    );
    bucket.requirePermissions(["GetObject"]);
    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    const plugin = serverless({
      service: "orders-api",
      outfile,
      functions: { orders: { handler: "dist/orders.handler", app: "orders" } },
    });

    await plugin.run({
      apps: [app],
      compiledEntries: [
        { entry: "src/orders.ts", apps: [app], descriptors: lookupAll() },
      ],
    });

    const config = await readFile(outfile, "utf8");
    expect(config).toContain("Type: AWS::S3::Bucket");
    expect(config).toContain("BucketName: orders-assets");
    expect(config).toContain("AWS::IAM::Role");
    expect(config).toContain("s3:GetObject");
    expect(config).toContain("Fn::GetAtt:");
  });

  it("emits CloudFormation imports without creating managed resources", async () => {
    const app = http.app("shared");
    const queue = provider(
      "sqs",
      {
        name: "SharedQueue",
        mode: "imported",
        import: { exportName: "shared-queue-Arn" },
      },
      () => ({}),
    );
    queue.requirePermissions(["SendMessage"]);
    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    const plugin = serverless({
      service: "consumer",
      outfile,
      functions: { consumer: { handler: "dist/consumer.handler" } },
    });
    await plugin.run({
      apps: [app],
      compiledEntries: [
        { entry: "src/consumer.ts", apps: [app], descriptors: lookupAll() },
      ],
    });

    const config = await readFile(outfile, "utf8");
    expect(config).toContain("Fn::ImportValue: shared-queue-Arn");
    expect(config).not.toContain("AWS::SQS::Queue");
  });

  it("names functions after their router and scopes events per entry", async () => {
    const itemsApp = http.app("catalog-items");
    const items = http.router({ name: "items" });
    items.accept("GET", "/items").handler(() => ({ status: 200 }));
    items.accept("POST", "/items").handler(() => ({ status: 201 }));
    itemsApp.use(items);

    const cartsApp = http.app("catalog-carts");
    const carts = http.router({ name: "carts" });
    carts.accept("GET", "/cart/:code/items").handler(() => ({ status: 200 }));
    cartsApp.use(carts);

    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    const plugin = serverless({
      service: "catalog-api",
      outfile,
    });

    await plugin.run({
      apps: [itemsApp, cartsApp],
      entries: ["src/items-handler.ts", "src/carts-handler.ts"],
      compiledEntries: [
        { entry: "src/items-handler.ts", apps: [itemsApp], descriptors: [] },
        { entry: "src/carts-handler.ts", apps: [cartsApp], descriptors: [] },
      ],
      build: { outdir: "dist" },
    });

    const document = parse(await readFile(outfile, "utf8"));
    expect(Object.keys(document.functions)).toEqual(["items", "carts"]);
    expect(document.functions.items.handler).toBe("dist/items-handler.handler");
    expect(document.functions.items.events).toEqual([
      { httpApi: { path: "/items", method: "get" } },
      { httpApi: { path: "/items", method: "post" } },
    ]);
    expect(document.functions.carts.handler).toBe("dist/carts-handler.handler");
    expect(document.functions.carts.events).toEqual([
      { httpApi: { path: "/cart/{code}/items", method: "get" } },
    ]);
  });

  it("merges plugins, raw CloudFormation resources, custom, and extensions", async () => {
    const app = http.app("orders");
    const routes = http.router();
    routes.accept("GET", "/orders/:id").handler(() => ({ status: 200 }));
    app.use(routes);
    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    const plugin = serverless({
      service: "orders-api",
      outfile,
      region: "us-east-1",
      plugins: ["serverless-offline", { localPath: "./plugins/custom.js" }],
      custom: {
        offline: { httpPort: 4000 },
        prune: { automatic: true, number: 3 },
      },
      resources: {
        Resources: {
          Distribution: {
            Type: "AWS::CloudFront::Distribution",
            Properties: { Enabled: true },
          },
        },
        Outputs: {
          DistributionDomain: {
            Value: { "Fn::GetAtt": ["Distribution", "DomainName"] },
          },
        },
      },
      extend: {
        configValidationMode: "error",
        provider: { environment: { NODE_ENV: "production" } },
      },
      functions: {
        api: { app: "orders", handler: "dist/handler.handler" },
      },
    });

    await plugin.run({ apps: [app] });

    const document = parse(await readFile(outfile, "utf8"));
    expect(document.plugins).toEqual([
      "serverless-offline",
      { localPath: "./plugins/custom.js" },
    ]);
    expect(document.custom).toEqual({
      offline: { httpPort: 4000 },
      prune: { automatic: true, number: 3 },
    });
    expect(document.configValidationMode).toBe("error");
    expect(document.provider.environment).toEqual({ NODE_ENV: "production" });
    expect(document.resources.Resources.Distribution).toEqual({
      Type: "AWS::CloudFront::Distribution",
      Properties: { Enabled: true },
    });
    expect(document.resources.Outputs.DistributionDomain).toEqual({
      Value: { "Fn::GetAtt": ["Distribution", "DomainName"] },
    });
    expect(document.resources.Resources.ApiRole).toBeDefined();
  });

  it("lets raw resources override generated CloudFormation entries", async () => {
    const app = http.app("orders");
    const routes = http.router();
    routes.accept("GET", "/orders").handler(() => ({ status: 200 }));
    app.use(routes);
    const directory = await mkdtemp(join(tmpdir(), "smite-serverless-"));
    const outfile = join(directory, "serverless.yml");
    const plugin = serverless({
      service: "orders-api",
      outfile,
      resources: {
        Resources: {
          ApiRole: {
            Type: "AWS::IAM::Role",
            Properties: {
              AssumeRolePolicyDocument: {
                Version: "2012-10-17",
                Statement: [],
              },
            },
          },
        },
      },
      functions: { orders: { handler: "dist/orders.handler" } },
    });

    await plugin.run({ apps: [app] });

    const document = parse(await readFile(outfile, "utf8"));
    expect(
      document.resources.Resources.ApiRole.Properties.ManagedPolicyArns,
    ).toBeUndefined();
  });
});
