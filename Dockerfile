# -------- Base de dependencias (compila deps nativas si hiciera falta) --------
FROM node:22.10.0-alpine AS deps
WORKDIR /app
# Paquetes para compilar dependencias nativas (opcional según tu stack)
RUN apk add --no-cache python3 make g++ bash curl
COPY package.json package-lock.json* ./
RUN yarn install

# -------- Stage de desarrollo (hot reload) -----------------------------------
FROM node:22.10.0-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
# COPY openapi ./openapi
COPY src ./src
EXPOSE 3000
CMD ["npm","run","dev"]

# -------- Build de producción -------------------------------------------------
FROM node:22.10.0-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY openapi ./openapi
COPY src ./src
RUN npm run build

# -------- Runner de producción -----------------------------------------------
FROM node:22.10.0-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
# Usuario no-root
RUN addgroup -S nodegrp && adduser -S nodeusr -G nodegrp
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3000
USER nodeusr
CMD ["node","dist/main.js"]
