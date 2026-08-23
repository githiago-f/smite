import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  collectFiles,
  collectTestSnippets,
  expandTemplate,
} from "@smitejs/snippets";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const templatesDir = path.join(rootDir, "packages", "cli", "templates");
const outputDir = path.join(rootDir, "packages", "cli", "templates-built");

const SNIPPET_SOURCES = [
  {
    packageName: "@smitejs/http",
    srcDir: path.join(rootDir, "packages", "http", "src"),
  },
  {
    packageName: "@smitejs/serverless",
    srcDir: path.join(rootDir, "packages", "serverless", "src"),
  },
];

/**
 * Collects the tested snippets backing the scaffolder templates: everything
 * tested in `@smitejs/http` and `@smitejs/serverless`.
 */
export const collectTemplateSnippets = async () => {
  const index = new Map();

  for (const source of SNIPPET_SOURCES) {
    const { snippetIndex } = await collectTestSnippets({
      packageName: source.packageName,
      rootDir,
      srcDir: source.srcDir,
    });

    for (const [title, snippet] of snippetIndex) {
      if (index.has(title)) {
        throw new Error(
          `Duplicate tested snippet "${snippet.title}" across template sources.`,
        );
      }
      index.set(title, snippet);
    }
  }

  return index;
};

/**
 * Expands `// @snippet <Title>` markers in every file under `templatesDir`
 * into `outputDir`, keeping the source tree layout. Templates build from
 * tested snippets only; unresolved markers throw.
 */
export async function buildTemplates() {
  const snippetIndex = await collectTemplateSnippets();
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const written = [];

  for (const name of await readTemplateNames()) {
    const templateDir = path.join(templatesDir, name);
    const files = await collectFiles(templateDir, () => true);

    for (const filePath of files) {
      const source = await readFile(filePath, "utf8");
      const relativePath = filePath.slice(templateDir.length + 1);
      const expanded = expandTemplate(
        source,
        snippetIndex,
        `templates/${name}`,
        relativePath,
      );
      if (expanded.includes("// @snippet")) {
        throw new Error(
          `Leftover @snippet marker in templates/${name}/${relativePath}.`,
        );
      }
      // Imports referenced only by expanded snippets are stubbed in the raw
      // templates with `biome-ignore`; once expanded those comments are stale.
      const clean = expanded
        .split("\n")
        .filter((line) => !line.includes("biome-ignore"))
        .join("\n");
      const targetPath = path.join(outputDir, name, relativePath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, clean);
      written.push(targetPath);
    }
  }

  return written;
}

const readTemplateNames = async () => {
  const entries = await readdir(templatesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const files = await buildTemplates();
  for (const filePath of files) {
    console.log(`Built ${path.relative(rootDir, filePath)}`);
  }
}
