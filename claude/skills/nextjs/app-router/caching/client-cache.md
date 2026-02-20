# Client Router Cache

The Client Router Cache is Next.js's client-side cache that stores prefetched and visited routes, providing instant navigation and improved user experience.

## Overview

The Client Router Cache (also called Router Cache) caches React Server Component payloads in the browser's memory. It's automatically managed by Next.js but can be configured to control prefetching behavior and cache duration.

## Default Behavior

### Automatic Caching
- Visited routes are automatically cached
- Prefetched routes are cached when they enter the viewport
- Cache persists for the duration of the session
- Navigating between cached routes is instant

### Cache Duration (Default)
- **Static Routes**: 5 minutes (stale after 30 seconds)
- **Dynamic Routes**: 30 seconds (stale immediately)

## Prefetching Configuration

### Link Component Prefetching

```typescript
import Link from 'next/link'

// Default: Prefetch on viewport enter
<Link href="/products">Products</Link>

// Disable prefetching
<Link href="/products" prefetch={false}>
  Products
</Link>

// Force prefetch immediately
<Link href="/products" prefetch={true}>
  Products
</Link>
```

### Programmatic Prefetching

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function PrefetchOnMount() {
  const router = useRouter()

  useEffect(() => {
    // Prefetch routes on component mount
    router.prefetch('/products')
    router.prefetch('/about')
  }, [router])

  return <div>Content</div>
}
```

### Conditional Prefetching

```typescript
'use client'

import Link from 'next/link'
import { useUser } from '@/hooks/useUser'

export function ConditionalPrefetch() {
  const { user } = useUser()

  return (
    <Link
      href="/dashboard"
      prefetch={user?.isPremium} // Only prefetch for premium users
    >
      Dashboard
    </Link>
  )
}
```

## staleTimes Configuration

Configure how long routes stay fresh in the Client Router Cache:

### Global Configuration

```typescript
// next.config.js
module.exports = {
  experimental: {
    staleTimes: {
      dynamic: 30,    // 30 seconds for dynamic routes
      static: 180     // 180 seconds (3 minutes) for static routes
    }
  }
}
```

### Route-Specific Configuration

```typescript
// app/products/layout.tsx
export const experimental_staleTimes = {
  dynamic: 0,      // Always revalidate dynamic routes
  static: 300      // 5 minutes for static routes
}

export default function ProductsLayout({ children }) {
  return <div>{children}</div>
}
```

### Page-Level Configuration

```typescript
// app/blog/page.tsx
export const experimental_staleTimes = {
  dynamic: 60,     // 1 minute
  static: 600      // 10 minutes
}

export default function BlogPage() {
  return <div>Blog</div>
}
```

## Cache Invalidation

### Router Refresh

```typescript
'use client'

import { useRouter } from 'next/navigation'

export function RefreshButton() {
  const router = useRouter()

  const handleRefresh = () => {
    router.refresh() // Invalidates Client Router Cache
  }

  return <button onClick={handleRefresh}>Refresh</button>
}
```

### Revalidation After Mutation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export function CreateProductForm() {
  const router = useRouter()

  const handleSubmit = async (data: FormData) => {
    await createProduct(data)

    // Refresh to get updated data
    router.refresh()
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

### Force Navigation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export function ForceNavigate() {
  const router = useRouter()

  const navigate = () => {
    // This bypasses cache and fetches fresh
    router.push('/products', { scroll: false })
    router.refresh()
  }

  return <button onClick={navigate}>Go to Products</button>
}
```

## Advanced Patterns

### Smart Prefetching Strategy

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'

export function SmartPrefetch({ href, children }) {
  const router = useRouter()
  const [ref, isVisible] = useIntersectionObserver({
    threshold: 0.5,
    rootMargin: '50px'
  })

  useEffect(() => {
    if (isVisible) {
      // Prefetch when 50% visible with 50px margin
      router.prefetch(href)
    }
  }, [isVisible, href, router])

  return (
    <div ref={ref}>
      {children}
    </div>
  )
}
```

### Priority Prefetching

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function PriorityPrefetch() {
  const router = useRouter()

  useEffect(() => {
    // High priority routes
    const highPriority = ['/dashboard', '/products']

    // Prefetch immediately
    highPriority.forEach(route => {
      router.prefetch(route)
    })

    // Low priority routes - prefetch after delay
    const lowPriority = ['/about', '/contact']

    const timer = setTimeout(() => {
      lowPriority.forEach(route => {
        router.prefetch(route)
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [router])

  return null
}
```

### Idle Prefetching

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function IdlePrefetch({ routes }: { routes: string[] }) {
  const router = useRouter()

  useEffect(() => {
    // Prefetch during browser idle time
    if ('requestIdleCallback' in window) {
      const ids = routes.map(route =>
        requestIdleCallback(() => {
          router.prefetch(route)
        })
      )

      return () => {
        ids.forEach(id => cancelIdleCallback(id))
      }
    }
  }, [routes, router])

  return null
}
```

### Network-Aware Prefetching

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function NetworkAwarePrefetch({ href }) {
  const router = useRouter()

  useEffect(() => {
    // Only prefetch on good connections
    if ('connection' in navigator) {
      const connection = (navigator as any).connection

      if (connection.effectiveType === '4g' && !connection.saveData) {
        router.prefetch(href)
      }
    } else {
      // Prefetch if connection API not available
      router.prefetch(href)
    }
  }, [href, router])

  return null
}
```

## Performance Optimization

### Selective Prefetching

```typescript
'use client'

import Link from 'next/link'

export function Navigation() {
  return (
    <nav>
      {/* Critical routes - prefetch */}
      <Link href="/products" prefetch={true}>
        Products
      </Link>

      {/* Secondary routes - lazy prefetch */}
      <Link href="/about" prefetch={false}>
        About
      </Link>

      {/* External routes - no prefetch */}
      <a href="https://external.com">External</a>
    </nav>
  )
}
```

### Batch Prefetching

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function BatchPrefetch({ routes }: { routes: string[] }) {
  const router = useRouter()

  useEffect(() => {
    // Batch prefetch with small delays
    routes.forEach((route, index) => {
      setTimeout(() => {
        router.prefetch(route)
      }, index * 100) // 100ms between each prefetch
    })
  }, [routes, router])

  return null
}
```

### Conditional Cache Invalidation

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ConditionalRefresh({ shouldRefresh }: { shouldRefresh: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (shouldRefresh) {
      router.refresh()
    }
  }, [shouldRefresh, router])

  return null
}
```

## Cache Strategy by Route Type

### Static Content

```typescript
// app/blog/page.tsx
export const experimental_staleTimes = {
  static: 600 // 10 minutes - content rarely changes
}

export default function BlogPage() {
  return <div>Blog content</div>
}
```

### Dynamic User Content

```typescript
// app/dashboard/page.tsx
export const experimental_staleTimes = {
  dynamic: 30 // 30 seconds - frequently changing user data
}

export default function DashboardPage() {
  return <div>Dashboard</div>
}
```

### Real-Time Content

```typescript
// app/live/page.tsx
export const experimental_staleTimes = {
  dynamic: 0 // Always fresh - real-time data
}

export default function LivePage() {
  return <div>Live content</div>
}
```

### Hybrid Content

```typescript
// app/products/page.tsx
export const experimental_staleTimes = {
  static: 300,  // 5 minutes for static shell
  dynamic: 60   // 1 minute for dynamic data
}

export default function ProductsPage() {
  return <div>Products</div>
}
```

## Common Use Cases

### E-commerce Navigation

```typescript
'use client'

import Link from 'next/link'

export function ProductNavigation() {
  return (
    <nav>
      {/* High-traffic pages - always prefetch */}
      <Link href="/products" prefetch={true}>
        All Products
      </Link>

      {/* Category pages - prefetch on hover */}
      <Link href="/products/electronics" prefetch={false}>
        Electronics
      </Link>

      {/* Detail pages - no prefetch (too many) */}
      <Link href="/products/123" prefetch={false}>
        Product Detail
      </Link>
    </nav>
  )
}
```

### Multi-Step Form

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function FormStep1() {
  const router = useRouter()

  useEffect(() => {
    // Prefetch next step
    router.prefetch('/form/step-2')
  }, [router])

  return <form>Step 1</form>
}
```

### Authenticated App

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function AuthenticatedPrefetch() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      // Prefetch common authenticated routes
      router.prefetch('/dashboard')
      router.prefetch('/settings')
      router.prefetch('/profile')
    }
  }, [user, router])

  return null
}
```

## Debugging Client Cache

### Log Prefetch Events

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function DebugPrefetch({ href }: { href: string }) {
  const router = useRouter()

  useEffect(() => {
    console.log(`Prefetching: ${href}`)
    const start = Date.now()

    router.prefetch(href)

    console.log(`Prefetch initiated for ${href} at ${start}`)
  }, [href, router])

  return null
}
```

### Monitor Navigation Performance

```typescript
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationMonitor() {
  const pathname = usePathname()

  useEffect(() => {
    const navigationTiming = performance.getEntriesByType('navigation')[0]
    console.log('Navigation to', pathname)
    console.log('Performance:', navigationTiming)
  }, [pathname])

  return null
}
```

## Best Practices

1. **Prefetch critical routes**: Dashboard, product listings, etc.
2. **Avoid over-prefetching**: Don't prefetch hundreds of routes
3. **Consider network conditions**: Use network-aware prefetching
4. **Set appropriate stale times**: Match to content volatility
5. **Invalidate after mutations**: Use router.refresh() after updates
6. **Monitor cache performance**: Track navigation speed
7. **Test different strategies**: A/B test prefetch approaches
8. **Document cache decisions**: Explain stale time choices

## Common Pitfalls

### 1. Over-Prefetching

```typescript
// ❌ Wrong - prefetches too much
export function ProductList({ products }) {
  return products.map(product => (
    <Link
      key={product.id}
      href={`/products/${product.id}`}
      prefetch={true} // Don't prefetch 100+ routes!
    >
      {product.name}
    </Link>
  ))
}

// ✅ Correct - selective prefetching
export function ProductList({ products }) {
  return products.map(product => (
    <Link
      key={product.id}
      href={`/products/${product.id}`}
      prefetch={false} // Prefetch on hover instead
    >
      {product.name}
    </Link>
  ))
}
```

### 2. Stale Cache After Update

```typescript
// ❌ Wrong - cache not invalidated
'use client'
export function UpdateButton() {
  const handleUpdate = async () => {
    await updateData()
    // Old data still in cache!
  }

  return <button onClick={handleUpdate}>Update</button>
}

// ✅ Correct - refresh cache
'use client'
export function UpdateButton() {
  const router = useRouter()

  const handleUpdate = async () => {
    await updateData()
    router.refresh() // Invalidate cache
  }

  return <button onClick={handleUpdate}>Update</button>
}
```

### 3. Inappropriate Stale Times

```typescript
// ❌ Wrong - stale time too long for dynamic content
export const experimental_staleTimes = {
  dynamic: 3600 // 1 hour for user dashboard!
}

// ✅ Correct - appropriate stale time
export const experimental_staleTimes = {
  dynamic: 30 // 30 seconds for dynamic content
}
```

## Performance Impact

### Benefits
- Instant navigation between cached routes
- Reduced server load
- Better user experience
- Lower bandwidth usage

### Trade-offs
- Memory usage in browser
- Potential stale data
- Increased initial prefetch requests
- Network usage for prefetching

## Related

- See `use-cache.md` for server-side caching
- See `cache-lifecycle.md` for cache expiration
- See `isr.md` for page-level revalidation
- See Next.js [Link Component docs](https://nextjs.org/docs/app/api-reference/components/link)
