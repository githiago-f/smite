import { makeContext } from "@core/context";
import type { Handler, RequestContext } from "./type";

const { context, withContext } = makeContext<RequestContext>("RequestStore");

export { withContext, context };

export const defaultContextMapper: Handler<RequestContext> = async (
    event,
    ctx,
) => ({
    requestId: ctx.awsRequestId,
    rawToken: event.headers["Authorization"]?.replace("Bearer ", ""),
});
