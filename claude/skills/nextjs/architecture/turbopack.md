# Turbopack

## Overview

Turbopack is Next.js's incremental bundler built in Rust, designed to replace Webpack as the default bundler. It provides significantly faster build times through incremental computation, optimized caching, and native performance.

**Status**: Stable in Next.js 13+ for development, production support in progress.

## Key Features

### 1. Incremental Bundling

Turbopack only processes what changed:

```
Initial Build: 100 modules → ~1000ms
After Change: 1 module → ~10ms
```

**Benefits:**
- Instant updates during development
- Minimal rebuild time
- Efficient resource usage

### 2. Request-Level Compilation

Only compiles what the browser requests:

```
Browser requests /page → Turbopack compiles /page
Browser navigates to /other → Turbopack compiles /other
```

**Advantages:**
- Faster startup time
- Reduced memory usage
- Better for large applications

### 3. Native Performance

Written in Rust for maximum speed:

```
Webpack: JavaScript-based
Turbopack: Rust-based (10x faster in benchmarks)
```

## Getting Started

### Enable Turbopack

**Development mode:**
```bash
# Using next dev
next dev --turbo

# Using npm scripts
npm run dev -- --turbo

# Update package.json
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}
```

**Production mode (experimental):**
```bash
# Next.js 14+
next build --turbo
```

### Configuration

Basic Turbopack configuration in `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is automatically used when --turbo flag is present

  // Turbopack-specific experimental features
  experimental: {
    turbo: {
      // Custom webpack loaders
      loaders: {
        // Add loader for specific file types
        '.md': ['@mdx-js/loader'],
      },

      // Resolve aliases
      resolveAlias: {
        '@': './src',
        '@components': './src/components',
      },

      // Resolve extensions
      resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js'],
    },
  },
}

module.exports = nextConfig
```

## Architecture

### Compilation Flow

```
Request → Task Graph → Incremental Engine → Cache → Compiled Output
```

**Components:**

1. **Task Graph**: Dependency graph of all modules
2. **Incremental Engine**: Tracks changes and recomputes only affected nodes
3. **Cache**: Persistent caching across restarts
4. **Compiled Output**: Bundled JavaScript/CSS

### Incremental Computation

```javascript
// Initial state
Module A → Module B → Module C

// Change Module B
Module A (cached) → Module B (recompile) → Module C (recompile)

// Change Module C
Module A (cached) → Module B (cached) → Module C (recompile)
```

### Memory Model

Turbopack uses a function-level cache:

```rust
// Simplified Rust pseudocode
fn compile_module(input: &str) -> Output {
    // Cache at function level
    // Only recomputes when input changes
}
```

## Comparison with Webpack

| Feature | Turbopack | Webpack |
|---------|-----------|---------|
| **Language** | Rust | JavaScript |
| **Initial Build** | ~10x faster | Baseline |
| **HMR Speed** | ~700x faster | Baseline |
| **Memory Usage** | Lower | Higher |
| **Production** | Beta | Stable |
| **Plugin Ecosystem** | Limited | Extensive |
| **Incremental** | Yes | Partial |

### Migration from Webpack

**Webpack config → Turbopack:**

```javascript
// webpack.config.js (before)
module.exports = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.md$/,
        use: 'raw-loader',
      },
    ],
  },
}

// next.config.js (after)
module.exports = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@': './src',
      },
      loaders: {
        '.md': ['raw-loader'],
      },
    },
  },
}
```

## Supported Features

### ✅ Fully Supported

- JavaScript/TypeScript compilation
- CSS Modules
- Global CSS
- PostCSS
- Fast Refresh
- Image optimization
- Font optimization
- Environment variables
- TypeScript paths
- Absolute imports

### ⚠️ Partial Support

- CSS-in-JS (styled-components, emotion)
- Custom webpack loaders (via adapter)
- Some webpack plugins

### ❌ Not Yet Supported

- Full webpack plugin ecosystem
- Some legacy webpack configurations

## Configuration Options

### Loaders

Add custom loaders for specific file types:

```javascript
module.exports = {
  experimental: {
    turbo: {
      loaders: {
        // Markdown
        '.md': ['@mdx-js/loader'],

        // SVG as React component
        '.svg': ['@svgr/webpack'],

        // GraphQL
        '.graphql': ['graphql-tag/loader'],
      },
    },
  },
}
```

### Resolve Aliases

Configure module resolution:

```javascript
module.exports = {
  experimental: {
    turbo: {
      resolveAlias: {
        // Alias to directory
        '@': './src',
        '@components': './src/components',
        '@utils': './src/utils',

        // Alias to specific file
        'config': './src/config/index.ts',
      },
    },
  },
}
```

### Resolve Extensions

Specify resolution order:

```javascript
module.exports = {
  experimental: {
    turbo: {
      resolveExtensions: [
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.json',
        '.mdx',
      ],
    },
  },
}
```

### Module Rules

```javascript
module.exports = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
}
```

## Performance Optimization

### 1. Cache Configuration

Turbopack caches automatically:

```javascript
// Cache location: .next/cache/turbopack

// Clear cache
rm -rf .next/cache

// Cache persists across restarts
```

### 2. Memory Management

```javascript
// next.config.js
module.exports = {
  experimental: {
    turbo: {
      // Memory limit (in MB)
      memoryLimit: 4096,
    },
  },
}
```

### 3. Parallel Processing

Turbopack uses all available CPU cores:

```bash
# Automatically uses all cores
next dev --turbo

# No configuration needed
```

### 4. Lazy Compilation

Only compiles routes when requested:

```javascript
// Visiting /page triggers compilation of:
// - /page/index.tsx
// - Components used by /page
// - Dependencies of those components

// Other routes remain uncompiled
```

## Development Workflow

### Start Development Server

```bash
# With Turbopack
next dev --turbo

# Output
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
event - compiled client and server successfully in 1.2s (TurboPack)
```

### Hot Module Replacement

Turbopack provides faster HMR than Webpack:

```javascript
// Edit component
export default function Page() {
  return <div>Hello World</div>
}

// Save file
// HMR update in ~10ms
```

### Error Handling

Turbopack shows errors in overlay:

```javascript
// Syntax error
export default function Page() {
  return <div>Hello World{/* Missing closing tag
}

// Error overlay appears
// Shows file, line number, and error message
```

## Production Builds

### Experimental Production Support

```bash
# Next.js 14+
next build --turbo

# Still experimental, use with caution
```

### Build Output

```bash
next build --turbo

Route (app)                              Size     First Load JS
┌ ○ /                                    5.2 kB          87 kB
├ ○ /about                               137 B          85.1 kB
└ ○ /contact                             652 B          85.6 kB

○  (Static)  automatically rendered as static HTML
```

### Production Optimizations

- Tree shaking
- Minification
- Code splitting
- Asset optimization
- Bundle analysis

## Debugging

### Verbose Output

```bash
# Enable debug logging
TURBOPACK_DEBUG=1 next dev --turbo

# Output includes:
# - Compilation events
# - Cache hits/misses
# - Module resolution
# - Performance metrics
```

### Trace Logging

```bash
# Generate trace file
TURBOPACK_TRACE=1 next dev --turbo

# Analyze trace
# Open chrome://tracing in Chrome
# Load .next/trace file
```

### Performance Profiling

```javascript
// next.config.js
module.exports = {
  experimental: {
    turbo: {
      trace: './trace.json',
    },
  },
}
```

## Common Issues

### Issue: Module Not Found

```bash
# Error
Module not found: Can't resolve '@/components/Header'

# Solution
module.exports = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@': './src',
      },
    },
  },
}
```

### Issue: Loader Not Working

```bash
# Error
Loader error: Unknown file type .svg

# Solution
module.exports = {
  experimental: {
    turbo: {
      loaders: {
        '.svg': ['@svgr/webpack'],
      },
    },
  },
}
```

### Issue: Slow Initial Build

```bash
# Clear cache
rm -rf .next

# Restart dev server
next dev --turbo
```

### Issue: Memory Issues

```javascript
// Increase memory limit
module.exports = {
  experimental: {
    turbo: {
      memoryLimit: 8192, // 8GB
    },
  },
}
```

## Best Practices

### 1. Use Turbopack for Development

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start"
  }
}
```

### 2. Configure Aliases

```javascript
module.exports = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@': './src',
        '@components': './src/components',
        '@utils': './src/utils',
        '@hooks': './src/hooks',
      },
    },
  },
}
```

### 3. Minimize Custom Loaders

```javascript
// Use native features when possible
// Avoid custom webpack loaders if Turbopack supports it natively
```

### 4. Monitor Performance

```bash
# Regular profiling
TURBOPACK_TRACE=1 next dev --turbo

# Check metrics periodically
```

### 5. Keep Next.js Updated

```bash
# Update to latest Next.js
npm install next@latest react@latest react-dom@latest

# Check Turbopack improvements
```

## Advanced Configuration

### Custom Webpack Loaders

```javascript
module.exports = {
  experimental: {
    turbo: {
      loaders: {
        // MDX
        '.mdx': [
          {
            loader: '@mdx-js/loader',
            options: {
              providerImportSource: '@mdx-js/react',
            },
          },
        ],

        // YAML
        '.yaml': ['yaml-loader'],

        // CSV
        '.csv': ['csv-loader'],
      },
    },
  },
}
```

### Environment-Specific Configuration

```javascript
module.exports = {
  experimental: {
    turbo: {
      resolveAlias: {
        // Different aliases for dev/prod
        '@': process.env.NODE_ENV === 'production'
          ? './dist'
          : './src',
      },
    },
  },
}
```

## Roadmap

### Current Status (Next.js 14)

- ✅ Development mode: Stable
- ⚠️ Production mode: Beta
- 🔄 Plugin ecosystem: Growing

### Future Plans

- Full production stability
- Extended webpack plugin support
- Improved loader compatibility
- Better error messages
- Enhanced debugging tools

## Migration Guide

### From Webpack to Turbopack

1. **Update package.json:**
```json
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}
```

2. **Migrate webpack config:**
```javascript
// next.config.js
module.exports = {
  experimental: {
    turbo: {
      // Add Turbopack config here
    },
  },

  // Keep webpack config for production
  webpack: (config) => {
    // Fallback for production builds
    return config
  },
}
```

3. **Test thoroughly:**
```bash
# Test development
npm run dev

# Test production
npm run build
npm start
```

4. **Update dependencies:**
```bash
# Remove webpack-specific packages
npm uninstall webpack-specific-loader

# Add Turbopack-compatible alternatives
npm install turbopack-compatible-loader
```

## Resources

- [Turbopack Documentation](https://turbo.build/pack)
- [Next.js Turbopack Guide](https://nextjs.org/docs/architecture/turbopack)
- [Turbopack GitHub](https://github.com/vercel/turbo)
- [Migration Guide](https://turbo.build/pack/docs/migrating-from-webpack)
