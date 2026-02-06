import { describe, expect, it } from "vitest";
import { controllerBuilder } from ".";
import { defineRoute } from "@factories/route";
import { NotFoundError } from "@factories/errors/not-found";
import { DescriptorKind } from "@core/descriptor";

describe('#controllerBuilder', () => {
    it('should return a buildable object', () => {
        const aController = controllerBuilder('AController');
        expect(aController).toHaveProperty('build');

        const described = aController.build();
        expect(described).toMatchObject({
            __key: 'AController',
            __kind: DescriptorKind.controller,
            data: {
                eventHandler: expect.any(Function),
                name: "AController",
                routes: []
            }
        });
    });

    describe('when calling .with', () => {
        it('should include every route appended', () => {
            const aController = controllerBuilder('AController')
                .with(defineRoute({ async handler() { } }))
                .with(defineRoute({ async handler() { } }))
                .build();

            expect(aController.data.routes).toHaveLength(2);
        });

        it('should mutate internal state', () => {
            const aController = controllerBuilder('AController');
            expect(aController.build().data.routes).toHaveLength(0);

            aController.with(defineRoute({
                async handler() { }
            }));

            aController.with(defineRoute({
                async handler() { }
            }));

            expect(aController.build().data.routes).toHaveLength(2);
        });
    });

    describe('when routing an event', async () => {
        it('should not accept the event if no route matches', async () => {
            const aController = controllerBuilder('aController').build();
            expect(aController).toBeDefined();
            expect(aController.data).toHaveProperty('eventHandler');

            const handle = () => aController.data.eventHandler({
                rawPath: '/',
                requestContext: { http: { method: 'get' } },
            } as any, {} as any, () => { });

            await expect(handle).rejects.toThrowError(NotFoundError);
        });

        it('should be routed to the right route', async () => {
            const aController = controllerBuilder('aController')
                .with(defineRoute({ path: '/1', handler: async () => 'incorrect' }))
                .with(defineRoute({ path: '/2', handler: async () => 'correct' }))
                .build();
            expect(aController).toBeDefined();
            expect(aController.data).toHaveProperty('eventHandler');

            const mocked = { rawPath: '/2', requestContext: { http: { method: 'get' } } };
            const promise = aController.data.eventHandler(mocked as any, {} as any, () => { });

            await expect(promise).resolves.toBe('correct');
        });

        it('ignores case in methods', async () => {
            const aController = controllerBuilder('aController')
                .with(defineRoute({ method: 'GET', handler: async () => 'correct' }))
                .build();
            expect(aController).toBeDefined();
            expect(aController.data).toHaveProperty('eventHandler');

            const mocked = { rawPath: '/', requestContext: { http: { method: 'get' } } };
            const promise = aController.data.eventHandler(mocked as any, {} as any, () => { });

            await expect(promise).resolves.toBe('correct');

            mocked.requestContext.http.method = 'GET';
            const promise2 = aController.data.eventHandler(mocked as any, {} as any, () => { });

            await expect(promise2).resolves.toBe('correct');
        });
    });
});
