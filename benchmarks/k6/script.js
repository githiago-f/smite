import { check } from "k6";
import http from "k6/http";

const TARGET = __ENV.TARGET;
const OUT = __ENV.OUT;
const VUS = Number(__ENV.VUS || "50");
const DURATION = __ENV.DURATION || "30s";
const POST_EVERY = 5;

export const options = {
  scenarios: {
    load: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

const API_HEADERS = { "x-api-key": "local-dev" };

export default function () {
  const isCreate = __ITER % POST_EVERY === 0;

  const response = http.request(
    isCreate ? "POST" : "GET",
    `${TARGET}/users`,
    isCreate ? JSON.stringify({ name: "Lin" }) : null,
    {
      headers: isCreate
        ? { ...API_HEADERS, "content-type": "application/json" }
        : API_HEADERS,
      tags: { name: isCreate ? "POST /users" : "GET /users" },
    },
  );

  check(response, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });
}

export function handleSummary(data) {
  const duration = data.metrics.http_req_duration?.values ?? {};
  const failed = data.metrics.http_req_failed?.values ?? {};
  const requests = data.metrics.http_reqs?.values ?? {};

  return {
    [`/results/${OUT}.summary.json`]: JSON.stringify(
      {
        target: TARGET,
        completedAt: new Date().toISOString(),
        http_req_duration: duration,
        http_req_failed: failed,
        http_reqs: requests,
      },
      null,
      2,
    ),
  };
}
