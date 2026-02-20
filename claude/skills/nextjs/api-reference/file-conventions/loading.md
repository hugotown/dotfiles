# loading.js / loading.tsx

A loading file creates instant loading states that are displayed while a route segment's content is loading. The loading state appears immediately from the server while the content is being fetched.

## File Signature

```tsx
// app/loading.tsx
export default function Loading() {
  return <div>Loading...</div>
}
```

## How It Works

Loading UI is automatically wrapped in a React Suspense boundary. When the route segment loads:

1. Server renders `loading.tsx` immediately
2. Client shows loading UI instantly
3. Once content is ready, loading UI is replaced with the actual content

```tsx
// Automatic wrapping by Next.js
<Layout>
  <Suspense fallback={<Loading />}>
    <Page />
  </Suspense>
</Layout>
```

## Props

Loading components do not receive any props.

```tsx
export default function Loading() {
  // No props
  return <LoadingSpinner />
}
```

## Examples

### Basic Loading Spinner

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="spinner" />
    </div>
  )
}
```

### Skeleton Loading UI

```tsx
// app/blog/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
```

### Loading with Layout

```tsx
// app/products/loading.tsx
export default function Loading() {
  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="border rounded p-4">
            <div className="h-40 bg-gray-200 rounded mb-4 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Custom Loading Component

```tsx
// app/loading.tsx
import { Spinner } from '@/components/spinner'

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80">
      <Spinner size="lg" />
    </div>
  )
}
```

### Loading with Progress Bar

```tsx
// app/loading.tsx
'use client'

import { useEffect, useState } from 'react'

export default function Loading() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90
        return prev + 10
      })
    }, 200)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200">
      <div
        className="h-full bg-blue-500 transition-all duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
```

### Loading for Specific Route Segment

```tsx
// app/dashboard/analytics/loading.tsx
export default function AnalyticsLoading() {
  return (
    <div>
      <h1 className="text-2xl mb-4">Analytics Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  )
}
```

### Loading with Text

```tsx
// app/posts/loading.tsx
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-gray-600">Loading posts...</p>
    </div>
  )
}
```

### Minimal Loading

```tsx
// app/loading.tsx
export default function Loading() {
  return null // Shows nothing while loading
}
```

## Nested Loading States

Loading states apply to their route segment and all children (nested routes and layouts).

```
app/
├── loading.tsx           # Applies to all routes
└── dashboard/
    ├── loading.tsx       # Applies to /dashboard and nested routes
    └── settings/
        └── loading.tsx   # Applies only to /dashboard/settings
```

## Using with Streaming

Loading UI works with React Suspense and streaming:

```tsx
// app/page.tsx
import { Suspense } from 'react'
import { PostList } from '@/components/post-list'

export default function Page() {
  return (
    <div>
      <h1>Blog</h1>
      <Suspense fallback={<div>Loading posts...</div>}>
        <PostList />
      </Suspense>
    </div>
  )
}
```

## Manual Suspense Boundaries

For more granular loading states, use Suspense directly:

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { Analytics } from './analytics'
import { RecentActivity } from './recent-activity'

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <Suspense fallback={<div>Loading analytics...</div>}>
        <Analytics />
      </Suspense>

      <Suspense fallback={<div>Loading activity...</div>}>
        <RecentActivity />
      </Suspense>
    </div>
  )
}
```

## Best Practices

### Match Layout Structure

```tsx
// app/products/loading.tsx
// Matches the layout of app/products/page.tsx
export default function Loading() {
  return (
    <div className="container mx-auto">
      <div className="h-10 bg-gray-200 rounded w-1/4 mb-4 animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function ProductCardSkeleton() {
  return (
    <div className="border rounded p-4">
      <div className="aspect-square bg-gray-200 rounded mb-2 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
    </div>
  )
}
```

## TypeScript

```tsx
export default function Loading(): JSX.Element {
  return <div>Loading...</div>
}
```

## Version History

- **v13.0.0**: App Router introduced with loading.js convention
- **v13.4.0**: App Router stable

## Good to Know

- Loading UI is shown instantly while content is fetching
- Automatically wrapped in Suspense boundary
- Can be Server or Client Components
- Does not receive any props
- Applies to the route segment and all nested segments
- Navigation shows loading UI for the target route
- Layouts remain interactive during loading
- `.js`, `.jsx`, or `.tsx` file extensions can be used
- Rendered inside the layout at the same level
- Does not affect static rendering - only shows during dynamic requests
