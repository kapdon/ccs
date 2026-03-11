# syntax=docker/dockerfile:1

# =============================================================================
# Shared Bun base for dependency resolution and builds
# =============================================================================
FROM node:20-bookworm-slim AS bun-base

SHELL ["/bin/bash", "-lc"]

# Pin bun version for reproducible builds
ARG BUN_VERSION=1.2.21
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="$BUN_INSTALL/bin:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates unzip \
  && rm -rf /var/lib/apt/lists/*

# Install specific bun version
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"

WORKDIR /app

# =============================================================================
# Build stage: compile TypeScript and build UI
# =============================================================================
FROM bun-base AS build

# Dependency install layer (avoid running install scripts inside the image build)
COPY package.json bun.lock bunfig.toml ./
COPY ui/package.json ui/bun.lock ./ui/

RUN bun install --frozen-lockfile --ignore-scripts \
  && (cd ui && bun install --frozen-lockfile --ignore-scripts)

COPY . .

RUN bun run build:all

# Validate build artifacts exist
RUN test -d dist && test -d lib && echo "[OK] Build artifacts validated"

# =============================================================================
# Production dependencies only
# =============================================================================
FROM bun-base AS prod-deps

COPY package.json bun.lock bunfig.toml ./

RUN bun install --frozen-lockfile --production --ignore-scripts

# =============================================================================
# Runtime stage: minimal production image
# =============================================================================
FROM node:20-bookworm-slim AS runtime

SHELL ["/bin/bash", "-lc"]

ENV PATH="/home/node/.opencode/bin:$PATH" \
  CCS_PORT=3000 \
  NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./

COPY docker/entrypoint.sh /usr/local/bin/ccs-entrypoint
RUN chmod +x /usr/local/bin/ccs-entrypoint

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/lib ./lib
COPY --from=build /app/config ./config
COPY --from=build /app/scripts/completion ./scripts/completion

# Install optional AI CLI tools for docker exec usage.
# Keep CCS itself local to /app to avoid duplicating the package globally.
RUN npm install -g --no-audit --no-fund @google/gemini-cli @vibe-kit/grok-cli @anthropic-ai/claude-code \
  && su -s /bin/bash node -c 'curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path' \
  && ln -sf /app/dist/ccs.js /usr/local/bin/ccs \
  && ln -sf /app/dist/ccs.js /usr/local/bin/ccsd \
  && npm cache clean --force \
  && rm -rf /root/.npm /root/.cache /home/node/.npm /home/node/.cache /tmp/*

EXPOSE 3000 8317

ENTRYPOINT ["/usr/local/bin/ccs-entrypoint"]

CMD ["bash", "-c", "node dist/ccs.js config --port ${CCS_PORT}"]
