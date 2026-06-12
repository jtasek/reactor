# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-alpine AS builder

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /app

# Install dependencies first to maximize layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Build the production bundle into /app/dist.
COPY . .
RUN pnpm build

# ---------- Production dependencies stage ----------
FROM node:22-alpine AS deps

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts

# ---------- Runtime stage ----------
FROM node:22-alpine AS runner

ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0

WORKDIR /app

# Runtime needs only production deps, the built bundle, static assets and the server.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node static ./static
COPY --chown=node:node server.prod.js package.json ./

# Drop privileges; the app never writes to disk so the FS can be mounted read-only.
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.prod.js"]
