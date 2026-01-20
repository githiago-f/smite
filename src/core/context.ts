import { AsyncLocalStorage } from "node:async_hooks";

const context = new AsyncLocalStorage<ApplicationContext>();

export function withContext<T extends ApplicationContext, R = void>(
    contextData: T,
    callback: () => Promise<R>,
) {
    return context.run(contextData, callback);
}

export function getContext(): ApplicationContext | undefined {
    return context.getStore();
}
