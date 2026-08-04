# @smite/aws

AWS resource declarations for Smite applications.

`provider()` returns a lazy, cached client supplied by the application and
records the resource and explicit permissions in the compile-time descriptor
graph. Deployment adapters can turn the graph into managed infrastructure or
references to another CloudFormation stack.

The package does not install AWS SDK clients. Applications provide the client
factory so the full SDK client remains available for external tools and custom
commands.

The first supported providers are S3, SSM Parameter Store, DynamoDB, SQS, and
EventBridge. Use `requirePermissions` to declare the exact IAM actions needed by
each compiled function.

For a day-to-day local workflow, see
[`Use AWS locally with Floci`](./concepts/use-aws-locally-with-floci.html).
Start the emulator with `docker run --rm -p 4566:4566
floci/floci:latest`, point the AWS SDK endpoint at `http://127.0.0.1:4566`, and
run `npx smite dev`. The same package owns the repeatable suite with `yarn
test:floci`.

## Floci integration tests

The AWS integration suite uses Testcontainers to start `floci/floci:latest`,
wait for readiness, and remove the container after the tests. With Docker
available, run `yarn test:floci` from the repository root or
`yarn workspace @smite/aws test:floci` from the package workspace.
