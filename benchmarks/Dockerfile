FROM node:24-alpine AS build

WORKDIR /workspace

COPY package.json yarn.lock tsconfig.json tsconfig.build.json ./
COPY packages packages
COPY examples examples

RUN yarn install --frozen-lockfile
RUN yarn build

FROM node:24-alpine

WORKDIR /workspace

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/examples ./examples

EXPOSE 3000

CMD ["node", "examples/http/dist/express-server.js"]
