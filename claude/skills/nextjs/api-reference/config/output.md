# Build Output Configuration

Configure how Next.js builds and outputs your application for different deployment targets.

## Output Configuration

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // 'standalone', 'export', or undefined (default)
}

module.exports = nextConfig
```

## Output Modes

### Default (Server)

Standard Next.js server mode with all features:

```javascript
const nextConfig = {
  // output: undefined (default)
}
```

**Features:**
- Full Next.js server
- Server-Side Rendering (SSR)
- Incremental Static Regeneration (ISR)
- API Routes
- Middleware
- Image Optimization

**Deployment:**
- Vercel
- Node.js server
- Docker containers

### Standalone

Minimal server output for self-hosting:

```javascript
const nextConfig = {
  output: 'standalone',
}
```

**Features:**
- Minimal server bundle
- All Next.js features supported
- Only necessary files included
- Optimized for containers

**Output Structure:**

```
.next/
  standalone/
    .next/
    node_modules/
    public/
    package.json
    server.js
```

**Running:**

```bash
node .next/standalone/server.js
```

**Docker Example:**

```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Export (Static HTML)

Generate static HTML files:

```javascript
const nextConfig = {
  output: 'export',
}
```

**Features:**
- Pure static HTML/CSS/JS
- No server required
- Can be hosted on CDN

**Limitations:**
- No Server-Side Rendering
- No Incremental Static Regeneration
- No API Routes
- No Middleware
- No Image Optimization (use `unoptimized: true`)
- No `getServerSideProps`
- No `revalidate` in `getStaticProps`
- No dynamic routes without `generateStaticParams`

**Output Structure:**

```
out/
  index.html
  about.html
  _next/
    static/
```

**Configuration for Export:**

```javascript
const nextConfig = {
  output: 'export',

  // Required for static export with images
  images: {
    unoptimized: true,
  },

  // Optional: custom output directory
  distDir: 'dist',

  // Optional: add trailing slashes
  trailingSlash: true,
}
```

**Deployment:**
- Static hosting (Netlify, GitHub Pages, S3)
- CDN
- Any web server

## Static Export Examples

### Basic Static Export

```javascript
// next.config.js
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}
```

Build and deploy:

```bash
npm run build
# Output in ./out directory
```

### With Custom Output Directory

```javascript
const nextConfig = {
  output: 'export',
  distDir: 'build',
}
```

### Dynamic Routes with Export

App Router:

```typescript
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  return <div>Post: {params.slug}</div>
}
```

Pages Router:

```typescript
// pages/blog/[slug].tsx
export async function getStaticPaths() {
  const posts = await getPosts()

  return {
    paths: posts.map((post) => ({
      params: { slug: post.slug },
    })),
    fallback: false,
  }
}

export async function getStaticProps({ params }) {
  const post = await getPost(params.slug)
  return { props: { post } }
}
```

### With Base Path

```javascript
const nextConfig = {
  output: 'export',
  basePath: '/docs',
  images: {
    unoptimized: true,
  },
}
```

URLs will be prefixed: `/docs/about`, `/docs/blog`, etc.

## Standalone Mode Examples

### Basic Standalone

```javascript
const nextConfig = {
  output: 'standalone',
}
```

### With Custom Server Port

```bash
# Set PORT environment variable
PORT=3001 node .next/standalone/server.js
```

### Standalone with Output File Tracing

```javascript
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
}
```

Useful for monorepos.

## Deployment Scenarios

### Vercel (Default)

```javascript
// No special configuration needed
const nextConfig = {
  // Default settings work on Vercel
}
```

### Docker (Standalone)

```javascript
const nextConfig = {
  output: 'standalone',
}
```

### Static Hosting (Export)

```javascript
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}
```

### Self-Hosted Node.js (Default or Standalone)

```javascript
// Use standalone for smaller bundle
const nextConfig = {
  output: 'standalone',
}
```

## Additional Output Configuration

### Compression

```javascript
const nextConfig = {
  compress: true, // Enable gzip compression (default: true)
}
```

### Generate Build ID

```javascript
const nextConfig = {
  generateBuildId: async () => {
    // Return custom build ID
    return process.env.BUILD_ID || `build-${Date.now()}`
  },
}
```

### Custom Dist Directory

```javascript
const nextConfig = {
  distDir: 'build', // Default: '.next'
}
```

### Clean Dist on Dev

```javascript
const nextConfig = {
  cleanDistDir: true, // Default: true
}
```

## Complete Examples

### Production Docker Setup

```javascript
// next.config.js
const nextConfig = {
  output: 'standalone',
  compress: true,
  generateBuildId: async () => {
    return process.env.GIT_COMMIT_SHA || 'development'
  },
}

module.exports = nextConfig
```

```dockerfile
# Dockerfile
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Static Site with GitHub Pages

```javascript
// next.config.js
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  output: 'export',
  basePath: isProd ? '/my-repo' : '',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

module.exports = nextConfig
```

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
```

### Monorepo Standalone

```javascript
// next.config.js
const path = require('path')

const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    outputFileTracingIncludes: {
      '/api/**/*': ['../../packages/shared/**/*'],
    },
  },
}

module.exports = nextConfig
```

## Environment Variables in Different Modes

All output modes support environment variables:

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.example.com
DATABASE_URL=postgresql://...
```

## Testing Output Modes

### Test Standalone

```bash
npm run build
node .next/standalone/server.js
```

### Test Export

```bash
npm run build
npx serve out
```

## Best Practices

1. **Use standalone for Docker**: Smaller image size
2. **Use export for static sites**: Maximum performance
3. **Test locally**: Test output mode before deploying
4. **Configure images**: Set `unoptimized: true` for export
5. **Set base path**: For subdirectory deployments
6. **Use compression**: Enable for better performance
7. **Generate build IDs**: Track deployments

## Common Issues

### Images Not Loading (Export)

```javascript
// Add unoptimized
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}
```

### API Routes Not Working (Export)

API routes are not supported in export mode. Use a separate API server or serverless functions.

### 404 on Dynamic Routes (Export)

Ensure `generateStaticParams` (App Router) or `getStaticPaths` (Pages Router) is implemented.

### Standalone Bundle Too Large

```javascript
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingExcludes: {
      '*': ['node_modules/@swc/wasm'],
    },
  },
}
```

## Migration Between Modes

### From Default to Standalone

```javascript
// Before
const nextConfig = {}

// After
const nextConfig = {
  output: 'standalone',
}
```

### From Default to Export

```javascript
// Before
const nextConfig = {}

// After
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}
```

Remove:
- `getServerSideProps`
- API routes
- Middleware
- ISR configurations
