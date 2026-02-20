# Turbopack Configuration

Turbopack is Next.js's new bundler built in Rust, designed to be the successor to webpack. It provides faster development builds and hot module replacement.

## Enabling Turbopack

### Development Mode

```bash
# Enable Turbopack in development
next dev --turbo
```

Or in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "dev:webpack": "next dev"
  }
}
```

## Turbopack Configuration in next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      // Turbopack-specific options
    },
  },
}

module.exports = nextConfig
```

## Current Status

Turbopack is currently in **beta** and supports:
- Fast Refresh (HMR)
- CSS/SCSS/CSS Modules
- TypeScript
- Static assets
- Dynamic imports
- App Router and Pages Router
- Image optimization
- Font optimization
- Environment variables

## Turbopack Options

### Module Resolution

```javascript
const nextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@components': './components',
        '@lib': './lib',
        '@utils': './utils',
      },
    },
  },
}
```

### Webpack Loaders (Limited Support)

Turbopack has limited support for webpack loaders:

```javascript
const nextConfig = {
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

### Resolve Extensions

```javascript
const nextConfig = {
  experimental: {
    turbo: {
      resolveExtensions: [
        '.mdx',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.mjs',
        '.json',
      ],
    },
  },
}
```

## Loader Support

### Supported Loaders

Currently limited webpack loader support. Some loaders work:

```javascript
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.md': {
          loaders: ['raw-loader'],
          as: '*.js',
        },
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
}
```

### Unsupported Features

Some webpack features are not yet supported:
- Custom webpack plugins
- Module federation
- Some advanced webpack loaders
- Webpack-specific configuration

## Complete Example

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      // Module aliases
      resolveAlias: {
        '@': './',
        '@components': './components',
        '@lib': './lib',
        '@utils': './utils',
        '@styles': './styles',
      },

      // File extensions
      resolveExtensions: [
        '.mdx',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.mjs',
        '.json',
      ],

      // Webpack loaders (limited)
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
        '*.md': {
          loaders: ['raw-loader'],
          as: '*.js',
        },
      },
    },
  },
}

module.exports = nextConfig
```

## Environment Variables

Turbopack supports all Next.js environment variable features:

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
DATABASE_URL=postgresql://...
```

Works the same as webpack:

```javascript
const apiUrl = process.env.NEXT_PUBLIC_API_URL
const dbUrl = process.env.DATABASE_URL // Server-side only
```

## CSS and Styling

### CSS Modules

```javascript
// Automatic support
import styles from './Component.module.css'
```

### Global CSS

```javascript
// app/layout.tsx or pages/_app.tsx
import './globals.css'
```

### SCSS/SASS

```bash
npm install sass
```

```javascript
import './styles.scss'
import styles from './Component.module.scss'
```

### CSS-in-JS

Most CSS-in-JS libraries work with Turbopack:

```javascript
// styled-components, emotion, etc.
import styled from 'styled-components'
```

## Static Assets

Import images and other static assets:

```javascript
import logo from './logo.png'
import data from './data.json'

export default function Component() {
  return <img src={logo.src} alt="Logo" />
}
```

## TypeScript Support

Full TypeScript support out of the box:

```typescript
// No special configuration needed
import type { NextPage } from 'next'

const Page: NextPage = () => {
  return <div>TypeScript works!</div>
}
```

## Performance Comparison

Typical improvements with Turbopack:
- **Cold start**: Up to 10x faster than webpack
- **Hot updates**: Up to 700x faster than webpack
- **Large apps**: Greater improvements with scale

## Migration from Webpack

### Gradual Migration

You can use both:

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "dev:webpack": "next dev",
    "build": "next build"
  }
}
```

Note: Production builds still use webpack (for now).

### Checking Compatibility

```bash
# Test with Turbopack
next dev --turbo

# If issues, fallback to webpack
next dev
```

## Common Patterns

### Aliases Configuration

```javascript
const path = require('path')

const nextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@': path.resolve(__dirname),
        '@components': path.resolve(__dirname, 'components'),
        '@lib': path.resolve(__dirname, 'lib'),
        '@utils': path.resolve(__dirname, 'utils'),
        '@public': path.resolve(__dirname, 'public'),
      },
    },
  },
}
```

### SVG as Components

```javascript
const nextConfig = {
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

Usage:

```javascript
import Logo from './logo.svg'

export default function Header() {
  return <Logo />
}
```

### MDX Support

```javascript
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.mdx': {
          loaders: [
            {
              loader: '@mdx-js/loader',
              options: {
                // MDX options
              },
            },
          ],
          as: '*.js',
        },
      },
    },
  },
}
```

## Debugging

### Verbose Logging

```bash
# Enable verbose logging
NEXT_TURBOPACK_LOG=1 next dev --turbo
```

### Trace Logging

```bash
# More detailed traces
NEXT_TURBOPACK_TRACING=1 next dev --turbo
```

## Best Practices

1. **Test in development**: Try `--turbo` flag in dev
2. **Report issues**: Turbopack is in beta, report bugs
3. **Keep it simple**: Complex webpack configs may not work
4. **Use aliases**: Better than relative imports
5. **Check compatibility**: Not all webpack features supported
6. **Gradual adoption**: Keep webpack as fallback

## Current Limitations

As of Next.js 15:

1. **Production builds**: Still use webpack
2. **Webpack plugins**: Not supported
3. **Module federation**: Not supported
4. **Some loaders**: Limited support
5. **Custom webpack config**: Only partial support

## Fallback to Webpack

If you need webpack-specific features:

```javascript
const nextConfig = {
  webpack: (config, { dev }) => {
    // Webpack config (used when not using --turbo)
    return config
  },

  // Turbopack config (used with --turbo)
  experimental: {
    turbo: {
      // Turbopack config
    },
  },
}
```

## When to Use Turbopack

**Use Turbopack when:**
- You want faster development builds
- Your app doesn't need complex webpack config
- You're using standard Next.js features
- You want faster HMR

**Stick with Webpack when:**
- You need custom webpack plugins
- You're using module federation
- You need production builds
- You have complex webpack configuration

## Future Outlook

Turbopack roadmap:
- Production build support
- More webpack loader support
- Full webpack plugin compatibility
- Improved performance
- Stability improvements

## Testing Your App with Turbopack

```bash
# 1. Try development with Turbopack
next dev --turbo

# 2. If it works, update package.json
{
  "scripts": {
    "dev": "next dev --turbo"
  }
}

# 3. Keep webpack as backup
{
  "scripts": {
    "dev": "next dev --turbo",
    "dev:webpack": "next dev"
  }
}
```

## Common Issues

### Module Not Found

```javascript
// Add alias
experimental: {
  turbo: {
    resolveAlias: {
      'problematic-module': './path/to/module',
    },
  },
}
```

### Loader Not Working

```javascript
// Check if loader is supported
// Fallback to webpack if needed
```

### Slow HMR

```bash
# Clear .next directory
rm -rf .next
next dev --turbo
```

## Resources

- [Next.js Turbopack Documentation](https://nextjs.org/docs/architecture/turbopack)
- [Turbopack GitHub](https://github.com/vercel/turbo)
- [Turbopack Benchmarks](https://turbo.build/pack/docs/benchmarks)
