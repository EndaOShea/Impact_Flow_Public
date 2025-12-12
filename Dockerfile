# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Accept build arguments
ARG VITE_API_URL=http://localhost:2001/api

# Set as environment variable for Vite
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve to run the production build
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port 2080
EXPOSE 2080

# Serve the built application
CMD ["serve", "-s", "dist", "-l", "2080"]
