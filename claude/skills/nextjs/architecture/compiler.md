# Next.js Compiler

## Overview

Next.js uses SWC (Speedy Web Compiler), a Rust-based compiler that is ~17x faster than Babel for compilation and ~3x faster for Fast Refresh. The compiler handles transformations, minification, and optimizations during both development and production builds.

## Architecture

### Core Components

1. **SWC Core**: Rust-based parser and transformer
2. **Transform Pipeline**: Series of code transformations
3. **Minifier**: Production code optimization
4. **Source Maps**: Debugging support

### Compilation Flow

```
Source Code → Parse (SWC) → Transform → Minify → Bundle → Output
```

## Key Features

### 1. JavaScript/TypeScript Compilation

The compiler handles all JS/TS transformations:

```typescript
// TypeScript with decorators
@Injectable()
class Service {
  async getData(): Promise<Data> {
    return fetch('/api/data');
  }
}

// Compiled to optimized JavaScript
```

**Configuration:**
```javascript
// next.config.js
module.exports = {
  swcMinify: true, // Enable SWC minifier (default in Next.js 13+)
  compiler: {
    // Remove console logs in production
    removeConsole: {
      exclude: ['error'],
    },
  },
}
```

### 2. JSX/React Transformations

Automatic JSX transformation without React import:

```jsx
// Before: Required React import
import React from 'react'

// After: Automatic with SWC
export default function Page() {
  return <div>Hello World</div>
}
```

**Configuration:**
```javascript
module.exports = {
  compiler: {
    reactRemoveProperties: {
      // Remove data-test attributes in production
      properties: ['^data-test'],
    },
  },
}
```

### 3. Styled Components & Emotion Support

Built-in CSS-in-JS support:

```javascript
// next.config.js
module.exports = {
  compiler: {
    styledComponents: {
      displayName: true,
      ssr: true,
      fileName: true,
      meaninglessFileNames: ['index'],
      namespace: 'my-app',
      topLevelImportPaths: [],
      transpileTemplateLiterals: true,
      minify: true,
      pure: true,
    },
  },
}
```

**Emotion configuration:**
```javascript
module.exports = {
  compiler: {
    emotion: {
      sourceMap: true,
      autoLabel: 'dev-only',
      labelFormat: '[local]',
    },
  },
}
```

### 4. Minification

SWC-based minification for smaller bundles:

```javascript
module.exports = {
  swcMinify: true, // Default in Next.js 13+

  // Advanced minification options
  compiler: {
    // Remove all console statements
    removeConsole: true,

    // Or selectively remove
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
}
```

### 5. Module Transforms

Common module transformations:

```javascript
module.exports = {
  compiler: {
    // Relay support
    relay: {
      src: './',
      artifactDirectory: './__generated__',
      language: 'typescript',
    },

    // Remove React properties
    reactRemoveProperties: true,

    // Legacy decorators
    legacyDecorators: true,
  },
}
```

## Performance Optimizations

### 1. Parallel Compilation

The compiler automatically uses multiple CPU cores:

```bash
# Development
next dev
# Automatically uses available cores

# Production
next build
# Parallel compilation enabled by default
```

### 2. Incremental Compilation

Only changed files are recompiled:

```javascript
// next.config.js
module.exports = {
  // Incremental compilation cache
  experimental: {
    incrementalCacheHandlerPath: './cache-handler.js',
  },
}
```

### 3. Tree Shaking

Automatic dead code elimination:

```javascript
// utils.js
export const used = () => 'used'
export const unused = () => 'unused'

// page.js
import { used } from './utils'
// 'unused' is automatically removed from bundle
```

## Source Maps

Configure source map generation:

```javascript
// next.config.js
module.exports = {
  productionBrowserSourceMaps: true, // Enable in production

  // Development source maps are always enabled
}
```

**Types of source maps:**
- **Development**: Full inline source maps
- **Production**: External source maps (optional)

## Custom Transforms

### Using SWC Plugins

```javascript
// next.config.js
module.exports = {
  experimental: {
    swcPlugins: [
      ['@swc/plugin-styled-components', {}],
      ['@swc/plugin-relay', {}],
    ],
  },
}
```

### Writing Custom Plugins

SWC plugins are written in Rust:

```rust
// Example SWC plugin structure
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};
use swc_core::ecma::ast::Program;

#[plugin_transform]
pub fn process_transform(program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    // Transform logic here
    program
}
```

## TypeScript Configuration

### Compiler Options

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Type Checking

```bash
# Type check only (no compilation)
tsc --noEmit

# Type check in watch mode
tsc --noEmit --watch

# Next.js ignores TypeScript errors in production by default
# To enforce type checking:
```

```javascript
// next.config.js
module.exports = {
  typescript: {
    ignoreBuildErrors: false, // Fail build on TypeScript errors
  },
}
```

## Debugging Compiler Issues

### 1. Verbose Output

```bash
# Enable verbose build output
NEXT_DEBUG_BUILD=1 next build

# Debug SWC compilation
SWC_DEBUG=1 next dev
```

### 2. Compilation Errors

Common issues and solutions:

**SWC Parse Error:**
```
Error: Failed to parse
```
- Check syntax errors in files
- Ensure proper file extensions (.js, .ts, .tsx)
- Verify TypeScript configuration

**Minification Failure:**
```
Error: Minification failed
```
- Disable minification temporarily: `swcMinify: false`
- Check for syntax errors
- Update to latest Next.js version

### 3. Performance Profiling

```bash
# Profile build performance
NEXT_PROFILE=1 next build

# Analyze compilation time
NEXT_PROFILE_BUILD_TIME=1 next build
```

## Comparison: SWC vs Babel

| Feature | SWC | Babel |
|---------|-----|-------|
| **Language** | Rust | JavaScript |
| **Speed** | ~17x faster | Baseline |
| **Minification** | Built-in | Requires plugin |
| **Plugin Ecosystem** | Growing | Extensive |
| **Memory Usage** | Lower | Higher |
| **Default in Next.js** | Yes (13+) | Legacy |

## Best Practices

### 1. Use SWC Minifier

```javascript
module.exports = {
  swcMinify: true, // Always enable for better performance
}
```

### 2. Remove Debug Code in Production

```javascript
module.exports = {
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'], // Keep important logs
    },
  },
}
```

### 3. Optimize CSS-in-JS

```javascript
module.exports = {
  compiler: {
    styledComponents: {
      ssr: true, // Enable SSR support
      minify: true, // Minify styles
    },
  },
}
```

### 4. Enable Incremental Compilation

```javascript
module.exports = {
  experimental: {
    incrementalCacheHandlerPath: require.resolve('./cache-handler'),
  },
}
```

### 5. Monitor Build Performance

```bash
# Regular profiling
NEXT_PROFILE=1 next build

# Check for slow compilations
```

## Migration from Babel

If you need Babel for specific plugins:

```javascript
// next.config.js
module.exports = {
  // Create .babelrc to opt-out of SWC
  // Only do this if absolutely necessary
}
```

```json
// .babelrc (only if needed)
{
  "presets": ["next/babel"],
  "plugins": ["your-required-plugin"]
}
```

**Note**: Using Babel disables SWC and significantly slows compilation.

## Advanced Configuration

### Custom SWC Configuration

```javascript
// next.config.js
module.exports = {
  experimental: {
    swcTraceProfiling: true,
    swcFileReading: true,
    swcMinify: true,
  },

  compiler: {
    // All compiler options
    styledComponents: true,
    emotion: true,
    reactRemoveProperties: true,
    removeConsole: true,
    relay: {
      src: './',
      artifactDirectory: './__generated__',
    },
  },
}
```

## Troubleshooting

### Common Issues

**Issue**: Build is slow after upgrading
- **Solution**: Ensure `swcMinify: true` is set
- Check for .babelrc (remove if not needed)
- Clear `.next` cache

**Issue**: Styled-components not working
- **Solution**: Enable styled-components in compiler config
- Ensure SSR is enabled
- Add babel plugin as fallback if needed

**Issue**: Source maps missing
- **Solution**: Enable `productionBrowserSourceMaps: true`

**Issue**: TypeScript errors ignored
- **Solution**: Set `typescript.ignoreBuildErrors: false`

## Resources

- [SWC Documentation](https://swc.rs/)
- [Next.js Compiler Options](https://nextjs.org/docs/architecture/compiler)
- [Minification Guide](https://nextjs.org/docs/advanced-features/compiler)
- [TypeScript Configuration](https://nextjs.org/docs/basic-features/typescript)
