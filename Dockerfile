# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "dist/app.js"]