FROM node:24-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Generates dist/<entry>.mjs plus serverless.yml from the smite.config.ts plugins.
RUN npm run build

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/serverless.yml ./serverless.yml
EXPOSE 3000
CMD ["npx", "serverless", "offline", "start", "--host", "0.0.0.0", "--httpPort", "3000"]