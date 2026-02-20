# instrumentation.ts

The `instrumentation.js` file is used to integrate observability tools into your application. It allows you to track performance and behavior, and to debug issues in production.

## File Location

Place the instrumentation file at the root of your project:

```
project/
├── instrumentation.ts  ✅ Root of project
├── app/
└── src/
    └── instrumentation.ts  ✅ Or in src/ if using src directory
```

## File Signature

```ts
// instrumentation.ts
export async function register() {
  // Initialization code
}
```

## Enabling Instrumentation

Add the experimental flag to `next.config.js`:

```js
// next.config.js
module.exports = {
  experimental: {
    instrumentationHook: true,
  },
}
```

## Register Function

The `register` function is called once when the Next.js server starts.

```ts
// instrumentation.ts
export async function register() {
  console.log('Server starting...')
  // Initialize monitoring, logging, etc.
}
```

## Examples

### Basic Instrumentation

```ts
// instrumentation.ts
export async function register() {
  console.log('Instrumentation initialized')
}
```

### OpenTelemetry Integration

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerOTel } = await import('@vercel/otel')
    await registerOTel('my-app')
  }
}
```

### Sentry Integration

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs')

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
      environment: process.env.NODE_ENV,
    })
  }
}
```

### DataDog Integration

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const tracer = await import('dd-trace')

    tracer.init({
      service: 'my-nextjs-app',
      env: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
    })
  }
}
```

### Custom Monitoring

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const monitoring = await import('./lib/monitoring')

    monitoring.init({
      appName: 'my-app',
      environment: process.env.NODE_ENV,
      apiKey: process.env.MONITORING_API_KEY,
    })

    console.log('Monitoring initialized')
  }
}
```

### Performance Monitoring

```ts
// instrumentation.ts
import { PerformanceObserver } from 'perf_hooks'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log(`${entry.name}: ${entry.duration}ms`)
      }
    })

    obs.observe({ entryTypes: ['measure', 'function'] })
  }
}
```

### Database Instrumentation

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeDatabase } = await import('./lib/db')

    await initializeDatabase()
    console.log('Database connection pool initialized')
  }
}
```

### Custom Logger

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { createLogger } = await import('./lib/logger')

    global.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: 'json',
    })

    global.logger.info('Application starting')
  }
}
```

### Feature Flags

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeFeatureFlags } = await import('./lib/feature-flags')

    await initializeFeatureFlags({
      apiKey: process.env.FEATURE_FLAGS_KEY,
      environment: process.env.NODE_ENV,
    })

    console.log('Feature flags initialized')
  }
}
```

### Error Tracking

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ErrorTracker } = await import('./lib/error-tracker')

    const tracker = new ErrorTracker({
      apiKey: process.env.ERROR_TRACKING_KEY,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    })

    process.on('unhandledRejection', (error) => {
      tracker.captureException(error)
    })

    process.on('uncaughtException', (error) => {
      tracker.captureException(error)
    })
  }
}
```

### Multiple Services

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Parallel initialization
    await Promise.all([
      initializeSentry(),
      initializeDatadog(),
      initializeDatabase(),
    ])

    console.log('All services initialized')
  }
}

async function initializeSentry() {
  const Sentry = await import('@sentry/nextjs')
  Sentry.init({ dsn: process.env.SENTRY_DSN })
}

async function initializeDatadog() {
  const tracer = await import('dd-trace')
  tracer.init({ service: 'my-app' })
}

async function initializeDatabase() {
  const { Pool } = await import('pg')
  const pool = new Pool()
  await pool.connect()
}
```

### Conditional Instrumentation

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only in production
    if (process.env.NODE_ENV === 'production') {
      const Sentry = await import('@sentry/nextjs')
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1, // Sample 10% of transactions
      })
    }

    // Always run
    const { initializeCache } = await import('./lib/cache')
    await initializeCache()
  }
}
```

### Edge Runtime Check

```ts
// instrumentation.ts
export async function register() {
  console.log('Runtime:', process.env.NEXT_RUNTIME)

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js specific instrumentation
    const monitoring = await import('./lib/node-monitoring')
    await monitoring.init()
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime specific instrumentation
    console.log('Edge runtime detected')
  }
}
```

## Runtime Environment

Check the runtime environment to conditionally load Node.js-specific packages:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Safe to import Node.js-only packages
    const fs = await import('fs')
    const path = await import('path')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime - no Node.js APIs
  }
}
```

## Typing

```ts
export async function register(): Promise<void> {
  // Initialization code
}
```

## Environment Variables

Access environment variables in instrumentation:

```ts
export async function register() {
  const config = {
    apiKey: process.env.API_KEY,
    environment: process.env.NODE_ENV,
    debug: process.env.DEBUG === 'true',
  }

  console.log('Config:', config)
}
```

## Error Handling

```ts
export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      const monitoring = await import('./lib/monitoring')
      await monitoring.init()
      console.log('Monitoring initialized successfully')
    }
  } catch (error) {
    console.error('Failed to initialize monitoring:', error)
    // Don't throw - allow app to start even if monitoring fails
  }
}
```

## Best Practices

### 1. Check Runtime

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js only code
  }
}
```

### 2. Handle Errors Gracefully

```ts
export async function register() {
  try {
    await initializeMonitoring()
  } catch (error) {
    console.error('Monitoring initialization failed:', error)
    // Don't crash the app
  }
}
```

### 3. Use Dynamic Imports

```ts
export async function register() {
  // ✅ Good - dynamic import
  const Sentry = await import('@sentry/nextjs')

  // ❌ Bad - top-level import
  // import * as Sentry from '@sentry/nextjs'
}
```

### 4. Environment-Specific Logic

```ts
export async function register() {
  if (process.env.NODE_ENV === 'production') {
    // Production-only instrumentation
  }

  if (process.env.NODE_ENV === 'development') {
    // Development-only tools
  }
}
```

## Common Use Cases

1. **Observability Tools** - Sentry, DataDog, New Relic
2. **Performance Monitoring** - OpenTelemetry, custom metrics
3. **Database Initialization** - Connection pools, migrations
4. **Cache Warming** - Preload critical data
5. **Feature Flags** - Initialize feature flag services
6. **Error Tracking** - Global error handlers
7. **Logging** - Configure logging libraries
8. **Authentication** - Initialize auth providers

## Limitations

- Only runs once when the server starts
- Does not run on every request
- Cannot access request/response objects
- Should not be used for request-level instrumentation (use middleware instead)

## Version History

- **v14.0.4**: `instrumentation.js` introduced (experimental)

## Good to Know

- Requires `instrumentationHook: true` in `next.config.js`
- Runs once on server startup
- Must be at project root or in `src/`
- Check `NEXT_RUNTIME` to differentiate Node.js and Edge
- Use dynamic imports for Node.js-specific packages
- Handle errors gracefully - don't crash the app
- Runs before any routes are matched
- Ideal for initializing monitoring, logging, and observability tools
- Can access environment variables
- Cannot access request/response - use middleware for that
