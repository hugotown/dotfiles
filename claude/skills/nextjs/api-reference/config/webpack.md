# Webpack Configuration

Next.js allows you to customize the webpack configuration for advanced use cases. Configure webpack in `next.config.js`.

## Basic Webpack Configuration

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Modify config here

    // Important: return the modified config
    return config
  },
}

module.exports = nextConfig
```

## Webpack Function Parameters

```typescript
webpack: (
  config: object,        // Webpack config object
  options: {
    buildId: string,     // Unique build identifier
    dev: boolean,        // true in development
    isServer: boolean,   // true for server build
    defaultLoaders: {    // Default Next.js loaders
      babel: object
    },
    nextRuntime?: 'edge' | 'nodejs',  // Runtime type
    webpack: object      // Webpack instance
  }
) => config
```

## Common Webpack Customizations

### Adding Plugins

```javascript
webpack: (config, { webpack }) => {
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.CUSTOM_VAR': JSON.stringify(process.env.CUSTOM_VAR),
    })
  )

  return config
}
```

### Adding Loaders

```javascript
webpack: (config) => {
  config.module.rules.push({
    test: /\.md$/,
    use: 'raw-loader',
  })

  return config
}
```

### Modifying Existing Rules

```javascript
webpack: (config) => {
  // Find and modify existing rule
  const fileLoaderRule = config.module.rules.find((rule) =>
    rule.test?.test?.('.svg')
  )

  if (fileLoaderRule) {
    fileLoaderRule.exclude = /\.svg$/
  }

  config.module.rules.push({
    test: /\.svg$/,
    use: ['@svgr/webpack'],
  })

  return config
}
```

### Aliasing Modules

```javascript
webpack: (config) => {
  config.resolve.alias = {
    ...config.resolve.alias,
    '@components': path.resolve(__dirname, 'components'),
    '@lib': path.resolve(__dirname, 'lib'),
    '@utils': path.resolve(__dirname, 'utils'),
  }

  return config
}
```

### Ignoring Modules

```javascript
webpack: (config, { isServer, webpack }) => {
  if (isServer) {
    // Ignore client-side modules on server
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      })
    )
  }

  return config
}
```

## Environment-Specific Configuration

### Development Only

```javascript
webpack: (config, { dev }) => {
  if (dev) {
    // Development-only configuration
    config.devtool = 'eval-source-map'
  }

  return config
}
```

### Production Only

```javascript
webpack: (config, { dev }) => {
  if (!dev) {
    // Production-only configuration
    config.optimization.minimize = true
  }

  return config
}
```

### Server vs Client

```javascript
webpack: (config, { isServer }) => {
  if (isServer) {
    // Server-side configuration
    config.externals = [...config.externals, 'canvas']
  } else {
    // Client-side configuration
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
  }

  return config
}
```

## Common Patterns

### SVG as React Components

```javascript
webpack: (config) => {
  // Exclude SVG from default handling
  const fileLoaderRule = config.module.rules.find((rule) =>
    rule.test?.test?.('.svg')
  )

  config.module.rules.push(
    {
      ...fileLoaderRule,
      test: /\.svg$/i,
      resourceQuery: /url/, // *.svg?url
    },
    {
      test: /\.svg$/i,
      issuer: fileLoaderRule.issuer,
      resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
      use: ['@svgr/webpack'],
    }
  )

  fileLoaderRule.exclude = /\.svg$/i

  return config
}
```

Usage:

```javascript
import Logo from './logo.svg'           // React component
import logoUrl from './logo.svg?url'    // URL string
```

### MDX Support

```javascript
webpack: (config) => {
  config.module.rules.push({
    test: /\.mdx$/,
    use: [
      {
        loader: '@mdx-js/loader',
        options: {
          // MDX options
        },
      },
    ],
  })

  return config
}
```

### YAML/TOML Support

```javascript
webpack: (config) => {
  config.module.rules.push(
    {
      test: /\.ya?ml$/,
      use: 'yaml-loader',
    },
    {
      test: /\.toml$/,
      use: 'toml-loader',
    }
  )

  return config
}
```

### Polyfills for Node Modules

```javascript
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
    }

    config.plugins.push(
      new config.webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      })
    )
  }

  return config
}
```

### Bundle Analyzer

```javascript
webpack: (config, { isServer }) => {
  if (process.env.ANALYZE === 'true') {
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

    config.plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: isServer
          ? '../analyze/server.html'
          : './analyze/client.html',
      })
    )
  }

  return config
}
```

### Source Maps

```javascript
webpack: (config, { dev }) => {
  if (dev) {
    config.devtool = 'eval-source-map'
  } else {
    config.devtool = 'source-map'
  }

  return config
}
```

### Module Federation

```javascript
webpack: (config, { isServer, webpack }) => {
  if (!isServer) {
    config.plugins.push(
      new webpack.container.ModuleFederationPlugin({
        name: 'app',
        remotes: {
          remote: 'remote@http://localhost:3001/remoteEntry.js',
        },
        shared: {
          react: { singleton: true, eager: true },
          'react-dom': { singleton: true, eager: true },
        },
      })
    )
  }

  return config
}
```

## Webpack Plugins

### Define Plugin

```javascript
webpack: (config, { webpack }) => {
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
      'process.env.BUILD_ID': JSON.stringify(buildId),
    })
  )

  return config
}
```

### Progress Plugin

```javascript
webpack: (config, { webpack, dev }) => {
  if (dev) {
    config.plugins.push(new webpack.ProgressPlugin())
  }

  return config
}
```

### Copy Webpack Plugin

```javascript
webpack: (config) => {
  const CopyPlugin = require('copy-webpack-plugin')

  config.plugins.push(
    new CopyPlugin({
      patterns: [
        {
          from: 'public/static',
          to: 'static',
        },
      ],
    })
  )

  return config
}
```

### ESBuild Loader (Speed Up Builds)

```javascript
webpack: (config) => {
  config.module.rules.push({
    test: /\.(js|jsx|ts|tsx)$/,
    exclude: /node_modules/,
    use: {
      loader: 'esbuild-loader',
      options: {
        loader: 'tsx',
        target: 'es2017',
      },
    },
  })

  return config
}
```

## Complete Examples

### Full Production Configuration

```javascript
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      '@components': path.resolve(__dirname, 'components'),
      '@lib': path.resolve(__dirname, 'lib'),
    }

    // SVG handling
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg')
    )

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
        use: ['@svgr/webpack'],
      }
    )

    fileLoaderRule.exclude = /\.svg$/i

    // Environment variables
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
      })
    )

    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
            },
          },
        },
      }
    }

    // Server-side externals
    if (isServer) {
      config.externals = [...config.externals, 'canvas', 'jsdom']
    }

    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
        })
      )
    }

    return config
  },
}

module.exports = nextConfig
```

### Monorepo Configuration

```javascript
const path = require('path')

module.exports = {
  webpack: (config, { isServer }) => {
    // Transpile packages in monorepo
    config.module.rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      include: [
        path.resolve(__dirname, '../packages'),
      ],
      use: defaultLoaders.babel,
    })

    // Alias packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@myorg/shared': path.resolve(__dirname, '../packages/shared'),
      '@myorg/ui': path.resolve(__dirname, '../packages/ui'),
    }

    return config
  },
}
```

## Best Practices

1. **Always return config**: Don't forget to return the modified config
2. **Check isServer**: Different configs for client/server
3. **Use spread operator**: Preserve existing config
4. **Test both builds**: Dev and production behave differently
5. **Document changes**: Add comments explaining why
6. **Avoid breaking changes**: Test thoroughly
7. **Use webpack instance**: Access via options parameter

## Common Issues

### Config Not Applied

```javascript
// Bad: Not returning config
webpack: (config) => {
  config.resolve.alias = { ... }
  // Missing return!
}

// Good: Return config
webpack: (config) => {
  config.resolve.alias = { ... }
  return config
}
```

### Module Not Found

```javascript
// Add fallback for Node modules
config.resolve.fallback = {
  ...config.resolve.fallback,
  fs: false,
}
```

### Infinite Reload in Dev

```javascript
// Check if modification is causing webpack to rebuild
webpack: (config, { dev }) => {
  if (dev) {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules', '**/.git'],
    }
  }
  return config
}
```

## Debugging Webpack Config

```javascript
webpack: (config, { dev, isServer }) => {
  // Log config in development
  if (dev) {
    console.log('Webpack config:', JSON.stringify(config, null, 2))
    console.log('Is server:', isServer)
  }

  return config
}
```

## Performance Tips

1. **Use SWC instead of Babel**: Next.js uses SWC by default
2. **Minimize plugins**: Only add what you need
3. **Use caching**: Enable webpack caching
4. **Lazy load**: Use dynamic imports
5. **Analyze bundles**: Use bundle analyzer to find issues

## Migration from Webpack 4 to 5

Next.js 11+ uses Webpack 5 by default. If you have custom webpack config:

```javascript
// Webpack 5 requires explicit polyfills
config.resolve.fallback = {
  ...config.resolve.fallback,
  fs: false,
  net: false,
  tls: false,
}
```
