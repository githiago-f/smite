import {
  Matcher,
  Option,
  Result,
  Task,
  TaskResult,
  chain,
  flow,
  not,
} from "@smite/fp";

const parseUserId = (request) =>
  Option.fromNullable(request?.query?.userId)
    .map(Number)
    .filter(Number.isFinite);

const loadUser = (id) =>
  Task.from(() => Promise.resolve({ id, name: `User ${id}` }));

const assignRole = (user) =>
  TaskResult.from(async () => {
    if (user.id === 0) throw new Error("zero id");
    return { ...user, role: "member" };
  });

const readToken = chain((source) =>
  Option.fromNullable(source?.headers?.["x-token"]),
);

const main = async (request) => {
  const userId = parseUserId(request).unwrapOr(0);
  const user = await loadUser(userId)
    .map((u) => ({ ...u, loaded: true }))
    .run();

  const outcome = await assignRole(user)
    .recover((error) => ({ ...user, error: String(error) }))
    .run();

  const role = Matcher.from(outcome)
    .ok((u) => u.role)
    .err((e) => e.error)
    .run();

  const isGuest = not((v) => v === "member");
  const token = readToken(request).unwrapOr("anonymous");

  return { role: isGuest(role) ? "guest" : role, token };
};

console.log(
  "admin-ish:",
  await main({ query: { userId: "7" }, headers: { "x-token": "abc" } }),
);
console.log("anonymous:", await main({ query: {}, headers: {} }));
console.log("failed:", await main({ query: { userId: "0" }, headers: {} }));

const fallback = Result.fromThrowable(
  () => JSON.parse("{bad"),
  () => "parse error",
);
console.log(
  "fromThrowable:",
  fallback.match(
    (v) => v,
    (e) => e,
  ),
);

const pipeline = flow(
  (input) => input + 1,
  (n) => n * 10,
);
console.log("flow(4):", pipeline(4));
