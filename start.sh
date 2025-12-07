#!/bin/bash

# Impact Flow - Quick Start Script
# This script helps you get the full stack (frontend + backend + database) running

set -e

echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║   Impact Flow - Full Stack Startup                   ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  IMPORTANT: Edit .env and update the secrets before production use!"
    echo ""
fi

# Ask user which environment
echo "Select environment:"
echo "1) Development (with hot-reload)"
echo "2) Production"
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "Starting DEVELOPMENT environment..."
        echo "- Frontend: http://localhost:2080 (hot-reload enabled)"
        echo "- Backend:  http://localhost:2001 (hot-reload enabled)"
        echo "- Database: PostgreSQL on port 5432"
        echo ""
        docker-compose -f docker-compose.dev.yml up -d --build
        echo ""
        echo "✅ Development environment started!"
        echo ""
        echo "View logs:        docker-compose -f docker-compose.dev.yml logs -f"
        echo "Stop services:    docker-compose -f docker-compose.dev.yml down"
        echo "Restart backend:  docker-compose -f docker-compose.dev.yml restart backend"
        echo "Seed database:    docker-compose -f docker-compose.dev.yml exec backend npm run db:seed"
        ;;
    2)
        echo ""
        echo "Starting PRODUCTION environment..."
        echo "- Frontend: http://localhost:2080"
        echo "- Backend:  http://localhost:2001"
        echo "- Database: PostgreSQL on port 5432"
        echo ""
        docker-compose up -d --build
        echo ""
        echo "✅ Production environment started!"
        echo ""
        echo "View logs:     docker-compose logs -f"
        echo "Stop services: docker-compose down"
        echo "Seed database: docker-compose exec backend npm run db:seed"
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "Waiting for services to be healthy..."
sleep 10

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║   🚀 Impact Flow is ready!                           ║"
echo "║                                                       ║"
echo "║   Frontend:  http://localhost:2080                   ║"
echo "║   Backend:   http://localhost:2001/api               ║"
echo "║   Health:    http://localhost:2001/health            ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "Default test users (password: Password123! for all):"
echo "  - admin    (Organization Owner)"
echo "  - sarah    (Standard User)"
echo "  - mike     (Standard User)"
echo "  - sysadmin (System Admin)"
echo ""
