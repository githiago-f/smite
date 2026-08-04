import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { provider } from "@smite/aws";
import { clear, lookupAll } from "@smite/core";
import { http } from "@smite/http";
import { afterEach, describe, expect, it } from "vitest";
import { serverless } from "./plugin.js";

afterEach(() => clear());

describe("@smite/serverless plugin", () => {
  it("generates a Serverless Framework config from app routes", async () => {
    const app = http.app("orders");
    const routes = http.route(app);
    routes.accept("GET", "/orders/:id").handler(() => ({ status: 200 }));
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

    // #section - Configure the Serverless Framework plugin
    await plugin.run({ apps: [app] });
    // #endsection

    const config = await readFile(outfile, "utf8");
    expect(config).toContain("service: orders-api");
    expect(config).toContain("region: us-east-1");
    expect(config).toContain("handler: dist/handler.handler");
    expect(config).toContain("path: /orders/{id}");
    expect(config).toContain("method: get");
    expect(plugin.deploy).toBeTypeOf("function");
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
    http
      .route(orders)
      .accept("GET", "/orders")
      .handler(() => ({ status: 200 }));
    clear();
    const users = http.app("users-entry");
    http
      .route(users)
      .accept("POST", "/users")
      .handler(() => ({ status: 201 }));
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
    http
      .route(app)
      .accept("GET", "/orders")
      .handler(() => ({ status: 200 }));
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
});
