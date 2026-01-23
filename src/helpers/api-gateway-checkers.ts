import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";

export function isApiGatewayV1(event: unknown): event is APIGatewayProxyEvent {
    return (
        typeof event === "object" &&
        event !== null &&
        "httpMethod" in event &&
        "requestContext" in event &&
        typeof (event as any).requestContext?.resourcePath === "string"
    );
}

export function isApiGatewayV2(
    event: unknown,
): event is APIGatewayProxyEventV2 {
    return (
        typeof event === "object" &&
        event !== null &&
        "requestContext" in event &&
        typeof (event as any).requestContext?.http?.method === "string"
    );
}

export function isApiGatewayEvent(
    event: unknown,
): event is APIGatewayProxyEvent | APIGatewayProxyEventV2 {
    return isApiGatewayV1(event) || isApiGatewayV2(event);
}
