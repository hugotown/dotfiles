# error.js / error.tsx

An error file defines an error UI boundary for a route segment. It's useful for catching unexpected errors that occur in Server Components and Client Components and displaying a fallback UI.

## File Signature

```tsx
// app/error.tsx
'use client' // Error boundaries must be Client Components

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

## Important Requirements

- **MUST** be a Client Component (`'use client'`)
- Automatically wrapped in React Error Boundary
- Isolates errors to affected segments
- Keeps the rest of the application functional

## Props

### error

An instance of the Error object forwarded to the error boundary.

```tsx
error: Error & { digest?: string }
```

**Properties:**
- `error.message` - The error message
- `error.digest` - Auto-generated hash of the error (production only)

```tsx
export default function Error({ error }: { error: Error }) {
  console.error(error)
  return <div>Error: {error.message}</div>
}
```

**Note:** In production, `error.message` is redacted to avoid leaking sensitive details. Use `error.digest` to match error logs.

### reset

A function to reset the error boundary. When executed, it will try to re-render the error boundary's contents.

```tsx
export default function Error({ reset }: { reset: () => void }) {
  return (
    <button onClick={() => reset()}>
      Try again
    </button>
  )
}
```

## How Error Boundaries Work

```tsx
// Automatic wrapping by Next.js
<Layout>
  <ErrorBoundary fallback={<Error />}>
    <Suspense fallback={<Loading />}>
      <Page />
    </Suspense>
  </ErrorBoundary>
</Layout>
```

**Scope:**
- Catches errors in nested routes
- Catches errors in child layouts
- Does NOT catch errors in the same layout
- Does NOT catch errors in the root layout

## Examples

### Basic Error UI

```tsx
// app/dashboard/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Try again
      </button>
    </div>
  )
}
```

### Error with Logging

```tsx
// app/error.tsx
'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Error:', error)
    // logErrorToService(error)
  }, [error])

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

### Detailed Error Page

```tsx
// app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container mx-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            Oops! Something went wrong
          </h1>

          <p className="text-gray-700 mb-4">
            We're sorry, but something unexpected happened.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium">
                Error details
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                {error.message}
              </pre>
            </details>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try again
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Error with Analytics

```tsx
// app/error.tsx
'use client'

import { useEffect } from 'react'
import { trackError } from '@/lib/analytics'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    trackError({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <div>
      <h2>An error occurred</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

### Custom Error for Specific Route

```tsx
// app/dashboard/analytics/error.tsx
'use client'

import { useRouter } from 'next/navigation'

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">
        Failed to load analytics
      </h2>
      <p className="mb-4 text-gray-600">
        There was a problem loading your analytics data.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Retry
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-gray-200 rounded"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
```

## global-error.js

To handle errors in the root layout, use `global-error.js` in the `app` directory.

```tsx
// app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}
```

**Important:**
- `global-error.js` replaces the root layout when active
- MUST define its own `<html>` and `<body>` tags
- Less frequently active than root `error.js`
- Even when active, root `error.js` will handle errors

## Nested Error Boundaries

Error files create nested error boundaries:

```
app/
├── error.tsx              # Catches errors in all routes
└── dashboard/
    ├── error.tsx          # Catches errors in dashboard routes
    └── analytics/
        └── error.tsx      # Catches errors only in analytics
```

## Error Boundary Limitations

**Error boundaries do NOT catch errors in:**
- Event handlers (use try/catch instead)
- Asynchronous code (setTimeout, promises)
- Server-side rendering (use error.js in parent segment)
- Errors thrown in the error boundary itself

## Using with Server Actions

```tsx
// app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isAuthError = error.message.includes('Unauthorized')

  if (isAuthError) {
    return (
      <div>
        <h2>Authentication Error</h2>
        <p>Please log in again.</p>
        <a href="/login">Go to Login</a>
      </div>
    )
  }

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

## TypeScript

```tsx
import type { ErrorProps } from 'next/error'

export default function Error({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Error occurred</h2>
      <button onClick={reset}>Retry</button>
    </div>
  )
}
```

## Version History

- **v13.0.0**: App Router introduced with error.js convention
- **v13.4.0**: App Router stable

## Good to Know

- **MUST** be Client Components
- Errors bubble up to the nearest error boundary
- Error boundaries reset when navigating to a different segment
- `reset()` will attempt to re-render the error boundary
- In production, errors are logged server-side
- Layout errors bubble up to parent error boundary
- Root layout errors are handled by `global-error.js`
- `.js`, `.jsx`, or `.tsx` file extensions can be used
- Error digest helps match client errors with server logs
