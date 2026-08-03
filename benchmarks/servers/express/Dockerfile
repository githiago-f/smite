ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine

WORKDIR /app
COPY package.json ./
COPY server.mjs ./
RUN npm install --omit=dev --no-audit --no-fund

ENV PORT=8081
EXPOSE 8081
CMD ["node", "server.mjs"]