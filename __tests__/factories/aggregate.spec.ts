import { defineAggregate } from "@factories/aggregate";
import { AggregateValidationError } from "@factories/errors/aggregate-validation-error";
import { z } from "zod/v4-mini";

const invoiceAggregateState = z.strictObject({
    id: z.string(),
    status: z.enum(["open", "draft"]),
});

type InvoiceAggregateState = z.infer<typeof invoiceAggregateState>;

const invalidState = z.strictObject({ invalid: z.number() });

const eventSchemas = {
    InvoiceCreated: z.strictObject({}),
    InvalidState: invalidState,
};

const effectAppliers = {
    InvoiceCreated(s: InvoiceAggregateState) {
        return {
            ...s,
            status: "open" as const,
        };
    },
    InvalidState(s: InvoiceAggregateState, e: z.infer<typeof invalidState>) {
        return {
            ...s,
            unknownProperty: e.invalid,
        } as InvoiceAggregateState;
    },
};

describe("#defineAggregate", () => {
    const specification = {
        name: "Invoice",
        effectAppliers,
        events: eventSchemas,
        state: invoiceAggregateState,
    };

    it("should accept any valid specification", () => {
        expect(() => defineAggregate(specification)).not.toThrow();
    });

    it("should return a aggregate factory", () => {
        const aggregateDescriptor = defineAggregate(specification);
        expect(aggregateDescriptor).toHaveProperty("data.factory");

        const invoice = aggregateDescriptor.data.factory({
            id: "123",
            status: "draft",
        });
        expect(invoice.fold((s) => s.id)).toBe("123");
    });

    it("should apply a valid event", () => {
        const aggregateDescriptor = defineAggregate(specification);
        const invoice = aggregateDescriptor.data.factory({
            id: "123",
            status: "draft",
        });

        const newStatus = invoice
            .putEvent({ kind: "InvoiceCreated", data: {} })
            .fold((i) => i.status);

        expect(newStatus).toBe("open");
    });

    it("should not apply any invalid event", () => {
        const aggregateDescriptor = defineAggregate(specification);
        const invoice = aggregateDescriptor.data.factory({
            id: "123",
            status: "draft",
        });

        expect(() =>
            invoice.putEvent({ kind: "InvoiceCreated", invalid: "A" } as any),
        ).toThrow(AggregateValidationError);
    });

    it("should not accept bad states", () => {
        const aggregateDescriptor = defineAggregate(specification);
        const invoice = aggregateDescriptor.data.factory;

        expect(() => invoice({ id: 1 } as any)).toThrow(
            AggregateValidationError,
        );

        const validInvoice = invoice({ id: "123", status: "draft" });

        expect(() =>
            validInvoice.putEvent({
                kind: "InvalidState",
                data: { invalid: 1 },
            }),
        ).toThrow(AggregateValidationError);
    });
});
