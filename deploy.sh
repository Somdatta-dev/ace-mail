#!/bin/bash

# Ace Mail v2 Deployment Script
# This script helps deploy the application in production

set -e

echo "🚀 Starting Ace Mail v2 Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo -e "${YELLOW}Please copy .env.example to .env and configure your settings.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running!${NC}"
    echo -e "${YELLOW}Please start Docker and try again.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Error: Docker Compose is not installed!${NC}"
    echo -e "${YELLOW}Please install Docker Compose and try again.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Pre-deployment checks passed!${NC}"

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down

# Pull latest images (if any)
echo -e "${BLUE}📥 Pulling latest images...${NC}"
docker-compose pull

# Build and start containers
echo -e "${BLUE}🏗️  Building and starting containers...${NC}"
docker-compose up -d --build

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 10

# Check if all services are running
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Check database
if docker-compose exec -T db pg_isready -U acemail_user > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database is ready${NC}"
else
    echo -e "${RED}❌ Database is not ready${NC}"
fi

# Check backend
if curl -f http://localhost:5001/api/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is ready${NC}"
else
    echo -e "${YELLOW}⚠️  Backend might still be starting...${NC}"
fi

# Check frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is ready${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend might still be starting...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed!${NC}"
echo ""
echo -e "${BLUE}📱 Access your application:${NC}"
echo -e "   Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "   Backend:  ${GREEN}http://localhost:5001${NC}"
echo ""
echo -e "${BLUE}📊 View logs:${NC}"
echo -e "   All services: ${YELLOW}docker-compose logs -f${NC}"
echo -e "   Backend only: ${YELLOW}docker-compose logs -f backend${NC}"
echo -e "   Frontend only: ${YELLOW}docker-compose logs -f frontend${NC}"
echo ""
echo -e "${BLUE}🛠️  Manage deployment:${NC}"
echo -e "   Stop services: ${YELLOW}docker-compose down${NC}"
echo -e "   Restart: ${YELLOW}docker-compose restart${NC}"
echo -e "   View status: ${YELLOW}docker-compose ps${NC}"
echo ""
echo -e "${GREEN}Happy emailing! 📧${NC}" 