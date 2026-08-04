import { clear, lookupAll } from "@smitejs/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  cloudFormationResourceOf,
  permissionReferenceOf,
  provider,
  referenceOf,
  requirePermissions,
} from "./index.js";

afterEach(() => clear());

describe("@smitejs/aws providers", () => {
  it("declares a managed resource and lazily caches its client", () => {
    let creates = 0;
    const bucket = provider(
      "s3",
      { name: "Assets", bucketName: "assets-bucket" },
      () => {
        creates += 1;
        return { send: () => "ok" };
      },
    );

    expect(creates).toBe(0);
    expect(bucket.client).toBe(bucket.client);
    expect(creates).toBe(1);
    expect(lookupAll("aws.resource")).toHaveLength(1);
    expect(
      cloudFormationResourceOf(lookupAll("aws.resource")[0] as never),
    ).toEqual({
      Type: "AWS::S3::Bucket",
      Properties: { BucketName: "assets-bucket" },
    });
  });

  it("qualifies permissions and resolves a managed ARN reference", () => {
    const bucket = provider("s3", { name: "Assets" }, () => ({}));
    bucket.requirePermissions(["GetObject", "s3:ListBucket"]);

    const permission = lookupAll("aws.permission")[0];
    expect(permission?.data.actions).toEqual(["s3:GetObject", "s3:ListBucket"]);
    expect(referenceOf(lookupAll("aws.resource")[0] as never)).toEqual({
      "Fn::GetAtt": ["S3Assets", "Arn"],
    });
    expect(
      permissionReferenceOf(
        lookupAll("aws.resource")[0] as never,
        permission?.data.actions ?? [],
      ),
    ).toEqual({
      "Fn::Join": ["", [{ "Fn::GetAtt": ["S3Assets", "Arn"] }, "/*"]],
    });
  });

  it("supports imported resources and literal permission targets", () => {
    const parameter = provider(
      "ssm",
      {
        name: "SharedParameter",
        mode: "imported",
        import: { exportName: "shared-parameter" },
      },
      () => ({}),
    );
    requirePermissions("arn:aws:ssm:us-east-1:123:parameter/shared", [
      "GetParameter",
    ]);

    expect(referenceOf(lookupAll("aws.resource")[0] as never)).toEqual({
      "Fn::ImportValue": "shared-parameter",
    });
    expect(parameter.resource.mode).toBe("imported");
    expect(lookupAll("aws.permission")[0]?.data.target).toBe(
      "arn:aws:ssm:us-east-1:123:parameter/shared",
    );
  });

  it("rejects imported resources without an export reference", () => {
    expect(() =>
      provider("sqs", { name: "Queue", mode: "imported" }, () => ({})),
    ).toThrow(/import\.exportName/);
  });

  it("declares permissions in a tested application workflow", () => {
    // #section - Declare an S3 provider
    const files = provider("s3", { name: "Files" }, () => ({
      send: () => null,
    }));
    files.requirePermissions(["GetObject"]);
    // #endsection

    expect(files.provider).toBe("s3");
  });
});
