export class JsonParsingError extends Error {
    constructor() {
        super("Bad JSON input");
    }
}

export function safeParseJson(input: string | null | undefined): unknown {
    if (typeof input === "string") {
        try {
            return JSON.parse(input);
        } catch {
            throw new JsonParsingError();
        }
    } else if (typeof input === "object") {
        return input;
    }
    return null;
}
