import { makeContext } from "@core/context";
import type { RequestContext } from "./type";
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyEventV2,
    Context,
} from "aws-lambda";

const { context, withContext } = makeContext<RequestContext>("RequestStore");

export { withContext, context };

type RequestEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;

export const defaultContextMapper = async (
    event: RequestEvent,
    ctx: Context,
) => ({
    requestId: ctx.awsRequestId,
    rawToken: event.headers["Authorization"]?.replace("Bearer ", ""),
});
