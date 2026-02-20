# Next.js Configuration Overview

The `next.config.js` file is the primary configuration file for Next.js applications, located at the root of your project. It allows you to customize build behavior, runtime settings, and deployment options.

## Configuration File Formats

### CommonJS Format (next.config.js)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration options
  reactStrictMode: true,
  poweredByHeader: false,
}

module.exports = nextConfig
```

### ES Modules Format (next.config.mjs)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration options
  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
```

### TypeScript Format (next.config.ts)

Available in Next.js 15+:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Configuration options
  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
```

## Functional Configuration

You can also export a function that returns the configuration object:

```javascript
module.exports = (phase, { defaultConfig }) => {
  /**
   * @type {import('next').NextConfig}
   */
  const nextConfig = {
    reactStrictMode: true,
  }
  return nextConfig
}
```

### Available Phases

```javascript
const {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
  PHASE_EXPORT,
} = require('next/constants')

module.exports = (phase) => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      // Development-only config
      reactStrictMode: true,
    }
  }

  if (phase === PHASE_PRODUCTION_BUILD) {
    return {
      // Production build config
      compiler: {
        removeConsole: true,
      },
    }
  }

  return {
    // Default config for all other phases
  }
}
```

## Core Configuration Options

### General Settings

```javascript
const nextConfig = {
  // Enable React Strict Mode
  reactStrictMode: true,

  // Disable X-Powered-By header
  poweredByHeader: false,

  // Enable SWC minification (default in Next.js 13+)
  swcMinify: true,

  // Compress output
  compress: true,

  // Generate ETag headers
  generateEtags: true,

  // Disable HTTP keep-alive
  httpAgentOptions: {
    keepAlive: false,
  },

  // Page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', 'mdx'],

  // Trailing slash behavior
  trailingSlash: false,

  // Asset prefix for CDN
  assetPrefix: '',

  // Custom build directory
  distDir: '.next',

  // Clean dist directory on dev
  cleanDistDir: true,
}
```

### TypeScript Configuration

```javascript
const nextConfig = {
  typescript: {
    // Dangerously allow production builds to complete even with type errors
    ignoreBuildErrors: false,

    // Custom TypeScript config path
    tsconfigPath: './tsconfig.json',
  },
}
```

### ESLint Configuration

```javascript
const nextConfig = {
  eslint: {
    // Ignore ESLint errors during build
    ignoreDuringBuilds: false,

    // Directories to lint
    dirs: ['pages', 'app', 'components', 'lib', 'src'],
  },
}
```

### Production URL Configuration

```javascript
const nextConfig = {
  // Production URL (for sitemap, canonical URLs, etc.)
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://example.com',
  },
}
```

## Async Configuration

You can use async functions for dynamic configuration:

```javascript
module.exports = async (phase, { defaultConfig }) => {
  // Fetch configuration from external source
  const externalConfig = await fetchConfig()

  return {
    ...defaultConfig,
    ...externalConfig,
  }
}
```

## Configuration Composition

Compose multiple configurations using spreads:

```javascript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  reactStrictMode: true,
}

module.exports = withBundleAnalyzer(nextConfig)
```

Multiple plugins:

```javascript
const withMDX = require('@next/mdx')()
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
}

module.exports = withMDX(withBundleAnalyzer(nextConfig))
```

## Runtime Configuration (Deprecated)

Note: Runtime configuration is deprecated. Use environment variables instead.

```javascript
// Deprecated approach
const nextConfig = {
  serverRuntimeConfig: {
    mySecret: 'secret',
  },
  publicRuntimeConfig: {
    staticFolder: '/static',
  },
}

// Recommended approach: Use environment variables
// .env.local
// MY_SECRET=secret
// NEXT_PUBLIC_STATIC_FOLDER=/static
```

## Configuration Validation

Next.js validates your configuration and shows warnings for invalid options:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // This will show a warning if the option doesn't exist
  unknownOption: true, // Warning: Invalid Next.js config option
}
```

## Environment-Specific Configuration

```javascript
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

const nextConfig = {
  reactStrictMode: true,

  // Development-only options
  ...(isDevelopment && {
    // Enable detailed error messages
  }),

  // Production-only options
  ...(isProduction && {
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn'],
      },
    },
  }),
}

module.exports = nextConfig
```

## Best Practices

1. **Use TypeScript types**: Add `@type {import('next').NextConfig}` for autocompletion
2. **Validate configuration**: Test in development before deploying
3. **Use environment variables**: Prefer env vars over runtime config
4. **Document custom options**: Add comments for complex configurations
5. **Keep it simple**: Only add options you actually need
6. **Version control**: Commit `next.config.js` but not `.env.local`
7. **Test phases**: Use phase-based config carefully and test all scenarios

## Common Patterns

### Development vs Production

```javascript
const isDev = process.env.NODE_ENV !== 'production'

module.exports = {
  reactStrictMode: true,
  compiler: {
    removeConsole: isDev ? false : { exclude: ['error'] },
  },
}
```

### With Environment Variables

```javascript
module.exports = {
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Or use public env vars (recommended)
  // NEXT_PUBLIC_CUSTOM_KEY in .env files
}
```

### With External Plugins

```javascript
const withPlugins = require('next-compose-plugins')
const withImages = require('next-images')
const withSass = require('@zeit/next-sass')

module.exports = withPlugins([
  withImages,
  withSass,
], {
  reactStrictMode: true,
})
```

## Configuration Reference

For specific configuration areas, see:
- Image optimization: `images.md`
- Redirects: `redirects.md`
- Rewrites: `rewrites.md`
- Headers: `headers.md`
- Environment variables: `env.md`
- Webpack: `webpack.md`
- Turbopack: `turbopack.md`
- TypeScript: `typescript.md`
- ESLint: `eslint.md`
- Experimental features: `experimental.md`
