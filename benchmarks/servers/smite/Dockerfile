ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /repo

# The full monorepo is needed so @smite/http resolves from the workspace.
COPY package.json yarn.lock tsconfig.json tsconfig.build.json ./
COPY packages ./packages
COPY benchmarks/servers/smite/server.mjs ./bench-servers/smite-server.mjs

RUN yarn install --frozen-lockfile
RUN yarn build

# Bundle the smite server in RUNTIME mode (registry folded out), matching how
# a real app is shipped. serve() walks child refs, never the registry.
RUN npx esbuild bench-servers/smite-server.mjs \
  --bundle \
  --platform=node \
  --target=node${NODE_VERSION} \
  --format=cjs \
  --define:ALLOW_GLOBAL_REGISTRY=false \
  --outfile=/app/server.cjs

FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY --from=build /app/server.cjs ./server.cjs
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.cjs"]