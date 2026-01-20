declare interface User {
    name: string;
    email: string;
}

declare interface ApplicationContext {
    requestId: string;
    user?: User;
    rawToken?: string;
}
