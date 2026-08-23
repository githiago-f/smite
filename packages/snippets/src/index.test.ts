import { describe, expect, it } from "vitest";
import {
  buildSnippetIndex,
  collectTestSnippets,
  expandExamples,
  expandMarkdown,
  expandTemplate,
  extractSnippetExpected,
  extractSnippets,
  transformExpectedToResult,
} from "./index.js";

describe("extractSnippets", () => {
  it("collects a section block with a slug and dedented code", () => {
    const source = [
      "it('works', () => {",
      "  // #section - Extract a block",
      "  const value = 1 + 1;",
      "  // #endsection",
      "});",
    ].join("\n");

    const snippets = extractSnippets(source, "fixture.test.ts");
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.title).toBe("Extract a block");
    expect(snippets[0]?.slug).toBe("extract-a-block");
    expect(snippets[0]?.code).toBe("const value = 1 + 1;");
  });

  it("throws on a nested section", () => {
    const source = [
      "// #section - A",
      "// #section - B",
      "// #endsection",
    ].join("\n");

    expect(() => extractSnippets(source, "a.test.ts")).toThrow(/Nested/u);
  });

  it("throws on an unclosed section", () => {
    const source = "// #section - A\nconst x = 1;";
    expect(() => extractSnippets(source, "a.test.ts")).toThrow(/Unclosed/u);
  });
});

describe("extractSnippetExpected", () => {
  it("reads the assertions that follow the section as expected values", () => {
    const source = [
      "  // #section - Compute a value",
      "  const value = 2 + 2;",
      "  // #endsection",
      "  expect(value).toBe(4);",
      "  expect(value).toMatchObject([4]);",
    ].join("\n");

    const snippets = extractSnippets(source, "a.test.ts");
    expect(extractSnippetExpected(source, snippets[0] as never)).toContain(
      "expect(value).toMatchObject([4]);",
    );
  });

  it("reduces expect chains to the expected results", () => {
    expect(
      transformExpectedToResult("expect(x).toBe(1); expect(y).toBe(2)"),
    ).toBe("1\n2");
  });
});

describe("collectTestSnippets", () => {
  it("builds a title index keyed on the lower-cased title", async () => {
    const { snippetIndex, snippets } = await collectTestSnippets({
      packageName: "@smitejs/snippets",
      rootDir: process.cwd(),
      srcDir: new URL("..", import.meta.url).pathname,
    });
    expect(snippets.length).toBeGreaterThan(0);
    expect(snippetIndex.has("expand @example declarations")).toBe(true);
  });

  it("rejects duplicate titles", () => {
    const snippets = [
      {
        title: "Same",
        code: "a",
        slug: "same",
        filePath: "a",
        startLine: 1,
        expected: null,
      },
      {
        title: "same",
        code: "b",
        slug: "same",
        filePath: "b",
        startLine: 1,
        expected: null,
      },
    ];

    expect(() => buildSnippetIndex(snippets, "pkg")).toThrow(/Duplicate/u);
  });
});

describe("expandExamples", () => {
  it("renders a referenced snippet into a fenced block", () => {
    const snippets = [
      {
        title: "Serve an app",
        code: "const server = serve(app);",
        slug: "serve-an-app",
        filePath: "a",
        startLine: 1,
        expected: null,
      },
    ];
    const index = buildSnippetIndex(snippets, "pkg");
    const expanded = expandExamples(
      " * @example Serve an app\n",
      index,
      "pkg",
      "index.d.ts",
    );

    expect(expanded).toContain("```ts");
    expect(expanded).toContain("const server = serve(app);");
  });

  it("throws when a referenced title is missing", () => {
    expect(() =>
      expandExamples(" * @example Nope\n", new Map(), "pkg", "x.d.ts"),
    ).toThrow(/Missing tested snippet: Nope/u);
  });
});

describe("expandTemplate", () => {
  it("replaces a // @snippet marker with the tested code", () => {
    const snippets = [
      {
        title: "Bootstrap the app",
        code: 'export const app = http.app("store");',
        slug: "bootstrap",
        filePath: "a",
        startLine: 1,
        expected: null,
      },
    ];
    const index = buildSnippetIndex(snippets, "pkg");
    const source =
      'import { http } from "@smitejs/http";\n// @snippet Bootstrap the app\n';
    const expanded = expandTemplate(source, index, "pkg", "app.ts");
    expect(expanded).toBe(
      'import { http } from "@smitejs/http";\nexport const app = http.app("store");\n',
    );
  });

  it("throws when a marker has no tested snippet", () => {
    expect(() =>
      expandTemplate("// @snippet Nobody\n", new Map(), "pkg", "a.ts"),
    ).toThrow(/Missing tested snippet: Nobody/u);
  });
});

describe("expandMarkdown", () => {
  it("replaces @example lines with placeholders and returns injectables", () => {
    const snippet = {
      title: "Bootstrap the app",
      code: 'const app = http.app("store");',
      slug: "bootstrap",
      filePath: "x",
      startLine: 1,
      expected: null,
    };
    const index = buildSnippetIndex([snippet], "pkg");
    const { body, examples } = expandMarkdown(
      "# Serving\n\n@example Bootstrap the app\n\nDone",
      index,
      "pkg",
      "concept.md",
    );

    expect(body).not.toContain("@example");
    expect(examples).toHaveLength(1);
    expect(examples[0]?.snippet.code).toBe('const app = http.app("store");');
  });
});

describe("documentation examples", () => {
  it("expands @example declarations", () => {
    // #section - Expand @example declarations
    const source = " * @example Expand @example declarations";
    const snippet = buildSnippetIndex(
      [
        {
          title: "Expand @example declarations",
          code: "x()",
          slug: "x",
          filePath: "self.test.ts",
          startLine: 1,
          expected: null,
        },
      ],
      "self",
    );
    const expanded = expandExamples(source, snippet, "self", "self.d.ts");
    // #endsection

    expect(expanded).toContain("```ts");
  });

  it("expands @snippet into a source file", () => {
    // #section - Expand @snippet into a source file
    const snippet = buildSnippetIndex([
      {
        title: "Expand @snippet into a source file",
        code: "line = 1",
        slug: "x",
        filePath: "self.test.ts",
        startLine: 1,
        expected: null,
      },
    ]);
    const expanded = expandTemplate(
      "// @snippet Expand @snippet into a source file\n",
      snippet,
      "self",
      "x.ts",
    );
    // #endsection

    expect(expanded).toContain("line = 1");
  });
});
