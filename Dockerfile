# ==============================================================================
#  NDAW WUNE — Admin Dashboard Next.js 15 (standalone)
#  Build multi-stage : deps → builder → runner
# ==============================================================================

# ── Stage 1 : Installation des dépendances ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2 : Build de production ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copier node_modules du stage précédent
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* sont des variables BUILD-TIME — elles sont injectées ici,
# dans le bundle JavaScript, pas au runtime.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_ORIGIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_ORIGIN=$NEXT_PUBLIC_APP_ORIGIN

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3 : Image de production minimale ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root (bonne pratique de sécurité)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copier uniquement le strict nécessaire depuis le stage builder
# .next/standalone/ : le serveur Node.js autonome + ses dépendances
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# .next/static/ → là où server.js les cherche (./.next/static/)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# public/ → là où server.js les cherche (./public/)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Healthcheck : Next.js répond sur / (même si c'est une redirection)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
