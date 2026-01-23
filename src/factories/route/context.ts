import { makeContext } from "@core/context";
import type { RequestContext } from "./type";
import type { APIGatewayProxyEvent, Handler } from "aws-lambda";

const { context, withContext } = makeContext<RequestContext>("RequestStore");

export { withContext, context };

export const defaultContextMapper: Handler<
    APIGatewayProxyEvent,
    RequestContext
> = async (event, ctx) => ({
    requestId: ctx.awsRequestId,
    rawToken: event.headers["Authorization"]?.replace("Bearer ", ""),
});
