import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const composePath = path.join(rootDir, "benchmarks", "docker-compose.yml");
const loadScript = path.join(rootDir, "benchmarks", "k6", "load.js");
const resultsDir = path.join(rootDir, "benchmarks", "results");

const targets = [
  { name: "smite", port: 8080 },
  { name: "express", port: 8081 },
  { name: "fastify", port: 8082 },
];

const run = (command, args, options = {}) => {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    stdio: "inherit",
    ...options,
  });
};

const main = async () => {
  console.log("\nTearing down previous benchmark stack...");
  run("docker", ["compose", "-f", composePath, "down", "--remove-orphans"]);

  console.log("\nBuilding and starting benchmark servers...");
  execFileSync("docker", ["compose", "-f", composePath, "build"], {
    stdio: "inherit",
  });
  run("docker", ["compose", "-f", composePath, "up", "-d"]);

  console.log("\nWaiting for servers to become healthy...");
  for (let attempt = 0; attempt < 60; attempt++) {
    const responses = await Promise.all(
      targets.map(async ({ port }) => {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/`);
          return res.ok;
        } catch {
          return false;
        }
      }),
    );
    if (responses.every(Boolean)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await mkdir(resultsDir, { recursive: true });

  for (const target of targets) {
    const outFile = path.join(resultsDir, `${target.name}.summary.json`);
    console.log(`\nBenchmarking ${target.name} (k6 → ${outFile})...`);
    run(
      "k6",
      [
        "run",
        "--quiet",
        "-e",
        `TARGET=http://127.0.0.1:${target.port}`,
        "-e",
        `OUT=${outFile}`,
        loadScript,
      ],
      { env: { ...process.env } },
    );
  }

  console.log("\nStopping servers...");
  run("docker", ["compose", "-f", composePath, "down", "--remove-orphans"]);

  console.log("\nSummaries written to benchmarks/results/*.summary.json:");
  for (const target of targets) {
    const summary = JSON.parse(
      await readFile(
        path.join(resultsDir, `${target.name}.summary.json`),
        "utf8",
      ),
    );
    console.log(
      `  ${target.name.padEnd(8)} ${Math.round(summary.http_reqs.rate)} req/s  p50=${(
        summary.http_req_duration.med / 1000
      ).toFixed(
        2,
      )}ms  p99=${(summary.http_req_duration["p(99)"] / 1000).toFixed(2)}ms`,
    );
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
