---
title: Use AWS locally with Floci
summary: Develop and test S3, SSM, DynamoDB, SQS, and EventBridge without AWS credentials.
order: 1
---

`@smitejs/aws` records the AWS resources and permissions your application needs;
your AWS SDK client remains a normal runtime dependency. Floci gives you a
local AWS-compatible endpoint for day-to-day development and integration
tests.

## Install the pieces

Install the resource package and the SDK client for the service you use with
`npm install @smitejs/aws @aws-sdk/client-s3`. Add `@smitejs/serverless` when the
same declarations should become CloudFormation resources during deployment.

Start Floci for a local development session with `docker run --rm --name
smite-floci -p 4566:4566 floci/floci:latest`.

Set the local endpoint and test credentials in the shell that runs your app:
`export AWS_ENDPOINT_URL=http://127.0.0.1:4566`, `export
AWS_ACCESS_KEY_ID=test`, `export AWS_SECRET_ACCESS_KEY=test`, and `export
AWS_DEFAULT_REGION=us-east-1`.

## Declare a resource

Create the SDK client in the provider factory. The factory is lazy and cached,
so the client is created when the application first uses it. `requirePermissions`
declares the IAM actions that deployment should attach to the function.

@example Declare an S3 provider

Use the same pattern for `ssm`, `dynamodb`, `sqs`, and `eventbridge`. A managed
provider becomes a CloudFormation resource; an imported provider references an
export from another stack.

## Work against Floci

Run your application with `npx smite dev`. The application uses the AWS SDK
client pointed at Floci, while the Smite resource declaration remains the same
one you deploy to AWS.

For repeatable integration tests, run `yarn test:floci`. The `@smitejs/aws` test
suite starts `floci/floci:latest` through Testcontainers, exercises all five
supported services, and removes the container when the suite finishes. You do
not need to start a separate Floci container for that command.

## Deploy the same declaration

Add `serverless({ service: "orders-api" })` to `smite.config.ts`, then run `npx
smite build` and `npx smite deploy serverless`. The serverless plugin turns the
resource declarations into CloudFormation and the permission declarations into
function-scoped IAM policies.
