# -------- Base de dependencias --------
FROM node:22.10.0-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ bash curl \
    && curl -fsSL https://bun.sh/install | bash \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun
COPY package.json package-lock.json* ./
RUN bun install

# -------- Stage de desarrollo (hot reload) -----------------------------------
FROM node:22.10.0-alpine AS dev
WORKDIR /app
RUN apk add --no-cache bash curl \
    && curl -fsSL https://bun.sh/install | bash \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
EXPOSE 3000
CMD ["bun","run","start:dev:bun"]

# -------- Build de producción -------------------------------------------------
FROM node:22.10.0-alpine AS build
WORKDIR /app
RUN apk add --no-cache bash curl \
    && curl -fsSL https://bun.sh/install | bash \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY openapi ./openapi
COPY src ./src
RUN bun run build

# -------- Runner de producción -----------------------------------------------
FROM node:22.10.0-alpine AS prod
WORKDIR /app
RUN apk add --no-cache bash curl \
    && curl -fsSL https://bun.sh/install | bash \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun
ENV NODE_ENV=production
RUN addgroup -S nodegrp && adduser -S nodeusr -G nodegrp
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3000
USER nodeusr
CMD ["bun","dist/main.js"]
