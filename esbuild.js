import * as esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["src/index.ts"],
    outfile: ".dist/out.cjs",
    bundle: true,
    minify: true,
    platform: "node",
    tsconfig: "tsconfig.json",
    target: ["node24"],
    external: ["zod*"],
    define: {},
});
