import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * A tested documentation snippet extracted from a `#section ... #endsection`
 * block. The snippet code is exercised by the test file it lives in, so it is
 * safe to publish into docs, JSDoc declarations, or generated code.
 *
 * @group Snippets
 */
export interface Snippet {
  /** The tested code between `#section` and `#endsection`, dedented. */
  readonly code: string;
  /** Absolute or root-relative path of the test file hosting the block. */
  readonly filePath: string;
  /** 1-based line of the `#section` marker. */
  readonly startLine: number;
  /** The human-readable title from the `#section` marker. */
  readonly title: string;
  /** URL-safe slug derived from {@link Snippet.title}. */
  readonly slug: string;
  /** The expected-value lines extracted from the assertions that follow. */
  readonly expected: string | null;
}

/** A folder of files matching a predicate, sorted by path. */
export const collectFiles = async (
  directory: string,
  predicate: (filePath: string) => boolean,
): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }

      throw error;
    },
  );
  const files: string[] = [];

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

const sectionPattern = /^\s*\/\/\s*#section\s*-\s*(.+)\s*$/u;
const endsectionPattern = /^\s*\/\/\s*#endsection\s*$/u;

/**
 * Extracts every `#section ... #endsection` snippet from a test source. Nested
 * or unclosed sections throw.
 *
 * @group Snippets
 */
export const extractSnippets = (
  source: string,
  filePath: string,
): readonly Snippet[] => {
  const snippets: Snippet[] = [];
  const lines = source.split("\n");
  let current:
    | {
        code: string[];
        filePath: string;
        startLine: number;
        title: string;
      }
    | undefined;

  lines.forEach((line, index) => {
    const section = line.match(sectionPattern);

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
        title: section[1]?.trim() ?? "",
      };
      return;
    }

    if (endsectionPattern.test(line)) {
      if (current) {
        snippets.push({
          ...current,
          code: dedent(current.code.join("\n")).trim(),
          expected: null,
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

/**
 * Extracts the expected-result lines that immediately follow a snippet's
 * `#endsection` marker (the assertions testing it), as plain code. Returns
 * `null` when there is nothing to show.
 *
 * @group Snippets
 */
export const extractSnippetExpected = (
  testSource: string,
  snippet: Snippet,
): string | null => {
  const lines = testSource.split("\n");
  const sectionLine = lines.findIndex(
    (line, idx) => idx >= snippet.startLine - 1 && endsectionPattern.test(line),
  );

  if (sectionLine === -1) {
    return null;
  }

  const expectedLines: string[] = [];
  const sectionIndent = lines[sectionLine]?.match(/^\s*/u)?.[0] ?? "";
  let i = sectionLine + 1;

  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";

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

/**
 * Collects every tested snippet from the `*.test.ts` files under `srcDir`,
 * returning both the flat list and a title index. Duplicate titles throw.
 *
 * @group Snippets
 */
export const collectTestSnippets = async (input: {
  readonly packageName: string;
  readonly rootDir: string;
  readonly srcDir: string;
}): Promise<{
  snippetIndex: ReadonlyMap<string, Snippet>;
  snippets: readonly Snippet[];
}> => {
  const testFiles = await collectFiles(input.srcDir, (filePath) =>
    filePath.endsWith(".test.ts"),
  );
  const snippets: Snippet[] = [];

  for (const filePath of testFiles) {
    const source = await readFile(filePath, "utf8");
    const relativePath = path.relative(input.rootDir, filePath);
    const extracted = extractSnippets(source, relativePath);

    for (const snippet of extracted) {
      const raw = extractSnippetExpected(source, snippet);
      snippets.push({
        ...snippet,
        expected: raw ? transformExpectedToResult(raw) : null,
      });
    }
  }

  return {
    snippetIndex: buildSnippetIndex(snippets, input.packageName),
    snippets,
  };
};

/**
 * Builds the title → snippet index, throwing on duplicate or empty titles.
 *
 * @group Snippets
 */
export const buildSnippetIndex = (
  snippets: readonly Snippet[],
  packageName: string,
): ReadonlyMap<string, Snippet> => {
  const index = new Map<string, Snippet>();

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

/** Normalizes a snippet title into its lookup key. */
export const normalizeExampleName = (value: string): string =>
  value.trim().toLowerCase();

/** Converts a snippet title into a URL-safe slug. */
export const slugify = (value: string): string =>
  value
    .replace(/^@/u, "")
    .replaceAll("/", "-")
    .replace(/[^a-zA-Z0-9-]+/gu, "-")
    .toLowerCase();

const findMatchingCloseParen = (code: string, openIndex: number): number => {
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

/**
 * Reduces a block of `expect(...).toBe(...)` assertions into just the expected
 * values. Falls back to the raw code when no `expect` calls are present.
 */
export const transformExpectedToResult = (code: string): string => {
  const results: string[] = [];
  let idx = 0;

  while (idx < code.length) {
    const expectIdx = code.indexOf("expect(", idx);

    if (expectIdx === -1) {
      break;
    }

    const expectOpen = expectIdx + "expect(".length;
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

    const value = code.slice(matcherOpen + 1, matcherClose).trim();
    results.push(value);
    idx = matcherClose + 1;
  }

  return results.length > 0 ? results.join("\n") : code;
};

const dedent = (value: string): string => {
  const lines = value.replace(/\s+$/u, "").split("\n");
  const indentation = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/u)?.[0].length ?? 0);
  const size = indentation.length === 0 ? 0 : Math.min(...indentation);

  return lines.map((line) => line.slice(size)).join("\n");
};
