import { configDefaults, defineConfig } from 'vitest/config';
import * as tsconfig from './tsconfig.json';
import { resolve } from 'node:path';

const root = import.meta.dirname;
const paths = tsconfig.compilerOptions.paths;

const makePathEntry = ([key, paths]: [string, string[]]) => {
    const resultKey = key.replace('/*', '');
    const path = paths.at(0)?.replace('/*', '');
    return [resultKey, resolve(root, path ?? './src')];
};

const aliases = Object.fromEntries(Object.entries(paths).map(makePathEntry))

export default defineConfig({
    resolve: {
        alias: aliases,
    },
    define: {
        ALLOW_GLOBAL_REGISTRY: 'false',
    },
    test: {
        bail: 5,
        exclude: configDefaults.exclude.concat(['.out/**', '**.js']),
        coverage: {
            enabled: true,
            reporter: ['lcov', 'text', 'json'],
        }
    }
});
