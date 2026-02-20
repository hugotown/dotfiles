# Experimental Features Configuration

Next.js provides experimental features that are under active development. Configure experimental features in `next.config.js`.

## Enabling Experimental Features

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Experimental features go here
  },
}

module.exports = nextConfig
```

**Warning**: Experimental features are unstable and may change or be removed in future versions. Use with caution in production.

## Current Experimental Features

### Partial Prerendering (PPR)

Progressive rendering that combines static and dynamic content:

```javascript
const nextConfig = {
  experimental: {
    ppr: true, // Enable Partial Prerendering
  },
}
```

Per-route PPR:

```typescript
// app/page.tsx
export const experimental_ppr = true

export default function Page() {
  return <div>This page uses PPR</div>
}
```

### React Server Components

Server Components are now stable in Next.js 13+, but some related features are experimental:

```javascript
const nextConfig = {
  experimental: {
    serverActions: true, // Enable Server Actions
    serverComponentsExternalPackages: ['package-name'], // External packages for Server Components
  },
}
```

### Server Actions

```javascript
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['example.com', '*.example.com'],
      bodySizeLimit: '2mb', // Default is 1mb
    },
  },
}
```

Usage:

```typescript
// app/actions.ts
'use server'

export async function createUser(formData: FormData) {
  const name = formData.get('name')
  // Process form data
}
```

### Typed Routes

Type-safe routes with TypeScript:

```javascript
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
}
```

Usage:

```typescript
import Link from 'next/link'

// TypeScript will error if route doesn't exist
<Link href="/about">About</Link>
<Link href="/invalid">Error!</Link> // TypeScript error
```

### App Directory

App Router is now stable in Next.js 13+:

```javascript
const nextConfig = {
  experimental: {
    appDir: true, // Not needed in Next.js 13.4+
  },
}
```

### Turbopack

```javascript
const nextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@': './',
      },
    },
  },
}
```

Run with:

```bash
next dev --turbo
```

### Edge Runtime

```javascript
const nextConfig = {
  experimental: {
    runtime: 'experimental-edge', // Deprecated: use runtime config in routes
  },
}
```

Per-route runtime:

```typescript
// app/api/route.ts
export const runtime = 'edge'

export async function GET() {
  return new Response('Hello from Edge')
}
```

### Instrumentation

Enable instrumentation for observability:

```javascript
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}
```

Create instrumentation file:

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js-specific instrumentation
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime instrumentation
  }
}
```

### Middleware Source

```javascript
const nextConfig = {
  experimental: {
    allowMiddlewareResponseBody: true, // Allow response bodies in middleware
  },
}
```

### External Packages

Opt-out packages from Server Components bundling:

```javascript
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      'package-with-native-dependencies',
      '@prisma/client',
    ],
  },
}
```

### Optimize Package Imports

Optimize imports from large packages:

```javascript
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lodash', 'date-fns', '@mui/material'],
  },
}
```

Before:

```javascript
import { debounce } from 'lodash' // Imports entire lodash
```

After optimization:

```javascript
import { debounce } from 'lodash' // Only imports debounce
```

### CSS Optimization

```javascript
const nextConfig = {
  experimental: {
    optimizeCss: true, // Requires 'critters' package
  },
}
```

Install dependency:

```bash
npm install --save-dev critters
```

### Memory-Based Images

```javascript
const nextConfig = {
  experimental: {
    memoryBasedWorkersCount: true, // Use available memory to determine worker count
  },
}
```

### Output File Tracing

```javascript
const nextConfig = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'), // Useful for monorepos
    outputFileTracingIncludes: {
      '/api/**/*': ['./external-package/**/*'],
    },
    outputFileTracingExcludes: {
      '/api/admin': ['./unnecessary-files/**/*'],
    },
  },
}
```

### Strict Mode

```javascript
const nextConfig = {
  experimental: {
    strictNextHead: true, // Stricter next/head validation
  },
}
```

### Fetch Cache

```javascript
const nextConfig = {
  experimental: {
    fetchCache: 'only-cache', // 'default-cache', 'force-cache', 'only-cache', 'force-no-store', 'default-no-store', 'only-no-store'
  },
}
```

### ISR Memory Cache

```javascript
const nextConfig = {
  experimental: {
    isrMemoryCacheSize: 0, // Disable ISR memory cache (useful for large sites)
    isrFlushToDisk: false, // Don't write ISR cache to disk
  },
}
```

### Incremental Cache Handler

Custom cache handler:

```javascript
const nextConfig = {
  experimental: {
    incrementalCacheHandlerPath: './cache-handler.js',
  },
}
```

Cache handler:

```javascript
// cache-handler.js
module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
  }

  async get(key) {
    // Get from cache
  }

  async set(key, data, ctx) {
    // Set in cache
  }

  async revalidateTag(tag) {
    // Revalidate by tag
  }
}
```

### Scroll Restoration

```javascript
const nextConfig = {
  experimental: {
    scrollRestoration: true, // Restore scroll position on navigation
  },
}
```

### Extended Keep Alive

```javascript
const nextConfig = {
  experimental: {
    webVitalsAttribution: ['CLS', 'LCP', 'FCP', 'FID', 'TTFB', 'INP'],
  },
}
```

### Use Light Account

```javascript
const nextConfig = {
  experimental: {
    useLightningcss: true, // Use Lightning CSS instead of PostCSS
  },
}
```

### Adjust Font Fallback Metrics

```javascript
const nextConfig = {
  experimental: {
    adjustFontFallbacksWithSizeAdjust: true,
  },
}
```

### Missing Suspense with CSR Bailout

```javascript
const nextConfig = {
  experimental: {
    missingSuspenseWithCSRBailout: false, // Disable warning for missing Suspense
  },
}
```

## Complete Configuration Example

```javascript
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Performance
    ppr: true,
    optimizePackageImports: ['lodash', 'date-fns'],
    memoryBasedWorkersCount: true,

    // Server Actions
    serverActions: {
      allowedOrigins: ['example.com'],
      bodySizeLimit: '2mb',
    },

    // Type Safety
    typedRoutes: true,

    // Instrumentation
    instrumentationHook: true,

    // Server Components
    serverComponentsExternalPackages: ['@prisma/client'],

    // Caching
    isrMemoryCacheSize: 50 * 1024 * 1024, // 50MB

    // Turbopack
    turbo: {
      resolveAlias: {
        '@': path.resolve(__dirname),
      },
    },

    // Build Optimization
    optimizeCss: true,
  },
}

module.exports = nextConfig
```

## Environment-Specific Experimental Features

```javascript
const isDevelopment = process.env.NODE_ENV === 'development'

const nextConfig = {
  experimental: {
    // Enable in development only
    ...(isDevelopment && {
      turbo: {
        resolveAlias: {
          '@': './',
        },
      },
    }),

    // Enable in production only
    ...(!isDevelopment && {
      optimizeCss: true,
      optimizePackageImports: ['lodash'],
    }),
  },
}
```

## Feature-Specific Configurations

### For Large Applications

```javascript
const nextConfig = {
  experimental: {
    memoryBasedWorkersCount: true,
    isrMemoryCacheSize: 100 * 1024 * 1024, // 100MB
    optimizePackageImports: ['lodash', 'date-fns', '@mui/material'],
  },
}
```

### For Monorepos

```javascript
const nextConfig = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    serverComponentsExternalPackages: [
      '@myorg/package1',
      '@myorg/package2',
    ],
  },
}
```

### For Edge Runtime

```javascript
const nextConfig = {
  experimental: {
    allowMiddlewareResponseBody: true,
  },
}
```

## Best Practices

1. **Test thoroughly**: Experimental features may have bugs
2. **Read release notes**: Features change between versions
3. **Have fallback plan**: Be ready to disable if issues arise
4. **Monitor performance**: Track impact of experimental features
5. **Keep updated**: Experimental features may become stable
6. **Document usage**: Note which experimental features are used
7. **Check compatibility**: Some features may conflict

## Migration to Stable Features

When experimental features become stable, remove from experimental config:

```javascript
// Before (Next.js 13.3)
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

// After (Next.js 13.4+)
const nextConfig = {
  // appDir is now stable, no config needed
}
```

## Common Issues

### Feature Not Working

Check Next.js version:

```bash
npm list next
```

Some features require specific versions.

### Breaking Changes

Experimental features may change:

```javascript
// Lock Next.js version in package.json during development
{
  "dependencies": {
    "next": "14.0.0" // Specific version
  }
}
```

### Performance Degradation

Disable experimental features one by one to identify the issue:

```javascript
const nextConfig = {
  experimental: {
    // ppr: true, // Temporarily disabled for testing
    typedRoutes: true,
  },
}
```

## Staying Updated

Check Next.js releases for experimental feature updates:
- [Next.js Releases](https://github.com/vercel/next.js/releases)
- [Next.js Blog](https://nextjs.org/blog)
- [Next.js Documentation](https://nextjs.org/docs)

## Feature Graduation Timeline

Experimental features typically follow this path:

1. **Experimental**: Unstable, may change
2. **Beta**: More stable, API mostly finalized
3. **Stable**: Production-ready, moved out of experimental

Examples of graduated features:
- App Router (experimental → stable in 13.4)
- React Server Components (experimental → stable in 13.0)
- Middleware (experimental → stable in 12.2)

## Reporting Issues

If you encounter issues with experimental features:

1. Check existing GitHub issues
2. Create minimal reproduction
3. Report with Next.js version and configuration
4. Include error messages and logs

```bash
# Get Next.js info for bug reports
npx next info
```
