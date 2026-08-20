FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Prisma selects its query engine from the OpenSSL version available in the
# image. The slim Node image does not include the `openssl` executable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# GitHub Actions performs this build, so it is not constrained by Liara's
# short source-build timeout. Keep npm deterministic with the lockfile.
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . ./

# Generate the client and build the app without accessing Liara's internal DB.
RUN RUN_PRISMA_MIGRATIONS=false npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

EXPOSE 3000

# This is idempotent. It applies any pending Prisma migrations only after the
# container is inside Liara's private network, where the DB host is reachable.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
