import { z } from "zod/v4";
import { defineRoute, getRequestContext } from "@factories/route";
import { controllerBuilder } from "@factories/controller";
import { defineGuard } from "@factories/guard";
import { moduleBuilder } from "@factories/module";

const createInvoiceRoute = defineRoute({
    path: "/invoices",
    method: "post",
    description: "Endpoint to create a new invoice",
    request: {
        headers: z.object({
            Authorization: z.string(),
        }),
        body: z
            .strictObject({
                id: z.string().meta({
                    id: "invoice-id",
                    title: "InvoiceID",
                    description: "Unique identifier for the invoice",
                    format: "uuid",
                }),
            })
            .meta({
                format: "application/json",
                id: "create-invoice-request",
                title: "CreateInvoiceRequest",
                description: "Request to create an invoice",
            }),
    },
    async handler(input) {
        console.log(getRequestContext());

        return input.headers.Authorization;
    },
});

const controller = controllerBuilder("ExampleController")
    .with(createInvoiceRoute)
    .build();

const authGuard = defineGuard({
    name: "AuthGuard",
    async handler(event, context) {
        try {
            getRequestContext();
        } catch (e) {
            console.error("Error accessing request context in guard:", e);
        }
        console.log("AuthGuard: Checking authorization...");
        return { awsContext: context, event };
    },
});

moduleBuilder("ExampleModule").with(authGuard).with(controller).build();
