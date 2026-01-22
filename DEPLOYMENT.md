# Production Deployment Checklist

## Pre-Deployment

### Security
- [ ] Generate strong JWT secret: `openssl rand -base64 64`
- [ ] Set strong database password
- [ ] Review and update CORS_ORIGIN to your production domain
- [ ] Enable HTTPS/TLS for all endpoints
- [ ] Review rate limiting settings
- [ ] Remove all console.logs from production code (optional)
- [ ] Set NODE_ENV=production

### Environment Variables
- [ ] Copy `.env.production.example` to `.env`
- [ ] Fill in all `CHANGE_ME` values
- [ ] Update API_BASE_URL to production domain
- [ ] Update WS_URL to production WebSocket URL
- [ ] Verify DATABASE_URL points to production database
- [ ] Verify REDIS_URL points to production Redis

### Database
- [ ] Run migrations: `bun run migrate:deploy`
- [ ] Seed initial data if needed
- [ ] Set up database backups
- [ ] Configure connection pooling limits
- [ ] Test database connectivity

### Infrastructure
- [ ] Start Docker services: `docker-compose up -d`
- [ ] Verify PostgreSQL is running: `docker ps`
- [ ] Verify Redis is running: `docker ps`
- [ ] Check service health: `docker-compose ps`

## Build & Deploy

### Build
- [ ] Install dependencies: `bun install`
- [ ] Build all packages: `bun run build`
- [ ] Run all tests: `bun run test:all`
- [ ] Fix any test failures

### Deploy
- [ ] Deploy API server (port 3000)
- [ ] Deploy WebSocket server (port 3001)
- [ ] Deploy Frontend (port 3002)
- [ ] Start Price Ingestion Worker
- [ ] Start Candle Aggregation Worker

### Verify Deployment
- [ ] API health check: `curl https://api.yourdomain.com/health`
- [ ] WebSocket connection test
- [ ] Frontend loads successfully
- [ ] Price updates are coming through
- [ ] Candles are being stored
- [ ] Orders can be placed and executed

## Post-Deployment

### Monitoring
- [ ] Set up logging aggregation (optional)
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Monitor API response times
- [ ] Monitor WebSocket connections
- [ ] Monitor database performance
- [ ] Monitor Redis memory usage

### Backup & Recovery
- [ ] Schedule daily database backups
- [ ] Test database restore procedure
- [ ] Document rollback procedure

### Documentation
- [ ] Update README with production URLs
- [ ] Document deployment process
- [ ] Document environment variables
- [ ] Create runbook for common issues

## Production Commands

```bash
# Start infrastructure
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Run migrations
bun run migrate:deploy

# Build all packages
bun run build

# Start all services (development)
bun run dev

# Start individual services
bun run dev:api
bun run dev:ws
bun run dev:web
bun run dev:price
bun run dev:candle

# Run tests
bun run test
bun run test:web
bun run test:all

# Stop infrastructure
docker-compose down

# Stop and remove volumes (⚠️ DESTRUCTIVE)
docker-compose down -v
```

## Rollback Plan

If deployment fails:

1. Revert to previous Docker image/commit
2. Restart services: `docker-compose restart`
3. Check logs: `docker-compose logs -f`
4. Verify database migration state
5. Notify team

## Security Hardening

- [ ] Implement rate limiting on all API endpoints
- [ ] Add request size limits
- [ ] Enable Helmet.js security headers
- [ ] Set up DDoS protection (Cloudflare, etc.)
- [ ] Implement API key rotation schedule
- [ ] Review and audit all dependencies
- [ ] Enable SQL injection protection (Prisma handles this)
- [ ] Implement XSS protection (React handles this)
- [ ] Set up CSP headers

## Performance Optimization

- [ ] Enable Redis caching for frequently accessed data
- [ ] Set up CDN for static assets
- [ ] Enable gzip compression
- [ ] Optimize database queries
- [ ] Add database indexes where needed
- [ ] Monitor slow queries
- [ ] Set up connection pooling

## High Availability (Optional)

- [ ] Set up load balancer
- [ ] Deploy multiple API instances
- [ ] Set up Redis cluster/replication
- [ ] Set up PostgreSQL replication
- [ ] Implement health checks
- [ ] Set up auto-scaling
