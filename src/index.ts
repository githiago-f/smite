import { defineRoute, getRequestContext } from "@factories/route";
import { z } from "zod/v4-mini";
import { fork, isPrimary } from "node:cluster";

const createInvoiceRoute = defineRoute({
    route: {
        path: "/invoices",
        method: "POST",
        request: {
            pathParameters: z.strictObject({
                id: z.string(),
            }),
            headers: z.object({
                Authorization: z.string(),
            }),
            body: z.strictObject({
                i: z.string(),
            }),
        },
    },
    async handler(input) {
        console.log(getRequestContext());

        return input.headers.Authorization;
    },
});

// testing for concurrent cases
if (isPrimary)
    for (let i = 0; i < 8; i++) {
        const worker = fork();
        setTimeout(() => {
            worker.kill();
        }, 300);
    }
else {
    createInvoiceRoute.data
        .apiHandler(
            {
                body: '{ "i": "ERROR" }',
                headers: { Authorization: "aaaa" },
            } as any,
            {} as any,
        )
        .then(console.log);
}
