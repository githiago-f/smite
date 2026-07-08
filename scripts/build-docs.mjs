import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import catppuccinMocha from "@shikijs/themes/catppuccin-mocha";
import { codeToHtml } from "shiki";
import {
  collectFiles,
  collectTestSnippets,
  normalizeExampleName,
  slugify,
} from "./snippets.mjs";

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
  await writeFile(path.join(outputDir, "index.html"), renderHome(packageDocs));
  await writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(renderManifest(packageDocs), null, 2)}\n`,
  );

  for (const docs of packageDocs) {
    await writePackageDocs(docs);
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
      conceptDir: path.join(packageDir, "docs", "concepts"),
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
  const api = [];
  const { snippetIndex, snippets } = await collectTestSnippets({
    packageName: packageInfo.packageJson.name,
    rootDir,
    srcDir: packageInfo.srcDir,
  });

  for (const filePath of apiFiles) {
    const source = await readFile(filePath, "utf8");
    api.push(
      ...extractApiDocs(
        source,
        relativeToRoot(filePath),
        snippetIndex,
        packageInfo.packageJson.name,
      ),
    );
  }

  const concepts = await collectConceptDocs(
    packageInfo.conceptDir,
    snippetIndex,
    packageInfo.packageJson.name,
  );

  return {
    ...packageInfo,
    api,
    concepts,
    snippets,
    slug: slugify(packageInfo.packageJson.name),
  };
};

const extractApiDocs = (source, filePath, snippetIndex, packageName) => {
  const docs = [];
  const pattern =
    /\/\*\*([\s\S]*?)\*\/\s*export\s+(?:declare\s+)?(?:async\s+)?(interface|type|const|function|class)\s+([A-Za-z_$][\w$]*)/g;

  for (const match of source.matchAll(pattern)) {
    const [, block, declarationKind, name] = match;
    const comment = parseJsdocBlock(block);
    const group = firstTagText(comment.tags, "group") ?? "Reference";
    const intent = firstTagText(comment.tags, "intent") ?? "";
    const examples = resolveExamples(
      comment.tags.filter((tag) => tag.tag === "example"),
      snippetIndex,
      packageName,
      `${filePath}#${name}`,
    );

    docs.push({
      declarationKind,
      description: comment.description,
      examples,
      filePath,
      group,
      intent,
      name,
      tags: comment.tags.filter(
        (tag) => !["example", "group", "intent"].includes(tag.tag),
      ),
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
      tags.push({ tag, text: text.trim() });
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

const resolveExamples = (tags, snippetIndex, packageName, context) =>
  tags.map((tag) => {
    const title = tag.text.trim();
    const snippet = snippetIndex.get(normalizeExampleName(title));

    if (!snippet) {
      throw new Error(
        `Missing tested snippet "${title}" referenced by @example in ${context} (${packageName}).`,
      );
    }

    return snippet;
  });

const collectConceptDocs = async (conceptDir, snippetIndex, packageName) => {
  const files = await collectFiles(conceptDir, (filePath) =>
    filePath.endsWith(".md"),
  );
  const concepts = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    const parsed = parseConceptDoc(source, relativeToRoot(filePath));
    const examples = [];
    const html = await renderConceptMarkdown(
      parsed.body,
      snippetIndex,
      packageName,
      parsed.filePath,
      examples,
    );

    concepts.push({
      ...parsed,
      examples,
      html,
      slug: slugify(parsed.title),
    });
  }

  return concepts.sort((left, right) => left.order - right.order);
};

const parseConceptDoc = (source, filePath) => {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/u);

  if (!frontmatter) {
    throw new Error(`Concept doc ${filePath} must start with frontmatter.`);
  }

  const [, header, body] = frontmatter;
  const metadata = {};

  for (const line of header.split("\n")) {
    const match = line.match(/^([A-Za-z][\w-]*):\s*(.+)\s*$/u);

    if (!match) {
      continue;
    }

    metadata[match[1]] = match[2];
  }

  if (!metadata.title) {
    throw new Error(`Concept doc ${filePath} must define title.`);
  }

  return {
    body: body.trim(),
    filePath,
    order: Number(metadata.order ?? "100"),
    summary: metadata.summary ?? "",
    title: metadata.title,
  };
};

const renderConceptMarkdown = async (
  source,
  snippetIndex,
  packageName,
  filePath,
  examples,
) => {
  const blocks = [];
  const lines = source.split("\n");
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) {
      return;
    }

    blocks.push(
      `<ul>${list
        .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
        .join("")}</ul>`,
    );
    list = [];
  };

  for (const line of lines) {
    const example = line.match(/^\s*@example\s+(.+?)\s*$/u);

    if (example) {
      flushParagraph();
      flushList();

      const title = example[1].trim();
      const snippet = snippetIndex.get(normalizeExampleName(title));

      if (!snippet) {
        throw new Error(
          `Missing tested snippet "${title}" referenced by ${filePath} (${packageName}).`,
        );
      }

      examples.push(snippet);
      blocks.push(await renderSnippet(snippet));
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  return blocks.join("\n");
};

const writePackageDocs = async (docs) => {
  const packageOutDir = path.join(outputDir, docs.slug);

  await mkdir(packageOutDir, { recursive: true });
  await writeFile(
    path.join(packageOutDir, "index.html"),
    renderPackageOverview(docs),
  );
  await writeFile(
    path.join(packageOutDir, "reference.html"),
    await renderReferencePage(docs),
  );

  const conceptsOutDir = path.join(packageOutDir, "concepts");
  await mkdir(conceptsOutDir, { recursive: true });

  for (const concept of docs.concepts) {
    await writeFile(
      path.join(conceptsOutDir, `${concept.slug}.html`),
      renderConceptPage(docs, concept),
    );
  }
};

const renderManifest = (packageDocs) => ({
  generator: "smite-doc-builder",
  jsdocVersion: jsdocPackage.version,
  packages: packageDocs.map((docs) => ({
    apiCount: docs.api.length,
    conceptCount: docs.concepts.length,
    name: docs.packageJson.name,
    slug: docs.slug,
    snippetCount: docs.snippets.length,
  })),
});

const renderHome = (packageDocs) =>
  layout({
    body: [
      '<section class="hero">',
      "<p>Smite Documentation</p>",
      "<h1>Intent-first APIs, documented by tested code.</h1>",
      "<p>Generated from JSDoc comments and snippets extracted from Vitest tests. Every documented example must exist between <code>#section</code> and <code>#endsection</code> in the codebase.</p>",
      "</section>",
      '<section class="grid">',
      ...packageDocs.map(
        (docs) => `<a class="card" href="./${docs.slug}/">
          <span class="eyebrow">Package</span>
          <strong>${escapeHtml(docs.packageJson.name)}</strong>
          <span>${docs.concepts.length} concepts</span>
          <span>${docs.api.length} API entries</span>
          <span>${docs.snippets.length} tested snippets</span>
        </a>`,
      ),
      "</section>",
    ],
    currentHref: "./",
    nav: {
      brandHref: "./",
      packageHref: (docs) => `./${docs.slug}/`,
    },
    packageDocs,
    stylesheetHref: "./styles.css",
    title: "Smite Documentation",
  });

const renderPackageOverview = (docs) =>
  layout({
    body: [
      `<section class="hero compact">
        <p>Package</p>
        <h1>${escapeHtml(docs.packageJson.name)}</h1>
        <p>${escapeHtml(docs.packageJson.description ?? "")}</p>
      </section>`,
      "<section>",
      "<h2>Concepts</h2>",
      '<div class="grid">',
      ...docs.concepts.map(
        (concept) => `<a class="card" href="./concepts/${concept.slug}.html">
          <span class="eyebrow">Concept</span>
          <strong>${escapeHtml(concept.title)}</strong>
          <span>${escapeHtml(concept.summary)}</span>
        </a>`,
      ),
      "</div>",
      "</section>",
      "<section>",
      "<h2>Reference</h2>",
      "<p>The reference is grouped by API intent and includes only examples resolved from tested snippets.</p>",
      `<a class="button" href="./reference.html">Open API reference</a>`,
      "</section>",
    ],
    currentHref: "./",
    backHref: "../",
    docs,
    nav: {
      brandHref: "../",
      conceptHref: (concept) => `./concepts/${concept.slug}.html`,
      packageHref: () => "./",
      referenceHref: "./reference.html",
    },
    packageDocs: [docs],
    stylesheetHref: "../styles.css",
    title: docs.packageJson.name,
  });

const renderConceptPage = (docs, concept) =>
  layout({
    body: [
      `<article class="content">
        <p class="eyebrow">Concept</p>
        <h1>${escapeHtml(concept.title)}</h1>
        <p class="lead">${escapeHtml(concept.summary)}</p>
        ${concept.html}
      </article>`,
    ],
    currentHref: `./${concept.slug}.html`,
    backHref: "../",
    docs,
    nav: {
      brandHref: "../../",
      conceptHref: (conceptItem) => `./${conceptItem.slug}.html`,
      packageHref: () => "../",
      referenceHref: "../reference.html",
    },
    packageDocs: [docs],
    stylesheetHref: "../../styles.css",
    title: `${concept.title} · ${docs.packageJson.name}`,
  });

const renderReferencePage = async (docs) => {
  const groups = groupBy(docs.api, (doc) => doc.group);

  return layout({
    body: [
      `<section class="hero compact">
        <p>API Reference</p>
        <h1>${escapeHtml(docs.packageJson.name)}</h1>
        <p>Public APIs grouped by concept and backed by tested examples.</p>
      </section>`,
      ...(await Promise.all(
        Array.from(groups.entries()).map(async ([group, apiDocs]) => {
          return `<section id="${slugify(group)}">
          <h2>${escapeHtml(group)}</h2>
          ${(await Promise.all(apiDocs.map(renderApiDoc))).join("\n")}
        </section>`;
        }),
      )),
    ],
    currentHref: "./reference.html",
    backHref: "./",
    docs,
    nav: {
      brandHref: "../",
      conceptHref: (concept) => `./concepts/${concept.slug}.html`,
      packageHref: () => "./",
      referenceHref: "./reference.html",
    },
    packageDocs: [docs],
    stylesheetHref: "../styles.css",
    title: `Reference · ${docs.packageJson.name}`,
  });
};

const renderApiDoc = async (
  doc,
) => `<article class="doc" id="${slugify(doc.name)}">
  <div class="meta">${escapeHtml(doc.declarationKind)} · ${escapeHtml(
    doc.filePath,
  )}</div>
  <h3>${escapeHtml(doc.name)}</h3>
  ${doc.intent ? `<p class="intent">${renderInlineMarkdown(doc.intent)}</p>` : ""}
  <p>${renderInlineMarkdown(doc.description)}</p>
  ${renderTags(doc.tags)}
  ${doc.examples.length > 0 ? await renderExamples(doc.examples) : ""}
</article>`;

const renderExamples = async (examples) => `<div class="examples">
  <h4>Tested examples</h4>
  ${(await Promise.all(examples.map(renderSnippet))).join("\n")}
</div>`;

const renderTags = (tags) => {
  if (tags.length === 0) {
    return "";
  }

  return `<dl>${tags
    .map(
      (tag) =>
        `<dt>@${escapeHtml(tag.tag)}</dt><dd>${renderInlineMarkdown(
          tag.text,
        )}</dd>`,
    )
    .join("")}</dl>`;
};

const renderSnippet = async (
  snippet,
) => `<figure class="snippet" id="${snippet.slug}">
  <figcaption>${escapeHtml(snippet.title)} <span>${escapeHtml(
    snippet.filePath,
  )}:${snippet.startLine}</span></figcaption>
  ${await codeToHtml(snippet.code, {
    lang: "ts",
    theme: catppuccinMocha,
  })}
</figure>`;

const layout = ({
  body,
  backHref,
  currentHref,
  docs,
  nav,
  packageDocs,
  stylesheetHref,
  title,
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${stylesheetHref}">
  </head>
  <body>
    <div class="shell">
      ${renderSidebar({ backHref, currentHref, docs, nav, packageDocs })}
      <main>
        ${body.join("\n")}
      </main>
    </div>
  </body>
</html>
`;

const renderSidebar = ({ backHref, currentHref, docs, nav, packageDocs }) => {
  const packageLinks = packageDocs.map((packageDoc) =>
    navLink(
      packageDoc.packageJson.name,
      nav.packageHref(packageDoc),
      currentHref,
    ),
  );
  const conceptLinks = docs
    ? docs.concepts.map((concept) =>
        navLink(concept.title, nav.conceptHref(concept), currentHref, "nested"),
      )
    : [];

  return `<aside class="sidebar">
    <a class="brand" href="${nav.brandHref}">Smite</a>
    ${backHref ? `<a class="back" href="${backHref}">Go back</a>` : ""}
    <nav>
      <span>Packages</span>
      ${packageLinks.join("\n")}
      ${
        docs
          ? `<span>Concepts</span>
            ${conceptLinks.join("\n")}
            <span>Reference</span>
            ${navLink("API Reference", nav.referenceHref, currentHref)}`
          : ""
      }
    </nav>
  </aside>`;
};

const navLink = (label, href, currentHref, className = "") =>
  `<a class="${href === currentHref ? "active" : ""} ${className}" href="${href}">${escapeHtml(
    label,
  )}</a>`;

const renderStyles = () => `:root {
  color-scheme: dark;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  --base: #1e1e2e;
  --mantle: #181825;
  --crust: #11111b;
  --surface-0: #313244;
  --surface-1: #45475a;
  --surface-2: #585b70;
  --overlay-0: #6c7086;
  --text: #cdd6f4;
  --subtext: #a6adc8;
  --blue: #89b4fa;
  --teal: #94e2d5;
  --green: #a6e3a1;
  --yellow: #f9e2af;
  --peach: #fab387;
  --pink: #f5c2e7;
  --mauve: #cba6f7;
  --red: #f38ba8;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(203, 166, 247, 0.08), transparent 30%),
    linear-gradient(180deg, var(--base), var(--mantle));
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: transparent;
}

a {
  color: var(--blue);
}

.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  border-right: 1px solid rgba(69, 71, 90, 0.9);
  background: rgba(17, 17, 27, 0.92);
  backdrop-filter: blur(10px);
  padding: 28px 20px;
  overflow-y: auto;
}

.brand {
  display: block;
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
  text-decoration: none;
  margin-bottom: 28px;
}

.back {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--surface-1);
  background: var(--surface-0);
  color: var(--text);
  border-radius: 999px;
  padding: 8px 14px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 20px;
}

.back:hover {
  color: var(--mauve);
  border-color: var(--mauve);
}

nav span {
  display: block;
  color: var(--overlay-0);
  font-size: 12px;
  font-weight: 700;
  margin: 22px 0 8px;
  text-transform: uppercase;
}

nav a {
  display: block;
  color: var(--text);
  text-decoration: none;
  padding: 8px 10px;
  border-radius: 8px;
  margin: 2px 0;
}

nav a.nested {
  padding-left: 18px;
}

nav a.active,
nav a:hover {
  background: var(--surface-0);
  color: var(--mauve);
}

main {
  max-width: 1040px;
  width: 100%;
  padding: 56px 48px;
}

.hero {
  max-width: 820px;
  margin-bottom: 48px;
}

.hero.compact {
  margin-bottom: 32px;
}

.hero p:first-child,
.eyebrow {
  color: var(--overlay-0);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2,
h3,
h4,
p {
  margin-top: 0;
}

h1 {
  font-size: 44px;
  line-height: 1.08;
  margin-bottom: 16px;
}

h2 {
  margin-top: 44px;
  border-bottom: 1px solid var(--surface-1);
  padding-bottom: 10px;
}

h3 {
  margin-bottom: 8px;
}

.lead,
.hero p {
  color: var(--subtext);
  font-size: 18px;
  line-height: 1.6;
}

.content {
  max-width: 840px;
}

.content p,
.content li {
  color: var(--text);
  line-height: 1.7;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.card,
.doc {
  display: block;
  border: 1px solid var(--surface-1);
  border-radius: 8px;
  background: rgba(49, 50, 68, 0.7);
  padding: 20px;
  text-decoration: none;
  color: inherit;
}

.card strong {
  display: block;
  font-size: 19px;
  margin: 8px 0;
}

.card span {
  display: block;
  color: var(--subtext);
  margin-top: 6px;
}

.button {
  display: inline-block;
  border-radius: 8px;
  background: var(--mauve);
  color: var(--crust);
  padding: 10px 14px;
  text-decoration: none;
  font-weight: 700;
}

.doc {
  margin: 16px 0;
}

.intent {
  border-left: 3px solid var(--teal);
  padding-left: 12px;
  color: var(--text);
}

.meta,
figcaption span {
  color: var(--overlay-0);
  font-size: 13px;
}

.snippet {
  margin: 18px 0;
}

figcaption {
  color: var(--text);
  font-weight: 700;
  margin-bottom: 8px;
}

pre,
pre.shiki {
  overflow-x: auto;
  background: var(--crust) !important;
  border: 1px solid var(--surface-1);
  padding: 16px;
  border-radius: 8px;
  margin: 0;
}

pre.shiki code {
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 14px;
  line-height: 1.7;
}

code:not(pre code) {
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.95em;
  background: rgba(69, 71, 90, 0.65);
  color: var(--peach);
  border-radius: 6px;
  padding: 0.15rem 0.35rem;
}

dt {
  font-weight: 700;
}

dd {
  margin: 4px 0 12px;
}

@media (max-width: 760px) {
  .shell {
    display: block;
  }

  .sidebar {
    position: static;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--surface-1);
  }

  main {
    padding: 32px 20px;
  }

  h1 {
    font-size: 34px;
  }
}
`;

const groupBy = (values, key) => {
  const groups = new Map();

  for (const value of values) {
    const group = key(value);
    const current = groups.get(group) ?? [];
    current.push(value);
    groups.set(group, current);
  }

  return groups;
};

const firstTagText = (tags, name) =>
  tags.find((tag) => tag.tag === name)?.text.trim();

const renderInlineMarkdown = (value) =>
  escapeHtml(value)
    .replace(/`([^`]+)`/gu, "<code>$1</code>")
    .replaceAll("\n\n", "</p><p>")
    .replaceAll("\n", "<br>");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const relativeToRoot = (filePath) => path.relative(rootDir, filePath);

await main();
