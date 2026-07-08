import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const jsdocPackage = require("jsdoc/package.json");

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, "packages");
const outputDir = path.resolve(rootDir, process.env.DOCS_OUT ?? "dist/docs");

const main = async () => {
  const packages = await collectPackages();
  const packageDocs = await Promise.all(packages.map(buildPackageDocs));

  await rm(outputDir, { force: true, recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "styles.css"), renderStyles());
  await writeFile(path.join(outputDir, "index.html"), renderIndex(packageDocs));
  await writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(renderManifest(packageDocs), null, 2)}\n`,
  );

  for (const docs of packageDocs) {
    const packageOutDir = path.join(outputDir, docs.slug);
    await mkdir(packageOutDir, { recursive: true });
    await writeFile(
      path.join(packageOutDir, "index.html"),
      renderPackage(docs),
    );
  }
};

const collectPackages = async () => {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(packagesDir, entry.name);
    const packageJsonPath = path.join(packageDir, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

    packages.push({
      dir: packageDir,
      packageJson,
      srcDir: path.join(packageDir, "src"),
    });
  }

  return packages.sort((left, right) =>
    left.packageJson.name.localeCompare(right.packageJson.name),
  );
};

const buildPackageDocs = async (packageInfo) => {
  const sourceFiles = await collectFiles(packageInfo.srcDir, (filePath) =>
    filePath.endsWith(".ts"),
  );
  const apiFiles = sourceFiles.filter(
    (filePath) => !filePath.endsWith(".test.ts"),
  );
  const testFiles = sourceFiles.filter((filePath) =>
    filePath.endsWith(".test.ts"),
  );
  const api = [];
  const snippets = [];

  for (const filePath of apiFiles) {
    const source = await readFile(filePath, "utf8");
    api.push(...extractApiDocs(source, relativeToRoot(filePath)));
  }

  for (const filePath of testFiles) {
    const source = await readFile(filePath, "utf8");
    snippets.push(...extractSnippets(source, relativeToRoot(filePath)));
  }

  return {
    ...packageInfo,
    api,
    snippets,
    slug: slugify(packageInfo.packageJson.name),
  };
};

const collectFiles = async (directory, predicate) => {
  const entries = await readdir(directory, { withFileTypes: true });
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

const extractApiDocs = (source, filePath) => {
  const docs = [];
  const pattern =
    /\/\*\*([\s\S]*?)\*\/\s*export\s+(?:declare\s+)?(?:async\s+)?(interface|type|const|function|class)\s+([A-Za-z_$][\w$]*)/g;

  for (const match of source.matchAll(pattern)) {
    const [, block, declarationKind, name] = match;
    const comment = parseJsdocBlock(block);

    docs.push({
      declarationKind,
      description: comment.description,
      filePath,
      name,
      tags: comment.tags,
    });
  }

  return docs.sort((left, right) => left.name.localeCompare(right.name));
};

const parseJsdocBlock = (block) => {
  const lines = block
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/u, "").trimEnd());
  const description = [];
  const tags = [];

  for (const line of lines) {
    if (line.startsWith("@")) {
      const [, tag = "", text = ""] = line.match(/^@(\S+)\s*(.*)$/u) ?? [];
      tags.push({ tag, text });
      continue;
    }

    if (tags.length === 0) {
      description.push(line);
      continue;
    }

    const lastTag = tags.at(-1);
    if (lastTag && line.length > 0) {
      lastTag.text = `${lastTag.text}\n${line}`.trim();
    }
  }

  return {
    description: description.join("\n").trim(),
    tags,
  };
};

const extractSnippets = (source, filePath) => {
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

const dedent = (value) => {
  const lines = value.replace(/\s+$/u, "").split("\n");
  const indentation = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/u)?.[0].length ?? 0);
  const size = indentation.length === 0 ? 0 : Math.min(...indentation);

  return lines.map((line) => line.slice(size)).join("\n");
};

const renderManifest = (packageDocs) => ({
  generator: "smite-doc-builder",
  jsdocVersion: jsdocPackage.version,
  packages: packageDocs.map((docs) => ({
    apiCount: docs.api.length,
    name: docs.packageJson.name,
    slug: docs.slug,
    snippetCount: docs.snippets.length,
  })),
});

const renderIndex = (packageDocs) =>
  page("Smite Documentation", [
    "<section>",
    "<h1>Smite Documentation</h1>",
    `<p>Generated from JSDoc comments and tested snippets. JSDoc ${escapeHtml(
      jsdocPackage.version,
    )} is installed for the workspace.</p>`,
    '<div class="grid">',
    ...packageDocs.map(
      (docs) => `<a class="card" href="./${docs.slug}/">
        <strong>${escapeHtml(docs.packageJson.name)}</strong>
        <span>${docs.api.length} API docs</span>
        <span>${docs.snippets.length} tested snippets</span>
      </a>`,
    ),
    "</div>",
    "</section>",
  ]);

const renderPackage = (docs) =>
  page(docs.packageJson.name, [
    '<nav><a href="../">Documentation</a></nav>',
    `<h1>${escapeHtml(docs.packageJson.name)}</h1>`,
    `<p>${escapeHtml(docs.packageJson.description ?? "")}</p>`,
    "<section>",
    "<h2>API</h2>",
    docs.api.length === 0
      ? "<p>No JSDoc comments found for exported declarations.</p>"
      : docs.api.map(renderApiDoc).join("\n"),
    "</section>",
    "<section>",
    "<h2>Tested Snippets</h2>",
    docs.snippets.length === 0
      ? "<p>No tested snippets found.</p>"
      : docs.snippets.map(renderSnippet).join("\n"),
    "</section>",
  ]);

const renderApiDoc = (doc) => `<article class="doc">
  <div class="meta">${escapeHtml(doc.declarationKind)} · ${escapeHtml(
    doc.filePath,
  )}</div>
  <h3>${escapeHtml(doc.name)}</h3>
  <p>${markdownText(doc.description)}</p>
  ${renderTags(doc.tags)}
</article>`;

const renderTags = (tags) => {
  if (tags.length === 0) {
    return "";
  }

  return `<dl>${tags
    .map(
      (tag) =>
        `<dt>@${escapeHtml(tag.tag)}</dt><dd>${markdownText(tag.text)}</dd>`,
    )
    .join("")}</dl>`;
};

const renderSnippet = (snippet) => `<article class="doc">
  <div class="meta">${escapeHtml(snippet.filePath)}:${snippet.startLine}</div>
  <h3>${escapeHtml(snippet.title)}</h3>
  <pre><code>${escapeHtml(snippet.code)}</code></pre>
</article>`;

const page = (title, body) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${
      title === "Smite Documentation" ? "./" : "../"
    }styles.css">
  </head>
  <body>
    <main>
      ${body.join("\n")}
    </main>
  </body>
</html>
`;

const renderStyles = () => `:root {
  color-scheme: light;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  color: #17202a;
  background: #f7f8fa;
}

body {
  margin: 0;
}

main {
  max-width: 1040px;
  margin: 0 auto;
  padding: 48px 24px;
}

a {
  color: #0a66c2;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  font-size: 40px;
  line-height: 1.1;
}

h2 {
  margin-top: 40px;
  border-bottom: 1px solid #d7dce2;
  padding-bottom: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.card,
.doc {
  display: block;
  border: 1px solid #d7dce2;
  border-radius: 8px;
  background: #ffffff;
  padding: 20px;
  text-decoration: none;
  color: inherit;
}

.card span {
  display: block;
  color: #5a6572;
  margin-top: 8px;
}

.doc {
  margin: 16px 0;
}

.meta {
  color: #6a7480;
  font-size: 13px;
  margin-bottom: 8px;
}

pre {
  overflow-x: auto;
  background: #101820;
  color: #f3f7fb;
  padding: 16px;
  border-radius: 8px;
}

code {
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 14px;
}

dt {
  font-weight: 700;
}

dd {
  margin: 4px 0 12px;
}
`;

const markdownText = (value) =>
  escapeHtml(value)
    .replaceAll("`", "")
    .replaceAll("\n\n", "</p><p>")
    .replaceAll("\n", "<br>");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const relativeToRoot = (filePath) => path.relative(rootDir, filePath);

const slugify = (value) =>
  value
    .replace(/^@/u, "")
    .replaceAll("/", "-")
    .replace(/[^a-zA-Z0-9-]+/gu, "-")
    .toLowerCase();

await main();
