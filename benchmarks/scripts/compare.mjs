import { readFile } from "node:fs/promises";
import path from "node:path";

const resultsDir = path.resolve(process.cwd(), "benchmarks", "results");

const readSummary = async (name) => {
  const source = await readFile(
    path.join(resultsDir, `${name}.summary.json`),
    "utf8",
  );
  return JSON.parse(source);
};

const value = (values, candidates, unit = "ms") => {
  for (const key of candidates) {
    const candidate = values?.[key];

    if (typeof candidate === "number") {
      return `${candidate.toFixed(2)}${unit}`;
    }
  }

  return "-";
};

const main = async () => {
  const express = await readSummary("express");
  const smite = await readSummary("smite");
  const rows = [
    ["express", express],
    ["express + smite", smite],
  ];

  const header =
    "variant       requests/s      p50      p90      p95      p99      fails";

  console.log(header);
  console.log("-".repeat(header.length));

  for (const [name, summary] of rows) {
    const duration = summary.http_req_duration;
    const failedRate = (summary.http_req_failed?.rate ?? 0) * 100;

    console.log(
      [
        name.padEnd(14),
        String(Math.round(summary.http_reqs.rate)).padStart(11),
        value(duration, ["med", "p(50)", "p50"]).padStart(8),
        value(duration, ["p(90)", "p90"]).padStart(8),
        value(duration, ["p(95)", "p95"]).padStart(8),
        value(duration, ["p(99)", "p99"]).padStart(8),
        `${failedRate.toFixed(2)}%`.padStart(7),
      ].join("  "),
    );
  }

  const expressRate = express.http_reqs.rate;
  const smiteRate = smite.http_reqs.rate;
  const delta = ((smiteRate - expressRate) / expressRate) * 100;

  console.log(
    `\nexpress + smite: ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% requests/s vs express-only`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
