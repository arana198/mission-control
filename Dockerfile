# Production Docker build for Mission Control Next.js application
# Single-stage build for simplicity during development

FROM node:18-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy configuration files
COPY tsconfig.json ./
COPY next.config.js ./
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit --legacy-peer-deps

# Build argument for Convex URL (must be provided at build time)
ARG NEXT_PUBLIC_CONVEX_URL
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ENV NODE_ENV=production

# Copy application source
COPY . .

# Build the application
RUN npm run build

# Change ownership to nextjs user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["npm", "start"]
