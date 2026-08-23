# @smitejs/snippets

Generate docs, JSDoc examples, and code from **tried-and-tested** code — the
`#section … #endsection` blocks living inside your test files.

Use `smite-snippets` (or the `@smitejs/snippets` exports) to:

- **inject** — expand `@example <Title>` JSDoc lines in declarations/sources
  with the tested snippet, rendered as a fenced ```ts block.
- **document** — expand `@example <Title>` lines in concept markdown through
  `expandMarkdown`, replacing them with placeholders you render to HTML.
- **generate** — expand `// @snippet <Title>` marker lines in template/code
  files with the tested snippet via `expandTemplate`.

`create-smite-app` uses this machinery to ship `http`/`serverless` templates
whose app code is byte-for-byte the tested snippets.

```bash
smite-snippets index packages/http/src --package @smitejs/http
smite-snippets inject packages/http/src dist --package @smitejs/http
smite-snippets template paths/to/template out --index index.json
```