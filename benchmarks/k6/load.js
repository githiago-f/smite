import { check } from "k6";
import http from "k6/http";

export const options = {
  scenarios: {
    routing: {
      executor: "constant-arrival-rate",
      rate: 20000,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 200,
      maxVUs: 2000,
    },
  },
  discardResponseBodies: true,
  summaryTrendStats: ["med", "p(90)", "p(95)", "p(99)"],
};

const BASE = __ENV.TARGET ?? "http://localhost:8080";

export default function () {
  const id = __ITER % 1000;
  const postId = (__ITER % 100) + 1;

  const responses = http.batch([
    { method: "GET", url: `${BASE}/` },
    { method: "GET", url: `${BASE}/users` },
    { method: "GET", url: `${BASE}/users/${id}` },
    { method: "GET", url: `${BASE}/users/${id}/posts/${postId}` },
  ]);

  for (const response of responses) {
    check(response, { "status is 200": (r) => r.status === 200 });
  }
}

export function handleSummary(data) {
  const pick = (metric, keys) => {
    const values = data.metrics[metric]?.values ?? {};
    const out = {};
    for (const key of keys) {
      if (typeof values[key] === "number") out[key] = values[key];
    }
    return out;
  };

  const summary = {
    completedAt: new Date().toISOString(),
    http_reqs: pick("http_reqs", ["rate", "count"]),
    http_req_duration: pick("http_req_duration", [
      "med",
      "p(90)",
      "p(95)",
      "p(99)",
    ]),
    http_req_failed: pick("http_req_failed", ["rate"]),
  };

  return {
    [__ENV.OUT ?? "/results/unknown.summary.json"]: JSON.stringify(
      summary,
      null,
      2,
    ),
  };
}
