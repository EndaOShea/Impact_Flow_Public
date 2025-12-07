# Docker Quick Start

This guide covers running Impact Flow with Docker, including both the **frontend** (React/Vite) and **backend** (PostgreSQL + Express API).

## Prerequisites
- Docker installed
- Docker Compose installed

## Architecture Overview

The Docker setup includes:
- **Frontend**: React app served on port 2080
- **Backend API**: Express.js server on port 2001
- **PostgreSQL Database**: PostgreSQL 14+ on port 5432 (internal)

## Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```bash
# PostgreSQL Database
DATABASE_URL=postgresql://impactflow_user:secure_password@postgres:5432/impactflow_db

# Backend API
PORT=2001
NODE_ENV=production
SESSION_SECRET=change-this-to-a-random-32-char-string
API_KEY_ENCRYPTION_SECRET=change-this-to-another-random-string

# Frontend
VITE_API_URL=http://localhost:2001/api

# Optional: User API keys (managed per-user in app)
# Users can add their own Gemini API keys via the UI
```

### 2. Database Initialization

The database will be automatically initialized with the schema on first run. To seed with test data, you can run:

```bash
docker-compose exec backend npm run seed
```

## Production

### Build and Run (Full Stack)
```bash
# Start all services (frontend + backend + database)
docker-compose up -d

# Or build fresh images first
docker-compose up -d --build
```

### View Logs
```bash
# All services
docker-compose logs -f

# Frontend only
docker-compose logs -f frontend

# Backend only
docker-compose logs -f backend

# Database only
docker-compose logs -f postgres
```

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove Volumes (⚠️ Deletes database data)
```bash
docker-compose down -v
```

### Rebuild from Scratch
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Development (Hot-Reload)

### Build and Run
```bash
# Start all services with hot-reload for frontend and backend
docker-compose -f docker-compose.dev.yml up -d

# Or rebuild and start
docker-compose -f docker-compose.dev.yml up -d --build
```

### View Logs
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Stop
```bash
docker-compose -f docker-compose.dev.yml down
```

### Restart Specific Service
```bash
# Restart backend only
docker-compose -f docker-compose.dev.yml restart backend

# Restart frontend only
docker-compose -f docker-compose.dev.yml restart frontend
```

## Access Application

- **Frontend**: http://localhost:2080
- **Backend API**: http://localhost:2001/api
- **Health Check**: http://localhost:2001/health

## Manual Docker Commands

### Frontend

#### Build Frontend Image
```bash
docker build -t impact-flow-frontend:latest .
```

#### Run Frontend Container (Standalone)
```bash
docker run -d \
  -p 2080:2080 \
  --name impact-flow-frontend \
  impact-flow-frontend:latest
```

### Backend

#### Build Backend Image
```bash
docker build -t impact-flow-backend:latest -f backend/Dockerfile ./backend
```

#### Run Backend Container (Standalone)
```bash
docker run -d \
  -p 2001:2001 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e SESSION_SECRET=your-secret \
  -e API_KEY_ENCRYPTION_SECRET=your-secret \
  --name impact-flow-backend \
  impact-flow-backend:latest
```

### PostgreSQL

#### Run PostgreSQL Container
```bash
docker run -d \
  -p 5432:5432 \
  -e POSTGRES_USER=impactflow_user \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_DB=impactflow_db \
  -v impact-flow-db-data:/var/lib/postgresql/data \
  --name impact-flow-postgres \
  postgres:14-alpine
```

#### Initialize Database Schema
```bash
# Copy schema file to container
docker cp backend/database/schema.sql impact-flow-postgres:/tmp/schema.sql

# Execute schema
docker exec -i impact-flow-postgres psql -U impactflow_user -d impactflow_db -f /tmp/schema.sql
```

## Common Operations

### Execute Backend Commands

```bash
# Access backend container shell
docker-compose exec backend sh

# Run database migrations
docker-compose exec backend npm run migrate

# Seed database with test data
docker-compose exec backend npm run seed

# View backend environment
docker-compose exec backend env
```

### Execute Database Commands

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U impactflow_user -d impactflow_db

# Backup database
docker-compose exec postgres pg_dump -U impactflow_user impactflow_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U impactflow_user -d impactflow_db < backup.sql

# View database logs
docker-compose logs postgres
```

### Execute Frontend Commands

```bash
# Access frontend container shell
docker-compose exec frontend sh

# Rebuild frontend
docker-compose exec frontend npm run build
```

## Troubleshooting

### View All Container Status
```bash
docker-compose ps
```

### Check Specific Container Logs
```bash
# Frontend logs
docker logs impact-flow-frontend

# Backend logs
docker logs impact-flow-backend

# Database logs
docker logs impact-flow-postgres
```

### Inspect Network
```bash
# List networks
docker network ls

# Inspect impact-flow network
docker network inspect impact-flow_default
```

### Remove Specific Container
```bash
docker rm -f impact-flow-frontend
docker rm -f impact-flow-backend
docker rm -f impact-flow-postgres
```

### Remove All Images
```bash
docker rmi impact-flow-frontend:latest
docker rmi impact-flow-backend:latest
```

### Clean Everything (⚠️ Removes all Docker resources)
```bash
# Stop all services
docker-compose down

# Remove all containers, networks, volumes, and images
docker-compose down -v --rmi all

# Prune system (removes all unused Docker resources)
docker system prune -a --volumes
```

### Connection Issues

#### Frontend can't connect to Backend
1. Check backend is running: `docker-compose ps backend`
2. Check backend logs: `docker-compose logs backend`
3. Verify backend health: `curl http://localhost:2001/health`
4. Check environment variable `VITE_API_URL` is set correctly

#### Backend can't connect to Database
1. Check database is running: `docker-compose ps postgres`
2. Check database logs: `docker-compose logs postgres`
3. Verify DATABASE_URL in backend environment
4. Test connection: `docker-compose exec backend psql $DATABASE_URL -c "SELECT 1"`

#### Port Already in Use
```bash
# Check what's using port 2001
lsof -i :2001

# Check what's using port 2080
lsof -i :2080

# Check what's using port 5432
lsof -i :5432

# Stop conflicting services or change ports in docker-compose.yml
```

## Performance Optimization

### Limit Resource Usage
```bash
# Edit docker-compose.yml to add resource limits
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

### View Resource Usage
```bash
docker stats
```

## Production Deployment Tips

1. **Use secrets management** for sensitive environment variables
2. **Enable HTTPS** using a reverse proxy (nginx, Caddy, Traefik)
3. **Set up backups** for PostgreSQL data volume
4. **Monitor logs** with a logging solution (ELK, Loki, CloudWatch)
5. **Use health checks** in docker-compose.yml
6. **Configure restart policies** (`restart: unless-stopped`)
7. **Run database migrations** before deploying new backend versions
