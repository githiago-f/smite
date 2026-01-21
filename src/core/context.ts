import { AsyncLocalStorage } from "node:async_hooks";

type CB = (...args: any[]) => Promise<any>;

export function makeContext<T>(name: string) {
    const context = new AsyncLocalStorage<T>({ name });

    return {
        context,
        withContext<F extends CB>(data: T, callback: F) {
            return context.run(data, callback);
        },
    };
}
