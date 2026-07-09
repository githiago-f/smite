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

const endsectionPattern = /^\s*\/\/\s*#endsection\s*$/u;

export const extractSnippetExpected = (testSource, snippet) => {
  const lines = testSource.split("\n");
  const sectionLine = lines.findIndex(
    (line, idx) =>
      idx >= snippet.startLine - 1 && endsectionPattern.test(line),
  );

  if (sectionLine === -1) {
    return null;
  }

  const expectedLines = [];
  const sectionIndent = lines[sectionLine]?.match(/^\s*/u)?.[0] ?? "";
  let i = sectionLine + 1;

  for (; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().length === 0) {
      continue;
    }

    const lineIndent = line.match(/^\s*/u)?.[0] ?? "";

    if (lineIndent.length < sectionIndent.length) {
      break;
    }

    expectedLines.push(line);
  }

  if (expectedLines.length === 0) {
    return null;
  }

  const code = dedent(expectedLines.join("\n")).trim();
  return code.length > 0 ? code : null;
};

export const collectTestSnippets = async ({ packageName, rootDir, srcDir }) => {
  const testFiles = await collectFiles(srcDir, (filePath) =>
    filePath.endsWith(".test.ts"),
  );
  const snippets = [];

  for (const filePath of testFiles) {
    const source = await readFile(filePath, "utf8");
    const relativePath = path.relative(rootDir, filePath);
    const extracted = extractSnippets(source, relativePath);

    for (const snippet of extracted) {
      const raw = extractSnippetExpected(source, snippet);
      snippet.expected = raw ? transformExpectedToResult(raw) : null;
    }

    snippets.push(...extracted);
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

const findMatchingCloseParen = (code, openIndex) => {
  let depth = 1;

  for (let i = openIndex + 1; i < code.length; i++) {
    if (code[i] === "(") {
      depth++;
    } else if (code[i] === ")") {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
};

export const transformExpectedToResult = (code) => {
  const results = [];
  let idx = 0;

  while (idx < code.length) {
    const expectIdx = code.indexOf("expect(", idx);

    if (expectIdx === -1) {
      break;
    }

    const expectOpen = expectIdx + 6;
    const expectClose = findMatchingCloseParen(code, expectOpen);

    if (expectClose === -1) {
      break;
    }

    const matcherOpen = code.indexOf("(", expectClose + 1);

    if (matcherOpen === -1) {
      break;
    }

    const matcherClose = findMatchingCloseParen(code, matcherOpen);

    if (matcherClose === -1) {
      break;
    }

    results.push(code.slice(matcherOpen + 1, matcherClose).trim());
    idx = matcherClose + 1;
  }

  return results.length > 0 ? results.join("\n") : code;
};

const dedent = (value) => {
  const lines = value.replace(/\s+$/u, "").split("\n");
  const indentation = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/u)?.[0].length ?? 0);
  const size = indentation.length === 0 ? 0 : Math.min(...indentation);

  return lines.map((line) => line.slice(size)).join("\n");
};
