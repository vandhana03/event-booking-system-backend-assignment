# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ─── Stage 2: Production image ──────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Copy only production node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# Don't run as root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "app.js"]
