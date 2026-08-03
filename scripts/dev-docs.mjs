import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { collectFiles } from "./snippets.mjs";

const rootDir = process.cwd();
const outputDir = path.resolve(rootDir, process.env.DOCS_OUT ?? "dist/docs");
const sourceScript = path.join(rootDir, "scripts", "build-docs.mjs");
const watchIntervalMs = Number(process.env.DOCS_WATCH_INTERVAL_MS ?? "1000");
const port = Number(process.env.DOCS_PORT ?? "4173");
const host = process.env.DOCS_HOST ?? "127.0.0.1";

let buildInFlight = false;
let rebuildRequested = false;
let lastObservedFingerprint = "";
let lastSuccessfulFingerprint = "";

const main = async () => {
  await buildDocs(await fingerprintWatchedFiles());

  const server = http.createServer(serveDocs);
  server.on("error", (error) => {
    reportBuildError(error);
    process.exit(1);
  });
  server.listen(port, host, () => {
    process.stdout.write(`Docs available at http://${host}:${port}\n`);
  });

  const stop = async () => {
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  setInterval(() => {
    void checkForChanges();
  }, watchIntervalMs).unref();
};

const buildDocs = async (fingerprint) => {
  const nextFingerprint = fingerprint ?? (await fingerprintWatchedFiles());

  if (buildInFlight) {
    rebuildRequested = true;
    return;
  }

  buildInFlight = true;
  lastObservedFingerprint = nextFingerprint;

  try {
    await runBuildScript();
    lastSuccessfulFingerprint = nextFingerprint;
  } catch (error) {
    reportBuildError(error);
  } finally {
    buildInFlight = false;
  }

  if (rebuildRequested) {
    rebuildRequested = false;
    await buildDocs();
  }
};

const runBuildScript = async () => {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [sourceScript], {
      env: {
        ...process.env,
        DOCS_OUT: outputDir,
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`docs build exited with code ${code ?? "unknown"}`));
    });
  });
};

const checkForChanges = async () => {
  const fingerprint = await fingerprintWatchedFiles();

  if (fingerprint === lastObservedFingerprint) {
    return;
  }

  lastObservedFingerprint = fingerprint;

  if (fingerprint === lastSuccessfulFingerprint) {
    return;
  }

  await buildDocs(fingerprint);
};

const fingerprintWatchedFiles = async () => {
  const files = await collectWatchedFiles();
  const parts = [];

  for (const filePath of files) {
    const fileStats = await stat(filePath).catch(() => undefined);

    if (!fileStats?.isFile()) {
      continue;
    }

    parts.push(
      `${path.relative(rootDir, filePath)}:${fileStats.mtimeMs}:${fileStats.size}`,
    );
  }

  return parts.sort().join("|");
};

const collectWatchedFiles = async () => {
  const files = new Set([
    sourceScript,
    path.join(rootDir, "README.md"),
    path.join(rootDir, "AGENTS.md"),
    path.join(rootDir, ".docs", "architecture.md"),
    path.join(rootDir, ".docs", "harness.md"),
  ]);

  for (const filePath of await collectFiles(
    path.join(rootDir, "packages"),
    (candidate) => {
      return (
        candidate.endsWith(".ts") ||
        candidate.endsWith(".md") ||
        path.basename(candidate) === "package.json"
      );
    },
  )) {
    files.add(filePath);
  }

  return Array.from(files).sort();
};

const serveDocs = (request, response) => {
  void handleDocsRequest(request, response).catch((error) => {
    response.statusCode = 500;
    response.end(
      error instanceof Error ? error.message : "Unexpected documentation error",
    );
  });
};

const handleDocsRequest = async (request, response) => {
  const requestUrl = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? host}`,
  );
  const filePath = await resolveStaticFile(requestUrl.pathname);

  if (!filePath) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  const body = await readFile(filePath);
  response.statusCode = 200;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", contentType(filePath));
  response.end(body);
};

const resolveStaticFile = async (pathname) => {
  const normalizedPath = path
    .normalize(decodeURIComponent(pathname))
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.resolve(outputDir, `.${normalizedPath}`);

  if (!absolutePath.startsWith(outputDir)) {
    return undefined;
  }

  const stats = await stat(absolutePath).catch(() => undefined);

  if (stats?.isFile()) {
    return absolutePath;
  }

  if (stats?.isDirectory()) {
    const indexPath = path.join(absolutePath, "index.html");
    const indexStats = await stat(indexPath).catch(() => undefined);

    if (indexStats?.isFile()) {
      return indexPath;
    }
  }

  const indexPath = `${absolutePath}.html`;
  const indexStats = await stat(indexPath).catch(() => undefined);

  if (indexStats?.isFile()) {
    return indexPath;
  }

  const rootIndex = path.join(outputDir, "index.html");
  const rootStats = await stat(rootIndex).catch(() => undefined);

  if (pathname === "/" && rootStats?.isFile()) {
    return rootIndex;
  }

  return undefined;
};

const contentType = (filePath) => {
  const ext = path.extname(filePath);

  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
};

const reportBuildError = (error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
};

void main();
