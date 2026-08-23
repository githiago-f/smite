FROM node:24-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Bundle the runtime server with the global registry folded out.
RUN npx esbuild src/server.ts \
  --bundle \
  --platform=node \
  --target=node24 \
  --format=cjs \
  --define:ALLOW_GLOBAL_REGISTRY=false \
  --outfile=dist/server.cjs

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/server.cjs ./server.cjs
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.cjs"]