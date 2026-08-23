import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The starter templates available to {@link createApp}.
 *
 * @group Create
 */
export type CreateTemplate = "http" | "serverless";

/**
 * Options for {@link createApp}.
 *
 * @group Create
 */
export interface CreateAppOptions {
  /** The app name; also the directory name and npm package name. */
  readonly name: string;
  /** Base directory to scaffold into. Defaults to `process.cwd()`. */
  readonly baseDir?: string;
  /** Starter template. Defaults to `"http"`. */
  readonly template?: CreateTemplate;
  /** Overwrite an existing non-empty directory. Defaults to `false`. */
  readonly force?: boolean;
}

const TEMPLATES_DIR = fileURLToPath(
  new URL("../templates-built/", import.meta.url),
);

/**
 * Lists the available starter templates (the generated directories under
 * `packages/cli/templates-built/`, built from tested snippets).
 *
 * @group Create
 * @example List the starter templates
 */
export const listTemplates = async (): Promise<readonly CreateTemplate[]> => {
  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort() as readonly CreateTemplate[];
};

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^[._-]+|[._-]+$/gu, "");
  if (slug.length === 0) {
    throw new Error(`Invalid app name '${value}'.`);
  }
  return slug;
};

const render = (source: string, name: string): string =>
  source.replaceAll("{{name}}", name).replaceAll("{{Title}}", toTitle(name));

const toTitle = (name: string): string =>
  name
    .split(/[-_.]+/u)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const collectFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(filePath)));
    } else {
      files.push(filePath);
    }
  }
  return files;
};

/**
 * Scaffolds a starter application into `<baseDir>/<name>` from the selected
 * template — a generated directory under `packages/cli/templates-built/`
 * whose sources, config, and README all come from tested snippets. Returns
 * the created directory.
 *
 * @group Create
 * @example Scaffold a new application
 */
export async function createApp(options: CreateAppOptions): Promise<string> {
  const name = slugify(options.name);
  const baseDir = resolve(options.baseDir ?? process.cwd());
  const dir = join(baseDir, name);
  const template = options.template ?? "http";
  const templateDir = join(TEMPLATES_DIR, template);

  if (!(await exists(templateDir))) {
    const available = await listTemplates();
    throw new Error(
      `Unknown template '${template}'. Available: ${available.join(", ")}.`,
    );
  }

  if ((await exists(dir)) && options.force !== true) {
    throw new Error(
      `Directory '${dir}' already exists. Pass force: true to overwrite.`,
    );
  }

  for (const filePath of await collectFiles(templateDir)) {
    const targetPath = join(dir, filePath.slice(templateDir.length + 1));
    await mkdir(dirname(targetPath), { recursive: true });
    const source = await readFile(filePath, "utf8");
    await writeFile(targetPath, render(source, name), "utf8");
  }
  return dir;
}
