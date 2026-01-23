export class BadContextError extends Error {
    constructor() {
        super(
            "Invalid request scope, this context is " +
                "only available after guards are processed",
        );
    }
}
