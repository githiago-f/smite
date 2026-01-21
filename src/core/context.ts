import { AsyncLocalStorage } from "node:async_hooks";

export interface ApplicationContext {
    requestId: string;
}

export interface HttpApplicationContext<User> extends ApplicationContext {
    user?: User;
    rawToken?: string;
}

const context = new AsyncLocalStorage<ApplicationContext>();

export function withContext<T extends ApplicationContext, R = void>(
    contextData: T,
    callback: () => Promise<R>,
) {
    return context.run(contextData, callback);
}

export function getContext<T extends ApplicationContext>(): T | undefined {
    return context.getStore() as T;
}
