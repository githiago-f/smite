import * as esbuild from "esbuild";
import { createWriteStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createDocument } from "zod-openapi";

globalThis.globalRegistry = new Map();

await esbuild.build({
    entryPoints: ["src/index.ts"],
    outdir: ".dist",
    entryNames: "[name]",
    outExtension: { ".js": ".cjs" },
    treeShaking: true,
    bundle: true,
    minify: true,
    platform: "node",
    tsconfig: "tsconfig.json",
    target: ["node24"],
    external: ["zod*"],
    define: { ALLOW_GLOBAL_REGISTRY: "true" },
});

const files = await readdir(".dist").then((files) =>
    files
        .filter((file) => file.endsWith(".cjs"))
        .map((file) => path.join(process.cwd(), ".dist", file)),
);

for (const file of files) {
    await import(file);
}

const descriptors = Array.from(globalRegistry.values());

function buildRequestBody(descriptor) {
    if (descriptor.data.request?.["body"])
        return {
            content: {
                "application/json": {
                    schema: descriptor.data.request?.["body"],
                },
            },
        };
}

const paths = descriptors.reduce((acc, descriptor) => {
    if (descriptor.__kind === "route") {
        acc[descriptor.data.path] = {
            [descriptor.data.method]: {
                description: descriptor.data.description,
                summary: descriptor.data.summary,
                tags: descriptor.data.tags,
                responses: descriptor.data.response,
                requestBody: buildRequestBody(descriptor),
                parameters: descriptor.data.request?.["pathParameters"],
            },
        };
    }
    return acc;
}, {});

const document = createDocument({
    openapi: "3.1.0",
    info: {
        title: "My API",
        version: new Date().toISOString().replace(/T.*/, ""),
    },
    servers: [
        {
            url: "http://localhost:{port}",
            description: "Local server",
            variables: { port: { default: "3000" } },
        },
    ],
    paths,
});

const writer = createWriteStream("openapi.json");
writer.write(JSON.stringify(document, null, 2));
writer.close();
