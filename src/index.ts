import { getContext } from "@core/context";
import { defineController } from "@factories/controller";
import { defineUseCase } from "@factories/usecase";
import { z } from "zod/v4-mini";
import { fork, isPrimary } from "node:cluster";

const createInvoiceUseCase = defineUseCase({
    name: "CreateInvoiceUseCase",
    input: z.never(),
    output: z.string(),
    execute: async () => {
        const ctx = getContext();

        if (!ctx) return "No context";

        return ctx.user?.email;
    },
});

const invoiceController = defineController({
    auth: "user",
    name: "InvoiceController",
    useCase: createInvoiceUseCase,
    route: { path: "/invoices", method: "POST" },
});

if (isPrimary) for (let i = 0; i < 8; i++) fork();
else {
    invoiceController.data.apiHandler({}, {}).then(console.log);
}
