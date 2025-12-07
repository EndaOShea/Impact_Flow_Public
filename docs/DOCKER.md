# Docker Setup for Impact Flow Task Manager

This document explains how to run Impact Flow Task Manager using Docker.

## Port Configuration

The application runs on **port 2080** in Docker containers.

## Prerequisites

- Docker installed on your system
- Docker Compose (included with Docker Desktop)

## Quick Start

### Production Build

Run the production-optimized build:

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

Access the application at: **http://localhost:2080**

### Development Mode

Run with hot-reloading for development:

```bash
# Build and start the development container
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop the container
docker-compose -f docker-compose.dev.yml down
```

Access the application at: **http://localhost:2080**

## Environment Variables

Create a `.env` file in the project root to set environment variables:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

The Docker Compose files will automatically load this file.

## Docker Files Overview

### Production Files

- **Dockerfile**: Multi-stage build for optimized production image
  - Stage 1: Builds the application using Node.js
  - Stage 2: Serves static files using `serve` package
  - Final image size: ~150MB

- **docker-compose.yml**: Production configuration
  - Port: 2080:2080
  - Auto-restart enabled
  - Environment variables from `.env` file

### Development Files

- **Dockerfile.dev**: Development container with hot-reloading
  - Runs Vite dev server
  - Full development environment

- **docker-compose.dev.yml**: Development configuration
  - Port: 2080:2080
  - Volume mounts for source code changes
  - Hot module replacement enabled

### Support Files

- **.dockerignore**: Excludes unnecessary files from Docker builds
  - node_modules
  - dist
  - .git
  - .env files (use docker-compose env instead)

## Manual Docker Commands

If you prefer not to use Docker Compose:

### Build Production Image

```bash
docker build -t impact-flow:latest .
```

### Run Production Container

```bash
docker run -d \
  -p 2080:2080 \
  -e GEMINI_API_KEY=your_key_here \
  --name impact-flow \
  impact-flow:latest
```

### Build Development Image

```bash
docker build -t impact-flow:dev -f Dockerfile.dev .
```

### Run Development Container

```bash
docker run -d \
  -p 2080:2080 \
  -e GEMINI_API_KEY=your_key_here \
  -v $(pwd)/components:/app/components \
  -v $(pwd)/services:/app/services \
  -v $(pwd)/types.ts:/app/types.ts \
  -v $(pwd)/App.tsx:/app/App.tsx \
  -v $(pwd)/index.tsx:/app/index.tsx \
  --name impact-flow-dev \
  impact-flow:dev
```

## Useful Commands

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# Stop a container
docker stop impact-flow

# Remove a container
docker rm impact-flow

# View container logs
docker logs -f impact-flow

# Execute commands inside container
docker exec -it impact-flow sh

# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune -a
```

## Troubleshooting

### Port Already in Use

If port 2080 is already in use, you can change it in the docker-compose files:

```yaml
ports:
  - "2090:2080"  # Maps host port 2090 to container port 2080
```

### API Key Not Working

Make sure your `.env` file is in the project root and contains:
```
GEMINI_API_KEY=your_actual_api_key
```

Restart the container after adding the `.env` file:
```bash
docker-compose down
docker-compose up -d
```

### Changes Not Reflecting (Development)

If you're using development mode and changes aren't appearing:

1. Check that volumes are mounted correctly in `docker-compose.dev.yml`
2. Restart the container:
   ```bash
   docker-compose -f docker-compose.dev.yml restart
   ```

### Build Failures

Clear Docker cache and rebuild:
```bash
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

For production deployment, consider:

1. **Reverse Proxy**: Use nginx or Traefik in front of the container
2. **HTTPS**: Configure SSL certificates
3. **Environment Variables**: Use Docker secrets or a secure vault
4. **Logging**: Configure log aggregation
5. **Monitoring**: Add health checks and monitoring

Example nginx reverse proxy config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:2080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Multi-Container Setup (Future)

If you expand to use a backend database, update `docker-compose.yml`:

```yaml
version: '3.8'

services:
  impact-flow:
    build: .
    ports:
      - "2080:2080"
    depends_on:
      - postgres
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/impactflow

  postgres:
    image: postgres:15-alpine
    ports:
      - "2081:5432"
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=impactflow
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```
