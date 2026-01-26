import type { APIGatewayProxyEvent, APIGatewayProxyEventV2, Handler } from "aws-lambda";

export type APIGatewayUnion = APIGatewayProxyEvent | APIGatewayProxyEventV2;

export type HandlerParams = Parameters<Handler<APIGatewayUnion>>;

