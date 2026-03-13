###########################
#     BASE CONTAINER      #
###########################
FROM node:22-alpine3.20 AS base

RUN apk add --no-cache openssl
RUN apk add --no-cache font-freefont
# Chromium para generar certificados PDF con Playwright
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates
RUN apk add --no-cache ghostscript

###########################
#    BUILDER CONTAINER    #
###########################
FROM base AS builder

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
RUN apk add --no-cache jq
WORKDIR /app

COPY . .

RUN npm install -g "turbo@^1.9.3"

# Outputs to the /out folder
# source: https://turbo.build/repo/docs/reference/command-line-reference/prune#--docker
RUN turbo prune --scope=@documenso/remix --docker

###########################
#   INSTALLER CONTAINER   #
###########################
FROM base AS installer

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
RUN apk add --no-cache jq
# Required for node_modules/aws-crt
RUN apk add --no-cache make cmake g++ openssl bash

WORKDIR /app

# Disable husky from installing hooks
ENV HUSKY 0
ENV DOCKER_OUTPUT 1

# Encryption keys
ARG NEXT_PRIVATE_ENCRYPTION_KEY="CAFEBABE"
ENV NEXT_PRIVATE_ENCRYPTION_KEY="$NEXT_PRIVATE_ENCRYPTION_KEY"

ARG NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="DEADBEEF"
ENV NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="$NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY"



# Uncomment and use build args to enable remote caching
# ARG TURBO_TEAM
# ENV TURBO_TEAM=$TURBO_TEAM
# ARG TURBO_TOKEN
# ENV TURBO_TOKEN=$TURBO_TOKEN

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json

COPY --from=builder /app/lingui.config.ts ./lingui.config.ts
COPY --from=builder /app/patches ./patches

RUN npm ci --legacy-peer-deps

# Install musl-specific binary for Alpine Linux (lockfile is generated on GNU Linux)
RUN npm install @documenso/pdf-sign-linux-x64-musl@0.1.0 --no-save --legacy-peer-deps

# Then copy all the source code (as it changes more often)
COPY --from=builder /app/out/full/ .
# Copy scripts folder (not included in turbo prune output)
COPY --from=builder /app/scripts ./scripts
# Finally copy the turbo.json file so that we can run turbo commands
COPY turbo.json turbo.json

RUN npm install -g "turbo@^1.9.3"

RUN turbo run build --filter=@documenso/remix...

###########################
#     RUNNER CONTAINER    #
###########################
FROM base AS runner

ENV HUSKY 0
ENV DOCKER_OUTPUT 1
# Configurar Playwright para usar chromium del sistema
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

USER nodejs

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/out/json/ .
# Copy the tailwind config files across
COPY --from=builder --chown=nodejs:nodejs /app/out/full/packages/tailwind-config ./packages/tailwind-config
# Copy the patches across
COPY --from=builder --chown=nodejs:nodejs /app/patches ./patches

RUN npm ci --only=production --legacy-peer-deps

# Copy node_modules from installer to ensure all runtime dependencies are available
# The build artifacts may reference modules that need to be available at runtime
COPY --from=installer --chown=nodejs:nodejs /app/node_modules ./node_modules

# Automatically leverage output traces to reduce image size
# https://nodejs.org/docs/advanced-features/output-file-tracing
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/build ./apps/remix/build
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/public ./apps/remix/public

# Copy the full prisma package (schema, migrations, seed files, etc.)
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma ./packages/prisma

# Copy workspace packages required by the seed script (they use TypeScript source directly)
COPY --from=installer --chown=nodejs:nodejs /app/packages/lib ./packages/lib
COPY --from=installer --chown=nodejs:nodejs /app/packages/assets ./packages/assets
COPY --from=installer --chown=nodejs:nodejs /app/packages/email ./packages/email
COPY --from=installer --chown=nodejs:nodejs /app/packages/signing ./packages/signing

# Copy scripts folder for migrations
COPY --from=installer --chown=nodejs:nodejs /app/scripts ./scripts

# Generate the prisma client again
RUN npx prisma generate --schema ./packages/prisma/schema.prisma


# Get the start script from deployment/
COPY --chown=nodejs:nodejs ./deployment/start.sh /app/apps/remix/start.sh
# Get the migrations script from deployment/
COPY --chown=nodejs:nodejs ./deployment/run-migrations.sh /app/run-migrations.sh

WORKDIR /app/apps/remix

CMD ["sh", "start.sh"]
