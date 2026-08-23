export {
  buildSnippetIndex,
  collectFiles,
  collectTestSnippets,
  extractSnippetExpected,
  extractSnippets,
  normalizeExampleName,
  slugify,
  transformExpectedToResult,
} from "./snippets.js";
export type { Snippet } from "./snippets.js";
export {
  expandExamples,
  expandMarkdown,
  expandTemplate,
  renderExample,
} from "./expand.js";
export type { MarkdownInjectable } from "./expand.js";
export { injectIntoFiles } from "./inject.js";
