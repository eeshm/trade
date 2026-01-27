# AWS EC2 Deployment Guide for paper.fun

## Overview

Deploy paper.fun on a single AWS EC2 instance using Docker Compose.

**Architecture:**
```
                    ┌─────────────────────────────────────────┐
                    │           EC2 Instance (t3.small)        │
                    │                                          │
   Internet ──────▶ │  ┌─────────┐     ┌─────────────────────┐│
                    │  │  Nginx  │────▶│  Docker Containers   ││
                    │  │ (SSL)   │     │  - API (:3000)       ││
                    │  └─────────┘     │  - WebSocket (:3001) ││
                    │                  │  - Frontend (:3002)  ││
                    │                  │  - Price Worker      ││
                    │                  │  - Candle Worker     ││
                    │                  │  - PostgreSQL        ││
                    │                  │  - Redis             ││
                    │                  └─────────────────────┘│
                    └─────────────────────────────────────────┘
```

**Estimated Cost:** ~$15-25/month ($100 credits = 4-6 months)

---

## Prerequisites

- AWS Account with $100 credits
- Domain name (optional but recommended)
- SSH key pair
- GitHub repository

---

## Step 1: Create EC2 Instance

### A. Launch Instance

1. Go to AWS Console → EC2 → Launch Instance
2. Configure:
   - **Name:** `paper-fun-server`
   - **AMI:** Ubuntu 22.04 LTS (Free tier eligible)
   - **Instance type:** `t3.small` (2 vCPU, 2GB RAM) ~$15/month
   - **Key pair:** Create new or select existing
   - **Storage:** 30 GB gp3 (increase if needed)

### B. Security Group

Create a security group with these rules:

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | Your IP | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web |
| Custom TCP | 3000 | 0.0.0.0/0 | API (temp, remove after Nginx) |
| Custom TCP | 3001 | 0.0.0.0/0 | WebSocket (temp) |

### C. Elastic IP (Recommended)

1. Go to EC2 → Elastic IPs → Allocate
2. Associate with your instance
3. This gives you a fixed IP address

---

## Step 2: Connect and Setup Server

### A. SSH into Instance

```bash
# Replace with your key and IP
ssh -i "your-key.pem" ubuntu@YOUR_EC2_IP
```

### B. Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Logout and login again to apply group changes
exit
```

SSH back in:
```bash
ssh -i "your-key.pem" ubuntu@YOUR_EC2_IP
```

### C. Install Other Tools

```bash
# Install Git, Nginx, Certbot
sudo apt install -y git nginx certbot python3-certbot-nginx

# Install Bun (for migrations)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

---

## Step 3: Clone and Configure Project

### A. Clone Repository

```bash
cd ~
git clone https://github.com/eeshm/trade.git paper-fun
cd paper-fun
```

### B. Create Production Environment File

```bash
nano .env
```

Add these variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:STRONG_PASSWORD_HERE@postgres:5432/paper_trading"
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE

# Redis
REDIS_URL="redis:6379"

# JWT Secret (generate a strong one)
JWT_SECRET="your-super-long-jwt-secret-at-least-64-characters-long-replace-this"

# API Configuration
NODE_ENV=production
PORT=3000
WS_PORT=3001

# Pyth Network
PYTH_NETWORK_URL=https://hermes.pyth.network

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# CORS (update with your domain)
CORS_ORIGIN=https://paper.fun

# Frontend URLs
NEXT_PUBLIC_API_URL=https://api.paper.fun
NEXT_PUBLIC_WS_URL=wss://ws.paper.fun
```

Generate a strong JWT secret:
```bash
openssl rand -base64 64
```

---

## Step 4: Setup Production Docker Compose

The project already has `docker-compose.yml` for databases. We need to add application services.

Create `docker-compose.prod.yml`:

```bash
nano docker-compose.prod.yml
```

(See the docker-compose.prod.yml file I'll create next)

---

## Step 5: Build and Start Services

### A. Build All Services

```bash
# Start databases first
docker compose up -d postgres redis

# Wait for databases to be ready
sleep 10

# Install dependencies and build
bun install
bun run build

# Run migrations
bun run migrate:deploy

# Start all services with production compose
docker compose -f docker-compose.prod.yml up -d --build
```

### B. Verify Services

```bash
# Check running containers
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Test API health
curl http://localhost:3000/health
```

---

## Step 6: Configure Nginx Reverse Proxy

### A. Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/paper-fun
```

Add:

```nginx
# API Server
server {
    listen 80;
    server_name api.paper.fun;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# WebSocket Server
server {
    listen 80;
    server_name ws.paper.fun;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}

# Frontend
server {
    listen 80;
    server_name paper.fun www.paper.fun;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### B. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/paper-fun /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 7: Setup SSL with Let's Encrypt

### A. Point Domain to EC2

Add DNS records for your domain:
- `paper.fun` → A → YOUR_ELASTIC_IP
- `api.paper.fun` → A → YOUR_ELASTIC_IP
- `ws.paper.fun` → A → YOUR_ELASTIC_IP

### B. Get SSL Certificates

```bash
sudo certbot --nginx -d paper.fun -d www.paper.fun -d api.paper.fun -d ws.paper.fun
```

Follow prompts:
- Enter email
- Agree to terms
- Choose to redirect HTTP to HTTPS

### C. Auto-Renewal

Certbot sets up auto-renewal. Test it:
```bash
sudo certbot renew --dry-run
```

---

## Step 8: Setup Systemd Service (Auto-restart)

Create a systemd service for auto-restart on reboot:

```bash
sudo nano /etc/systemd/system/paper-fun.service
```

Add:

```ini
[Unit]
Description=Paper Fun Trading Platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/paper-fun
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable paper-fun
sudo systemctl start paper-fun
```

---

## Step 9: Monitoring & Maintenance

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart single service
docker compose -f docker-compose.prod.yml restart api
```

### Update Deployment

```bash
cd ~/paper-fun
git pull origin master
bun install
bun run build
docker compose -f docker-compose.prod.yml up -d --build
```

### Database Backup

```bash
# Backup
docker exec paper-trading-db pg_dump -U postgres paper_trading > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker exec -i paper-trading-db psql -U postgres paper_trading
```

---

## Troubleshooting

### Container Won't Start
```bash
docker compose -f docker-compose.prod.yml logs api
```

### Database Connection Error
```bash
# Check if postgres is running
docker ps | grep postgres

# Test connection
docker exec -it paper-trading-db psql -U postgres -d paper_trading
```

### WebSocket Not Connecting
- Check Nginx WebSocket config
- Verify security group allows port 443
- Check browser console for errors

### Out of Memory
Upgrade to t3.medium or add swap:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Cost Tracking

Monitor your AWS spend:
1. AWS Console → Billing → Bills
2. Set up budget alerts at $80 (leaving $20 buffer)

---

## Quick Reference

```bash
# SSH into server
ssh -i "your-key.pem" ubuntu@YOUR_ELASTIC_IP

# View all containers
docker ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart
docker compose -f docker-compose.prod.yml restart

# Update
git pull && bun run build && docker compose -f docker-compose.prod.yml up -d --build

# Backup DB
docker exec paper-trading-db pg_dump -U postgres paper_trading > backup.sql
```

---

## Next Steps

1. [ ] Create EC2 instance
2. [ ] Setup Docker
3. [ ] Clone and configure
4. [ ] Start services
5. [ ] Configure Nginx + SSL
6. [ ] Point domain
7. [ ] Test everything
8. [ ] Set up monitoring (optional: CloudWatch)
