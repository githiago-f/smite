ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine

WORKDIR /app
COPY package.json ./
COPY server.mjs ./
RUN npm install --omit=dev --no-audit --no-fund

ENV PORT=8082
EXPOSE 8082
CMD ["node", "server.mjs"]