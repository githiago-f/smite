import { getContext, type HttpApplicationContext } from "@core/context";
import { defineController } from "@factories/controller";
import { defineUseCase } from "@factories/usecase";
import { z } from "zod/v4-mini";
import { fork, isPrimary } from "node:cluster";

const createInvoiceUseCase = defineUseCase({
    name: "CreateInvoiceUseCase",
    execute: async () => {
        const ctx = getContext<HttpApplicationContext<{ email: string }>>();
        if (!ctx) return "No context";

        console.log(ctx.requestId);

        return ctx.user?.email ?? "No email";
    },
});

const invoiceController = defineController({
    name: "InvoiceController",
    route: {
        path: "/invoices",
        method: "POST",
        request: z.never(),
    },
});

if (isPrimary)
    for (let i = 0; i < 8; i++) {
        const worker = fork();
        setTimeout(() => {
            worker.kill();
        }, 300);
    }
else {
    // testing for concurrent cases
    invoiceController.data.apiHandler({}, {}).then(console.log);
}
