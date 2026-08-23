import { normalizeExampleName } from "./snippets.js";
import type { Snippet } from "./snippets.js";

/**
 * A placeholder/render pair produced by {@link expandMarkdownExamples}. The
 * caller scans a rendered document for each placeholder and replaces it with
 * the rendered snippet markup.
 *
 * @group Markdown
 */
export interface MarkdownInjectable {
  readonly placeholder: string;
  readonly snippet: Snippet;
}

const exampleTag = /^(\s*\*[^\S\r\n]*)@example[^\S\r\n]+([^\r\n]+?)\s*$/gmu;

/**
 * Expands every JSDoc `@example <Title>` line in a source string with the
 * matching tested snippet, rendered as a fenced code block. Throws when a
 * referenced snippet is missing. The code must not contain a closing JSDoc
 * comment sequence (asterisk followed by a slash), which would close the
 * comment early.
 *
 * @group Inline
 * @example Expand @example declarations
 */
export const expandExamples = (
  source: string,
  snippetIndex: ReadonlyMap<string, Snippet>,
  packageName: string,
  filePath: string,
): string => {
  const unresolved: string[] = [];
  const expanded = source.replace(
    exampleTag,
    (line, prefix: string, title: string) => {
      const snippet = snippetIndex.get(normalizeExampleName(title));

      if (!snippet) {
        unresolved.push(title);
        return line;
      }

      if (snippet.code.includes("*/")) {
        throw new Error(
          [
            `Cannot expand @example "${title}" in ${filePath} (${packageName}).`,
            'The snippet code contains "*/", which would close the JSDoc',
            "comment early and corrupt the emitted declaration.",
            'Rewrite the snippet to avoid "*/" (e.g. a cron schedule without',
            'a "*/" step) before releasing.',
          ].join("\n"),
        );
      }

      return renderExample(prefix, snippet.code);
    },
  );

  if (unresolved.length > 0) {
    throw new Error(
      [
        `Cannot expand @example references in ${filePath} (${packageName}).`,
        ...unresolved.map((title) => `- Missing tested snippet: ${title}`),
      ].join("\n"),
    );
  }

  return expanded;
};

/** Renders a snippet into a JSDoc fenced ```ts block with the given prefix. */
export const renderExample = (prefix: string, code: string): string =>
  [
    `${prefix}@example`,
    `${prefix}\`\`\`ts`,
    ...code.split("\n").map((line) => `${prefix}${line}`),
    `${prefix}\`\`\``,
  ].join("\n");

/**
 * Expands `// @snippet <Title>` marker lines in a template/code file by
 * replacing each with the tested snippet code. The route either keeps files
 * untouched when they carry no markers. Throws on unresolved markers.
 *
 * @group Template
 * @example Expand @snippet into a source file
 */
export const expandTemplate = (
  source: string,
  snippetIndex: ReadonlyMap<string, Snippet>,
  packageName: string,
  filePath: string,
): string => {
  const unresolved: string[] = [];

  const expanded = source.replace(
    /(\/\/\s*@snippet\s+[^\r\n]+)(?:\r?\n|$)/gu,
    (marker, markerText: string) => {
      const title = markerText.replace(/^\/\/\s*@snippet\s+/u, "").trim();
      const snippet = snippetIndex.get(normalizeExampleName(title));

      if (!snippet) {
        unresolved.push(title);
        return marker;
      }

      return `${snippet.code}\n`;
    },
  );

  if (unresolved.length > 0) {
    throw new Error(
      [
        `Cannot expand @snippet references in ${filePath} (${packageName}).`,
        ...unresolved.map((title) => `- Missing tested snippet: ${title}`),
      ].join("\n"),
    );
  }

  return expanded;
};

/**
 * Scans a concept-document markdown source for `@example <Title>` lines,
 * replacing them with placeholder lines and returning the list of injectables.
 * The caller renders the placeholders to HTML after markdown conversion so
 * code fences survive the renderer.
 *
 * @group Markdown
 */
export const expandMarkdown = (
  source: string,
  snippetIndex: ReadonlyMap<string, Snippet>,
  packageName: string,
  filePath: string,
): { body: string; examples: readonly MarkdownInjectable[] } => {
  const injectables: MarkdownInjectable[] = [];
  const scrubbed: string[] = [];

  for (const line of source.split("\n")) {
    const example = line.match(/^\s*@example\s+(.+?)\s*$/u);

    if (example) {
      const title = example[1]?.trim() ?? "";
      const snippet = snippetIndex.get(normalizeExampleName(title));

      if (!snippet) {
        throw new Error(
          `Missing tested snippet "${title}" referenced by ${filePath} (${packageName}).`,
        );
      }

      const placeholder = `SMITE_EXAMPLE_${injectables.length}`;
      injectables.push({ placeholder, snippet });
      scrubbed.push("", placeholder, "");
      continue;
    }

    scrubbed.push(line);
  }

  return { body: scrubbed.join("\n"), examples: injectables };
};
