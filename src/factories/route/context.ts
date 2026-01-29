import { makeContext } from "@core/context";
import type { RequestContext } from "./type";

const { context, withContext } = makeContext<RequestContext>("RequestStore");

export { withContext, context };
