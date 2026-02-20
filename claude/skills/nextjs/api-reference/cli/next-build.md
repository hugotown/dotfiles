# next build

Create an optimized production build of your Next.js application.

## Syntax

```bash
next build [directory] [options]
```

## Description

Generates an optimized production build with:
- Minified JavaScript and CSS
- Optimized images and fonts
- Static generation for applicable pages
- Server-side rendering preparation
- Production performance optimizations

## Options

### `[directory]`
Specify project directory (default: current directory).

```bash
next build ./my-app
```

### `--profile`
Enable React production profiling.

```bash
next build --profile
```

Adds profiling data for React DevTools Profiler.

### `--debug`
Enable verbose build output.

```bash
next build --debug
```

Shows detailed compilation information.

### `--no-lint`
Skip linting during build.

```bash
next build --no-lint
```

### `--no-mangling`
Disable variable name mangling.

```bash
next build --no-mangling
```

Useful for debugging production builds.

### `--experimental-app-only`
Build only App Router pages (skip Pages Router).

```bash
next build --experimental-app-only
```

### `--experimental-build-mode`
Specify build mode: `default`, `compile`, or `generate`.

```bash
next build --experimental-build-mode generate
```

## Build Process

### 1. Linting
Runs ESLint if configured (skip with `--no-lint`).

### 2. Type Checking
Validates TypeScript types (if using TypeScript).

### 3. Compilation
Compiles pages, API routes, and components:
- JavaScript/TypeScript transpilation
- CSS processing
- Image optimization
- Font optimization

### 4. Static Generation
Pre-renders pages using:
- Static Site Generation (SSG)
- Incremental Static Regeneration (ISR)

### 5. Optimization
Applies production optimizations:
- Code minification
- Tree shaking
- Bundle splitting
- Compression

### 6. Output
Creates `.next` directory with build artifacts.

## Build Output

### Directory Structure
```
.next/
├── cache/              # Build cache
├── server/             # Server bundles
│   ├── app/           # App Router pages
│   ├── pages/         # Pages Router
│   └── chunks/        # Shared chunks
├── static/            # Static assets
│   ├── chunks/        # JavaScript chunks
│   ├── css/           # Stylesheets
│   └── media/         # Images, fonts
└── BUILD_ID           # Unique build identifier
```

### Build Analysis

After build, see output summary:

```
Route (app)                    Size     First Load JS
┌ ○ /                         142 B          87.2 kB
├ ○ /_not-found              871 B          85.1 kB
└ ○ /about                   142 B          87.2 kB

○  (Static)  prerendered as static content
```

### Route Indicators
- `○` (Static) - Pre-rendered as static HTML
- `●` (SSG) - Static Site Generation
- `λ` (Server) - Server-side rendered
- `ƒ` (Dynamic) - Dynamically rendered

### Size Metrics
- **Size** - Individual page size
- **First Load JS** - JavaScript loaded on first visit

## Usage Examples

### Standard Build
```bash
next build

# Or via package.json
npm run build
```

### With Profiling
```bash
# Enable React profiling
next build --profile

# Analyze in React DevTools
```

### Debug Build
```bash
# Verbose output
next build --debug

# Skip linting
next build --no-lint
```

### Different Directory
```bash
# Build specific directory
next build ./apps/web

# Build from parent directory
cd .. && next build ./my-app
```

## Environment Variables

### NODE_ENV
Automatically set to `production`.

### NEXT_TELEMETRY_DISABLED
Disable anonymous telemetry:
```bash
NEXT_TELEMETRY_DISABLED=1 next build
```

### Custom Variables
Load from `.env.production`:
```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.production.com
DATABASE_URL=postgresql://prod-db
```

## Build Configuration

### next.config.js

```javascript
module.exports = {
  // Output standalone build
  output: 'standalone',

  // Enable SWC minification
  swcMinify: true,

  // Disable source maps
  productionBrowserSourceMaps: false,

  // Optimize images
  images: {
    domains: ['example.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Compression
  compress: true,

  // Generate build ID
  generateBuildId: async () => {
    return 'my-build-id'
  },
}
```

## Static Export

Generate static HTML export:

```javascript
// next.config.js
module.exports = {
  output: 'export',
}
```

```bash
next build
# Creates 'out/' directory with static files
```

## Output Modes

### Standalone
Self-contained deployment:
```javascript
module.exports = {
  output: 'standalone',
}
```

Creates `.next/standalone` with all dependencies.

### Static Export
Pure static site:
```javascript
module.exports = {
  output: 'export',
}
```

Outputs to `out/` directory.

## Build Optimization

### Bundle Analysis

Install analyzer:
```bash
npm install @next/bundle-analyzer
```

Configure:
```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // Your config
})
```

Run analysis:
```bash
ANALYZE=true next build
```

### Code Splitting

Automatic splitting by:
- Route-based splitting
- Dynamic imports
- Shared chunks

Example dynamic import:
```typescript
import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(() => import('../components/Heavy'))
```

### Tree Shaking

Automatically removes unused code:
- ES modules only
- Side-effect-free modules
- Optimized in production

### Minification

SWC minifier (default):
```javascript
module.exports = {
  swcMinify: true, // Default in Next.js 13+
}
```

### Image Optimization

Automatic optimization:
```typescript
import Image from 'next/image'

<Image
  src="/photo.jpg"
  width={500}
  height={300}
  alt="Photo"
/>
```

### Font Optimization

Automatic font inlining:
```typescript
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })
```

## Build Caching

### Cache Directory
Located at `.next/cache/`.

### Clear Cache
```bash
rm -rf .next
next build
```

### Persistent Caching
Speed up subsequent builds:
- Webpack persistent cache
- SWC compilation cache
- Image optimization cache

## CI/CD Integration

### GitHub Actions
```yaml
name: Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
```

### Docker
```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
```

### Vercel
```bash
# Automatic builds on git push
# Configure in vercel.json or dashboard
```

## Build Validation

### Type Checking
```bash
# Check types before build
npm run type-check
next build
```

### Linting
```bash
# Lint before build
npm run lint
next build

# Or skip during build
next build --no-lint
```

### Testing
```bash
# Run tests before build
npm test
next build
```

## Common Use Cases

### Production Deployment
```bash
# Build and start
npm run build
npm start
```

### Static Site
```javascript
// next.config.js
module.exports = {
  output: 'export',
}
```

```bash
next build
# Serve from 'out/' directory
```

### Docker Container
```bash
# Build with standalone output
next build

# Copy .next/standalone to container
```

### Edge Deployment
```javascript
module.exports = {
  // Optimized for edge runtime
  experimental: {
    runtime: 'edge',
  },
}
```

## Build Errors

### Common Issues

**Out of Memory**
```bash
# Increase Node.js memory
NODE_OPTIONS='--max-old-space-size=4096' next build
```

**Type Errors**
```bash
# Fix TypeScript errors
npm run type-check

# Or skip type checking (not recommended)
# Set skipLibCheck in tsconfig.json
```

**Module Not Found**
```bash
# Install dependencies
npm install

# Clear cache
rm -rf .next node_modules
npm install
next build
```

**Build Timeout**
```bash
# Increase timeout in CI
# GitHub Actions: Add timeout-minutes
# Docker: Increase build timeout
```

## Performance Tips

1. **Enable SWC Minification**: Faster than Terser
2. **Use Standalone Output**: Smaller deployment size
3. **Optimize Images**: Use Next.js Image component
4. **Code Splitting**: Use dynamic imports
5. **Analyze Bundles**: Identify large dependencies
6. **Cache Builds**: Persist `.next/cache` in CI
7. **Parallel Builds**: Use build matrix in CI

## Build Metrics

### Viewing Metrics
```bash
next build
```

Shows:
- Page sizes
- First Load JS
- Build duration
- Route types

### Export Metrics
```javascript
// next.config.js
module.exports = {
  experimental: {
    logging: {
      level: 'verbose',
    },
  },
}
```

## Related Commands

- [next dev](./next-dev.md) - Development server
- [next start](./next-start.md) - Start production server
- [next lint](./next-lint.md) - Lint codebase
- [next info](./next-info.md) - System information

## Learn More

- [Deployment](https://nextjs.org/docs/deployment)
- [Optimizing](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Output File Tracing](https://nextjs.org/docs/pages/api-reference/next-config-js/output)
