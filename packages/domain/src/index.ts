export { valueObject } from "./value-object.js";
export type {
  DomainValidationError,
  ValueObject,
  ValueObjectDescriptor,
  ValueObjectFactory,
} from "./value-object.js";

export { entity } from "./entity.js";
export type { Entity, EntityDescriptor, EntityFactory } from "./entity.js";

export { port } from "./port.js";
export type {
  PortDescriptor,
  ReadPort,
  Repository,
  WritePort,
} from "./port.js";

export { mergeSpecifications, specification } from "./specification.js";
export type {
  Specification,
  SpecificationDescriptor,
  SpecificationPredicate,
  SpecificationReason,
} from "./specification.js";

export { usecase } from "./usecase.js";
export type {
  DomainFailure,
  Usecase,
  UsecaseConfig,
  UsecaseDescriptor,
  UsecaseKind,
} from "./usecase.js";
export { command, query } from "./cqrs.js";
export { handler } from "./handler.js";
export type {
  DomainHandlerMetadata,
  HandlerContext,
  HandlerOptions,
  HandlerOutput,
} from "./handler.js";
export { domainHandlerSymbol } from "./handler.js";

export { aggregate, aggregateDescriptorSymbol } from "./aggregate.js";
export type {
  Aggregate,
  AggregateDescriptor,
  AggregateEvent,
  AggregateInstance,
  Commit,
} from "./aggregate.js";

export { projection } from "./projection.js";
export type {
  Projection,
  ProjectionConfig,
  ProjectionDescriptor,
} from "./projection.js";

import { aggregate } from "./aggregate.js";
import { command, query } from "./cqrs.js";
import { entity } from "./entity.js";
import { handler } from "./handler.js";
import { port } from "./port.js";
import { projection } from "./projection.js";
import { mergeSpecifications, specification } from "./specification.js";
import { usecase } from "./usecase.js";
import { valueObject } from "./value-object.js";

/**
 * The `@smitejs/domain` namespace: a single import for the full DDD toolkit.
 *
 * @group Surface
 */
export const domain = {
  command,
  aggregate,
  entity,
  handler,
  mergeSpecifications,
  port,
  projection,
  query,
  specification,
  usecase,
  valueObject,
};
