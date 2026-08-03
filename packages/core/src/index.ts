export { createApp } from "./app.js";
export type { AppDescriptor } from "./app.js";

export { allowGlobalRegistry } from "./constants.js";

export {
  children,
  childrenOf,
  defineDescriptor,
  finalizeDescriptor,
  refine,
  relate,
} from "./descriptor.js";
export type { Descriptor, RelationshipDescriptor } from "./descriptor.js";

export {
  clear,
  lookup,
  lookupAll,
  register,
  relationships,
} from "./registry.js";
