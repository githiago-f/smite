import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  CreateEventBusCommand,
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import {
  GetParameterCommand,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { clear } from "@smitejs/core";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { flociEndpoint, startFloci } from "./floci.container.js";
import { provider } from "./index.js";

const enabled = process.env.SMITE_FLOCI === "1";
const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" };

let endpoint = process.env.AWS_ENDPOINT_URL;
let clientConfig = { endpoint: endpoint ?? "", region, credentials };

afterEach(() => clear());

describe.skipIf(!enabled)(
  "@smitejs/aws against Floci",
  { sequential: true },
  () => {
    let container: Awaited<ReturnType<typeof startFloci>>;

    beforeAll(async () => {
      container = await startFloci();
      endpoint = flociEndpoint(container);
      clientConfig = { endpoint, region, credentials };
    });

    afterAll(async () => {
      await container.stop();
    });

    it("uses the full injected S3 client", async () => {
      const bucketName = "smite-floci-s3";
      const bucket = provider(
        "s3",
        { name: "FlociBucket", bucketName },
        () => new S3Client({ ...clientConfig, forcePathStyle: true }),
      );
      bucket.requirePermissions(["PutObject", "GetObject", "ListBucket"]);

      await bucket.client.send(new CreateBucketCommand({ Bucket: bucketName }));
      await bucket.client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: "hello.txt",
          Body: "hello floci",
        }),
      );
      const object = await bucket.client.send(
        new GetObjectCommand({ Bucket: bucketName, Key: "hello.txt" }),
      );
      const metadata = await bucket.client.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: "hello.txt" }),
      );
      const listed = await bucket.client.send(
        new ListObjectsV2Command({ Bucket: bucketName }),
      );

      expect(await object.Body?.transformToString()).toBe("hello floci");
      expect(metadata.ContentLength).toBe(11);
      expect(listed.Contents?.map((item) => item.Key)).toContain("hello.txt");
    });

    it("uses SSM Parameter Store", async () => {
      const parameters = provider(
        "ssm",
        { name: "FlociParameters" },
        () => new SSMClient(clientConfig),
      );
      parameters.requirePermissions(["PutParameter", "GetParameter"]);
      const name = "/smite/floci/integration";

      await parameters.client.send(
        new PutParameterCommand({
          Name: name,
          Value: "configured",
          Type: "String",
          Overwrite: true,
        }),
      );
      const result = await parameters.client.send(
        new GetParameterCommand({ Name: name }),
      );

      expect(result.Parameter?.Value).toBe("configured");
    });

    it("uses DynamoDB", async () => {
      const database = provider(
        "dynamodb",
        { name: "FlociTable" },
        () => new DynamoDBClient(clientConfig),
      );
      database.requirePermissions(["CreateTable", "PutItem", "GetItem"]);
      const tableName = "smite-floci-table";

      await database.client.send(
        new CreateTableCommand({
          TableName: tableName,
          KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
          AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
          BillingMode: "PAY_PER_REQUEST",
        }),
      );
      await database.client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: { id: { S: "one" }, value: { S: "hello" } },
        }),
      );
      const result = await database.client.send(
        new GetItemCommand({ TableName: tableName, Key: { id: { S: "one" } } }),
      );
      await database.client.send(
        new DeleteTableCommand({ TableName: tableName }),
      );

      expect(result.Item?.value?.S).toBe("hello");
    });

    it("uses SQS", async () => {
      const queue = provider(
        "sqs",
        { name: "FlociQueue" },
        () => new SQSClient(clientConfig),
      );
      queue.requirePermissions([
        "CreateQueue",
        "SendMessage",
        "ReceiveMessage",
        "DeleteMessage",
      ]);
      const queueName = "smite-floci-queue";
      const created = await queue.client.send(
        new CreateQueueCommand({ QueueName: queueName }),
      );
      const queueUrl = created.QueueUrl;
      expect(queueUrl).toBeDefined();

      await queue.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: "hello floci",
        }),
      );
      const received = await queue.client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
        }),
      );
      const message = received.Messages?.[0];
      expect(message?.Body).toBe("hello floci");
      if (message?.ReceiptHandle !== undefined) {
        await queue.client.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
      }
    });

    it("uses EventBridge", async () => {
      const events = provider(
        "eventbridge",
        { name: "FlociBus", eventBusName: "smite-floci-bus" },
        () => new EventBridgeClient(clientConfig),
      );
      events.requirePermissions(["CreateEventBus", "PutEvents"]);

      await events.client.send(
        new CreateEventBusCommand({ Name: "smite-floci-bus" }),
      );
      const result = await events.client.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: "smite-floci-bus",
              Source: "smite.integration",
              DetailType: "IntegrationEvent",
              Detail: JSON.stringify({ message: "hello floci" }),
            },
          ],
        }),
      );

      expect(result.FailedEntryCount).toBe(0);
    });
  },
);
