import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const collectFiles = async (directory, predicate) => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    },
  );
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath, predicate)));
      continue;
    }

    if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files.sort();
};

export const extractSnippets = (source, filePath) => {
  const snippets = [];
  const lines = source.split("\n");
  let current = undefined;

  lines.forEach((line, index) => {
    const section = line.match(/^\s*\/\/\s*#section\s*-\s*(.+)\s*$/u);

    if (section) {
      if (current) {
        throw new Error(
          `Nested documentation snippet in ${filePath}:${index + 1}`,
        );
      }

      current = {
        code: [],
        filePath,
        startLine: index + 1,
        title: section[1].trim(),
      };
      return;
    }

    if (/^\s*\/\/\s*#endsection\s*$/u.test(line)) {
      if (current) {
        snippets.push({
          ...current,
          code: dedent(current.code.join("\n")).trim(),
          slug: slugify(current.title),
        });
      }

      current = undefined;
      return;
    }

    if (current) {
      current.code.push(line);
    }
  });

  if (current) {
    throw new Error(
      `Unclosed documentation snippet in ${filePath}:${current.startLine}`,
    );
  }

  return snippets;
};

export const collectTestSnippets = async ({ packageName, rootDir, srcDir }) => {
  const testFiles = await collectFiles(srcDir, (filePath) =>
    filePath.endsWith(".test.ts"),
  );
  const snippets = [];

  for (const filePath of testFiles) {
    const source = await readFile(filePath, "utf8");
    snippets.push(...extractSnippets(source, path.relative(rootDir, filePath)));
  }

  return {
    snippetIndex: buildSnippetIndex(snippets, packageName),
    snippets,
  };
};

export const buildSnippetIndex = (snippets, packageName) => {
  const index = new Map();

  for (const snippet of snippets) {
    const key = normalizeExampleName(snippet.title);

    if (index.has(key)) {
      throw new Error(
        `Duplicate tested snippet "${snippet.title}" in ${packageName}.`,
      );
    }

    index.set(key, snippet);
  }

  return index;
};

export const normalizeExampleName = (value) => value.trim().toLowerCase();

export const slugify = (value) =>
  value
    .replace(/^@/u, "")
    .replaceAll("/", "-")
    .replace(/[^a-zA-Z0-9-]+/gu, "-")
    .toLowerCase();

const dedent = (value) => {
  const lines = value.replace(/\s+$/u, "").split("\n");
  const indentation = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/u)?.[0].length ?? 0);
  const size = indentation.length === 0 ? 0 : Math.min(...indentation);

  return lines.map((line) => line.slice(size)).join("\n");
};
