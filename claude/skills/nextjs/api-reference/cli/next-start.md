# next start

Start the Next.js production server.

## Syntax

```bash
next start [options]
```

## Description

Starts Next.js in production mode. Requires a successful build first (`next build`).

Features:
- Production optimizations enabled
- Static and dynamic page serving
- API route handling
- Server-side rendering
- Static file serving

## Prerequisites

Must run `next build` before starting:

```bash
next build
next start
```

## Options

### `--port` / `-p`
Specify server port (default: 3000).

```bash
next start --port 8080
next start -p 3001
```

### `--hostname` / `-H`
Specify hostname (default: 0.0.0.0).

```bash
next start --hostname localhost
next start -H 127.0.0.1
```

### `--keepAliveTimeout`
Maximum time in milliseconds for keep-alive connections.

```bash
next start --keepAliveTimeout 70000
```

Useful for load balancers with specific timeout requirements.

## Environment Variables

### NODE_ENV
Automatically set to `production`.

### PORT
Override default port:
```bash
PORT=8080 next start
```

### HOSTNAME
Override default hostname:
```bash
HOSTNAME=localhost next start
```

### NEXT_TELEMETRY_DISABLED
Disable telemetry:
```bash
NEXT_TELEMETRY_DISABLED=1 next start
```

## Usage Examples

### Basic Production Start
```bash
# Build first
next build

# Start server
next start

# Or via package.json
npm start
```

### Custom Port
```bash
# Specific port
next start --port 8080

# Via environment
PORT=8080 next start
```

### Local-Only Access
```bash
# Bind to localhost
next start --hostname localhost

# Only accessible from same machine
```

### Network Access
```bash
# Bind to all interfaces (default)
next start --hostname 0.0.0.0

# Accessible from network
```

### With Load Balancer
```bash
# Match ALB timeout (60s)
next start --keepAliveTimeout 65000
```

## Production Server Features

### Static File Serving
Serves files from:
- `.next/static/` - Build assets
- `public/` - Public files

### Dynamic Rendering
- Server-side rendering (SSR)
- Incremental Static Regeneration (ISR)
- API routes

### Caching
- Automatic page caching
- ISR cache management
- Static asset caching with immutable headers

### Compression
Automatic gzip/brotli compression for:
- HTML pages
- JavaScript bundles
- CSS files
- API responses

## Server Configuration

### next.config.js

```javascript
module.exports = {
  // Compression
  compress: true, // Default

  // Server timeout
  serverRuntimeConfig: {
    timeout: 30000,
  },

  // Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
    ]
  },
}
```

### Custom Server

For advanced use cases:

```javascript
// server.js
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true)
    await handle(req, res, parsedUrl)
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
```

Run custom server:
```bash
node server.js
```

## Clustering for Performance

### Using PM2

Install PM2:
```bash
npm install -g pm2
```

Cluster mode:
```bash
# Start with cluster mode
pm2 start npm --name "next-app" -i max -- start

# Max instances (one per CPU core)
pm2 start npm --name "next-app" -i 4 -- start

# Monitor
pm2 monit

# Logs
pm2 logs next-app

# Stop
pm2 stop next-app

# Restart
pm2 restart next-app
```

### ecosystem.config.js
```javascript
module.exports = {
  apps: [{
    name: 'next-app',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
}
```

Start with config:
```bash
pm2 start ecosystem.config.js
```

## Deployment Patterns

### Standard Deployment
```bash
# Build
npm run build

# Start
npm start

# Or combined
npm run build && npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t my-next-app .
docker run -p 3000:3000 my-next-app
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: next-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: next-app
  template:
    metadata:
      labels:
        app: next-app
    spec:
      containers:
      - name: next-app
        image: my-next-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
---
apiVersion: v1
kind: Service
metadata:
  name: next-app-service
spec:
  selector:
    app: next-app
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Serverless Deployment

Vercel (recommended):
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Standalone Output

Build standalone:
```javascript
// next.config.js
module.exports = {
  output: 'standalone',
}
```

```bash
next build
# Outputs to .next/standalone
```

Start standalone:
```bash
node .next/standalone/server.js
```

## Monitoring

### Health Check Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
```

Check health:
```bash
curl http://localhost:3000/api/health
```

### Process Monitoring

```bash
# Using PM2
pm2 start npm --name next-app -- start
pm2 monit

# Using systemd
sudo systemctl status next-app
```

### Application Monitoring

Integrate monitoring:
```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry
    await import('./sentry.server.config')

    // DataDog
    // await import('./datadog')
  }
}
```

## Performance Optimization

### Memory Management
```bash
# Set Node.js memory limit
NODE_OPTIONS='--max-old-space-size=2048' next start

# Monitor memory
node --expose-gc server.js
```

### Keep-Alive Tuning
```bash
# AWS ALB (60s timeout)
next start --keepAliveTimeout 65000

# GCP Load Balancer (30s)
next start --keepAliveTimeout 35000
```

### Caching Headers

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/static/:path*',
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

## Common Use Cases

### Basic Production
```bash
# Standard deployment
npm run build
npm start
```

### Behind Proxy
```bash
# Bind to localhost
next start --hostname localhost --port 3000

# Configure nginx/Apache to proxy
```

### Multiple Instances
```bash
# Instance 1
PORT=3000 next start &

# Instance 2
PORT=3001 next start &

# Load balance between them
```

### With SSL/TLS
```bash
# Use reverse proxy (nginx, Caddy)
# Or custom server with HTTPS
```

## Troubleshooting

### Build Not Found
```bash
Error: Could not find a production build

# Solution: Build first
next build
next start
```

### Port Already in Use
```bash
Error: listen EADDRINUSE :::3000

# Solution: Use different port
next start --port 3001

# Or kill process
lsof -ti:3000 | xargs kill
```

### Memory Issues
```bash
# Increase Node.js memory
NODE_OPTIONS='--max-old-space-size=4096' next start

# Use clustering
pm2 start npm --name next-app -i max -- start
```

### Connection Timeouts
```bash
# Adjust keep-alive timeout
next start --keepAliveTimeout 70000

# Check load balancer timeout settings
```

### Environment Variables Not Loading
```bash
# Check .env.production exists
ls -la .env.production

# Verify NEXT_PUBLIC_ prefix for client-side vars
# Rebuild after env changes
next build
next start
```

## Best Practices

1. **Always Build First**: Run `next build` before `next start`
2. **Use Process Manager**: PM2 or systemd for production
3. **Enable Clustering**: Utilize all CPU cores
4. **Set Keep-Alive**: Match load balancer timeout + 5s
5. **Monitor Resources**: Track memory, CPU, and request latency
6. **Use Reverse Proxy**: nginx/Caddy for SSL and caching
7. **Health Checks**: Implement health check endpoints
8. **Graceful Shutdown**: Handle SIGTERM signals properly

## Package.json Scripts

### Basic
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

### With Options
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start --port 3000",
    "start:prod": "NODE_ENV=production next start",
    "pm2:start": "pm2 start npm --name next-app -i max -- start",
    "pm2:stop": "pm2 stop next-app"
  }
}
```

## Related Commands

- [next build](./next-build.md) - Build for production
- [next dev](./next-dev.md) - Development server
- [create-next-app](./create-next-app.md) - Create new project

## Learn More

- [Deployment](https://nextjs.org/docs/deployment)
- [Self-Hosting](https://nextjs.org/docs/pages/building-your-application/deploying#self-hosting)
- [Output File Tracing](https://nextjs.org/docs/pages/api-reference/next-config-js/output)
