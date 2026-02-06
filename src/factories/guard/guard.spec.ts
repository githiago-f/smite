import { describe, expect, it } from "vitest";
import { defineGuard } from ".";
import { DescriptorKind } from "@core/descriptor";

describe('#defineGuard', () => {
    it('should define a descriptor of kind = guard', () => {
        const emptyGuard = defineGuard({
            name: 'GuardType', handler: async () => ({}),
        });
        expect(emptyGuard.__kind).toBe(DescriptorKind.guard);
    });
});
