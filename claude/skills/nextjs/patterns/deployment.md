# Deployment Strategies for Next.js

Complete guide to deploying Next.js applications across various platforms including Vercel, Docker, self-hosting, and static hosting.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Vercel Deployment](#vercel-deployment)
3. [Docker Deployment](#docker-deployment)
4. [Self-Hosting with Node.js](#self-hosting-with-nodejs)
5. [Static Hosting](#static-hosting)
6. [Serverless Platforms](#serverless-platforms)
7. [CI/CD Pipelines](#cicd-pipelines)
8. [Best Practices](#best-practices)

## Deployment Overview

### Deployment Options

| Platform | Best For | SSR | ISR | API Routes | Edge |
|----------|----------|-----|-----|------------|------|
| Vercel | All features | ✅ | ✅ | ✅ | ✅ |
| Docker | Self-hosting | ✅ | ✅ | ✅ | ❌ |
| Node.js | VPS/Dedicated | ✅ | ✅ | ✅ | ❌ |
| Static | CDN hosting | ❌ | ❌ | ❌ | ❌ |
| AWS Lambda | Serverless | ✅ | ✅ | ✅ | ✅ |
| Netlify | Jamstack | ✅ | ✅ | ✅ | ✅ |

### Build Output Types

```javascript
// next.config.js

// Standalone output (recommended for Docker/self-hosting)
module.exports = {
  output: 'standalone',
}

// Static export
module.exports = {
  output: 'export',
}

// Default (full Next.js features)
module.exports = {
  // No output specified
}
```

## Vercel Deployment

### Quick Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Configuration

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sfo1"],
  "env": {
    "DATABASE_URL": "@database-url",
    "API_KEY": "@api-key"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/old-blog/:slug",
      "destination": "/blog/:slug",
      "permanent": true
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.example.com/:path*"
    }
  ]
}
```

### Environment Variables

```bash
# Set environment variables
vercel env add PRODUCTION
vercel env add PREVIEW
vercel env add DEVELOPMENT

# Pull environment variables
vercel env pull .env.local
```

### Preview Deployments

```bash
# Automatic preview for every push to git
git push origin feature-branch

# Access via: feature-branch-project.vercel.app
```

### Edge Config

```typescript
// app/api/config/route.ts
import { get } from '@vercel/edge-config'

export const runtime = 'edge'

export async function GET() {
  const featureFlags = await get('featureFlags')
  return Response.json(featureFlags)
}
```

## Docker Deployment

### Dockerfile (Optimized)

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables must be present at build time
ARG DATABASE_URL
ARG NEXT_PUBLIC_API_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build with standalone output
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  nextjs:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        DATABASE_URL: ${DATABASE_URL}
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    restart: unless-stopped
    depends_on:
      - postgres
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=myuser
      - POSTGRES_PASSWORD=mypassword
      - POSTGRES_DB=mydb
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - nextjs
    networks:
      - app-network

volumes:
  postgres-data:

networks:
  app-network:
```

### .dockerignore

```
# .dockerignore
Dockerfile
.dockerignore
node_modules
npm-debug.log
README.md
.next
.git
.gitignore
.env*.local
```

### Build and Run

```bash
# Build image
docker build -t nextjs-app .

# Run container
docker run -p 3000:3000 nextjs-app

# Using docker-compose
docker-compose up -d

# View logs
docker-compose logs -f nextjs

# Stop containers
docker-compose down
```

## Self-Hosting with Node.js

### Standalone Build

```javascript
// next.config.js
module.exports = {
  output: 'standalone',
}
```

### Build and Start

```bash
# Build the application
npm run build

# The standalone output is in .next/standalone
cd .next/standalone

# Start the server
node server.js
```

### Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "nextjs-app" -- start

# Or start standalone server
pm2 start server.js --name "nextjs-app"

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'nextjs-app',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
}
```

```bash
# Start with config
pm2 start ecosystem.config.js
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/nextjs-app
upstream nextjs_app {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Gzip compression
    gzip on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://nextjs_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location /_next/static {
        proxy_pass http://nextjs_app;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Cache images
    location ~* \.(jpg|jpeg|png|gif|ico|svg)$ {
        proxy_pass http://nextjs_app;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/nextjs-app /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d example.com -d www.example.com

# Auto-renewal
certbot renew --dry-run
```

## Static Hosting

### Build for Static Export

```javascript
// next.config.js
module.exports = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}
```

### AWS S3 + CloudFront

```bash
# Build
npm run build

# Upload to S3
aws s3 sync out/ s3://my-bucket --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_BASE_PATH: /repo-name

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
```

### Netlify

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404
```

## Serverless Platforms

### AWS Lambda (Serverless Framework)

```yaml
# serverless.yml
service: nextjs-app

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1

plugins:
  - serverless-nextjs-plugin

custom:
  nextjs:
    nextConfigDir: ./

functions:
  nextjs:
    handler: .serverless_nextjs/default-lambda/index.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
      - http:
          path: /
          method: ANY
```

### Cloudflare Pages

```yaml
# .github/workflows/cloudflare.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Build
        run: |
          npm ci
          npm run build

      - name: Publish
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: nextjs-app
          directory: .next
```

## CI/CD Pipelines

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to production
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: |
          npm install -g vercel
          vercel --prod --token=$VERCEL_TOKEN
```

### GitLab CI/CD

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "18"

test:
  stage: test
  image: node:${NODE_VERSION}
  script:
    - npm ci
    - npm run lint
    - npm test
  cache:
    paths:
      - node_modules/

build:
  stage: build
  image: node:${NODE_VERSION}
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - .next/
  cache:
    paths:
      - node_modules/

deploy:
  stage: deploy
  image: node:${NODE_VERSION}
  script:
    - npm install -g vercel
    - vercel --prod --token=$VERCEL_TOKEN
  only:
    - main
  dependencies:
    - build
```

## Best Practices

### 1. Environment Variables

```bash
# .env.production
DATABASE_URL=postgresql://user:pass@host:5432/db
NEXT_PUBLIC_API_URL=https://api.production.com
NEXTAUTH_SECRET=production-secret-key
NEXTAUTH_URL=https://production.com
```

### 2. Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
}
```

### 3. Graceful Shutdown

```javascript
// server.js (for standalone deployment)
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

let server

app.prepare().then(() => {
  server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  server.listen(3000, (err) => {
    if (err) throw err
    console.log('> Ready on http://localhost:3000')
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
})
```

### 4. Monitoring and Logging

```typescript
// lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})
```

### 5. Performance Optimization

```javascript
// next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Enable SWC minification
  swcMinify: true,

  // Image optimization
  images: {
    domains: ['cdn.example.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Headers for caching
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}
```

## Common Pitfalls

1. **Missing environment variables**: Always validate required env vars
2. **Not using standalone output**: Larger Docker images
3. **No health checks**: Can't verify deployment success
4. **Hardcoded URLs**: Use environment variables
5. **No HTTPS**: Always use SSL in production
6. **Missing error tracking**: Implement Sentry or similar
7. **No monitoring**: Add performance monitoring
8. **Large Docker images**: Use multi-stage builds

## Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
