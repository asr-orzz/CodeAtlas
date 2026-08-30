# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# CodeAtlas — single-image build.
# Builds the web app and serves it from the API on one port (4000).
# ---------------------------------------------------------------------------

# 1. Build stage: install deps and build the web bundle.
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install workspace dependencies first (better layer caching).
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
COPY tsconfig.base.json tsconfig.json ./

RUN npm ci

# Build the web app with a relative API URL so it talks to this same origin.
ENV VITE_API_URL=""
RUN npm run build

# ---------------------------------------------------------------------------
# 2. Runtime stage: git is required for GitHub repo import (shallow clone only).
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Bring over installed deps, source and the built web assets.
COPY --from=build /app ./

ENV NODE_ENV=production \
    ARCHX_PORT=4000 \
    ARCHX_DATA_DIR=/data \
    ARCHX_WEB_DIR=/app/apps/web/dist \
    ARCHX_CORS_ORIGIN=*

# Persist analyzed projects and saved boards outside the container.
VOLUME ["/data"]
EXPOSE 4000

# The API (tsx) also serves the built web app at "/".
CMD ["npm", "run", "start", "--workspace", "@archx/api"]
