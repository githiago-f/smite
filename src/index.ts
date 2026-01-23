import { defineRoute, getRequestContext } from "@factories/route";
import { z } from "zod/v4-mini";
import { fork, isPrimary } from "node:cluster";
import { controllerBuilder } from "@factories/controller";
import { defineGuard } from "@factories/guard";
import { moduleBuilder } from "@factories/module";

const createInvoiceRoute = defineRoute({
    path: "/invoices",
    method: "POST",
    request: {
        headers: z.object({
            Authorization: z.string(),
        }),
        body: z.strictObject({
            id: z.string(),
        }),
    },
    async handler(input) {
        console.log(getRequestContext());

        return input.headers.Authorization;
    },
});

const controller = controllerBuilder("ExampleController")
    .use(createInvoiceRoute)
    .build();

const authGuard = defineGuard({
    name: "AuthGuard",
    async handler() {
        try {
            getRequestContext();
        } catch (e) {
            console.error("Error accessing request context in guard:", e);
        }
        console.log("AuthGuard: Checking authorization...");
    },
});

const exampleModule = moduleBuilder("ExampleModule")
    .with(authGuard)
    .with(controller)
    .build();

// testing for concurrent cases
if (isPrimary)
    for (let i = 0; i < 8; i++) {
        const worker = fork();
        setTimeout(() => {
            worker.kill();
        }, 300);
    }
else {
    exampleModule.data.eventHandler(
        {
            headers: {
                Authorization: "Bearer " + Math.random(),
            },
            body: '{"id": "invoice-123"}',
            httpMethod: "POST",
            requestContext: {
                resourcePath: "arn:/invoices",
            },
            path: "/invoices",
        },
        { awsRequestId: "example-request-id" } as any,
        () => {},
    );
}
