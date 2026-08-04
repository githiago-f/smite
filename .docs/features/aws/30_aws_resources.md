# 30. AWS resources and explicit permissions

## Goal

Add a shared `@smitejs/aws` declaration layer for S3, SSM, DynamoDB, SQS, and
EventBridge resources. Applications receive their full injected SDK client,
while compile-time resource and permission descriptors feed deployment
adapters.

## Design

- `provider(kind, config, createClient)` declares a managed or imported resource
  and returns a lazy, cached client handle.
- `requirePermissions(resource, actions)` records explicit IAM actions. SDK
  method inspection is deliberately not used.
- Permissions are captured per compiled entry, so Serverless can create a role
  for each function instead of applying one global policy.
- `@smitejs/serverless` emits CloudFormation resources, cross-stack imports,
  outputs, and function-scoped IAM roles from the shared descriptors.
- Future Terraform and standalone CloudFormation adapters consume the same IR.

## Definition of done

- All five provider kinds map to their AWS CloudFormation resource type.
- Managed resources and imported resources are both supported.
- S3 object permissions receive an object-level ARN target.
- Runtime bundles retain the injected client path without registry dependencies.
- Focused provider, Serverless, docs, and root build checks pass.
