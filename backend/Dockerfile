# Production Dockerfile for Impact Flow Backend
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose backend port
EXPOSE 2001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:2001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "src/server.js"]
