# use cache Directive

The `use cache` directive enables caching at the function or component level in Next.js App Router. This is the foundational caching mechanism for optimizing server-side rendering and data fetching.

## Overview

The `use cache` directive tells Next.js to cache the output of a function or component, reducing server load and improving response times for subsequent requests.

## Basic Usage

### Function Caching

```typescript
// app/utils/getData.ts
'use cache'

export async function getExpensiveData() {
  const data = await fetch('https://api.example.com/data')
  return data.json()
}
```

### Component Caching

```typescript
// app/components/CachedComponent.tsx
'use cache'

export default async function CachedComponent() {
  const data = await fetch('https://api.example.com/data')
  const result = await data.json()

  return (
    <div>
      <h1>Cached Content</h1>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  )
}
```

### File-Level Caching

```typescript
// app/lib/products.ts
'use cache'

export async function getProducts() {
  const res = await fetch('https://api.example.com/products')
  return res.json()
}

export async function getProductById(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`)
  return res.json()
}

// All exports in this file are cached
```

## Cache Behavior

### Default Caching
- Caches the function/component output on the server
- Cache is shared across all users (unless using `private`)
- Cache persists until explicitly invalidated or server restart
- Ideal for static or slowly-changing data

### Cache Key Generation
Next.js automatically generates cache keys based on:
- Function arguments
- Request headers (for components)
- Dynamic route segments

```typescript
'use cache'

export async function getUserData(userId: string) {
  // Cached separately for each unique userId
  const res = await fetch(`https://api.example.com/users/${userId}`)
  return res.json()
}
```

## Advanced Patterns

### Conditional Caching

```typescript
import { headers } from 'next/headers'

'use cache'

export async function getConditionalData() {
  const headersList = await headers()
  const isAdmin = headersList.get('x-user-role') === 'admin'

  if (isAdmin) {
    return await fetchAdminData()
  }

  return await fetchPublicData()
}
```

### Nested Caching

```typescript
// Parent function with caching
'use cache'

export async function getPageData() {
  const [products, categories] = await Promise.all([
    getProducts(),    // Also cached separately
    getCategories()   // Also cached separately
  ])

  return { products, categories }
}

// Child functions with their own caching
'use cache'

async function getProducts() {
  const res = await fetch('https://api.example.com/products')
  return res.json()
}

'use cache'

async function getCategories() {
  const res = await fetch('https://api.example.com/categories')
  return res.json()
}
```

### With TypeScript Generics

```typescript
'use cache'

export async function fetchData<T>(endpoint: string): Promise<T> {
  const res = await fetch(`https://api.example.com/${endpoint}`)
  return res.json()
}

// Usage
const products = await fetchData<Product[]>('products')
const user = await fetchData<User>('user/123')
```

## Performance Optimization Tips

### 1. Cache at the Right Level
```typescript
// ❌ Don't cache too high - caches entire page
'use cache'
export default async function Page() {
  const data = await getAllData() // Expensive
  return <div>{/* ... */}</div>
}

// ✅ Cache specific data functions
async function Page() {
  const data = await getCachedData() // Cached function
  return <div>{/* ... */}</div>
}

'use cache'
async function getCachedData() {
  return await fetch('https://api.example.com/data')
}
```

### 2. Optimize Cache Granularity
```typescript
// ❌ Too granular - many cache entries
'use cache'
async function getProduct(id: string) {
  // Creates cache entry per product
  return await fetch(`/api/products/${id}`)
}

// ✅ Batch when possible
'use cache'
async function getProducts(ids: string[]) {
  // Single cache entry for product batch
  return await fetch(`/api/products?ids=${ids.join(',')}`)
}
```

### 3. Use with Parallel Data Fetching
```typescript
'use cache'
export async function getPageData() {
  // Fetch in parallel, cache together
  const [user, posts, comments] = await Promise.all([
    fetchUser(),
    fetchPosts(),
    fetchComments()
  ])

  return { user, posts, comments }
}
```

## Common Pitfalls

### 1. Caching Dynamic User Data
```typescript
// ❌ Wrong - caches user-specific data globally
'use cache'
export async function getCurrentUser() {
  const user = await getUserFromSession()
  return user
}

// ✅ Correct - use 'private' for user-specific data
'use cache: private'
export async function getCurrentUser() {
  const user = await getUserFromSession()
  return user
}
```

### 2. Side Effects in Cached Functions
```typescript
// ❌ Wrong - side effects won't run on cache hit
'use cache'
export async function trackAndGetData() {
  await analytics.track('data-fetched') // Won't run on cache hit!
  return await fetchData()
}

// ✅ Correct - separate side effects
export async function trackAndGetData() {
  await analytics.track('data-fetched') // Always runs
  return await getCachedData() // Cached separately
}

'use cache'
async function getCachedData() {
  return await fetchData()
}
```

### 3. Forgetting to Invalidate
```typescript
// Remember to invalidate when data changes
import { revalidateTag } from 'next/cache'

'use cache'
export async function getProducts() {
  return await fetch('https://api.example.com/products', {
    next: { tags: ['products'] } // Tag for invalidation
  })
}

// In your API route or server action
export async function createProduct(data) {
  await saveProduct(data)
  revalidateTag('products') // Invalidate cache
}
```

## Debugging Cached Functions

### Check Cache Headers
```typescript
'use cache'

export async function getDebugData() {
  console.log('Cache MISS - function executed')
  return await fetch('https://api.example.com/data')
}

// First call: logs "Cache MISS"
// Subsequent calls: no log (cache HIT)
```

### Verify Cache Behavior in Development
```bash
# Set cache behavior in development
# next.config.js
module.exports = {
  experimental: {
    useCache: true // Enable caching in dev mode
  }
}
```

## Integration with Other Caching Mechanisms

### With Fetch Cache
```typescript
'use cache'

export async function getDataWithFetchCache() {
  // Both function-level and fetch-level caching
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 } // Fetch cache: 1 hour
  })
  return res.json()
}
```

### With cacheLife
```typescript
import { cacheLife } from 'next/cache'

'use cache'

export async function getDataWithLifetime() {
  cacheLife('hours')

  const res = await fetch('https://api.example.com/data')
  return res.json()
}
```

### With cacheTag
```typescript
import { cacheTag } from 'next/cache'

'use cache'

export async function getTaggedData() {
  cacheTag('products', 'homepage')

  const res = await fetch('https://api.example.com/products')
  return res.json()
}
```

## Best Practices

1. **Use for expensive operations**: Database queries, external API calls, complex computations
2. **Keep functions pure**: Cached functions should have no side effects
3. **Add cache tags**: Always tag cached data for easy invalidation
4. **Monitor cache hit rates**: Track performance improvements
5. **Document cache behavior**: Comment why caching is applied
6. **Test cache invalidation**: Ensure data updates correctly
7. **Use with revalidation**: Combine with time-based or tag-based revalidation
8. **Consider cache size**: Don't cache too much data in memory

## When NOT to Use

- User-specific data (use `'use cache: private'` instead)
- Frequently changing data (consider shorter revalidation)
- Data with side effects (separate caching from side effects)
- Real-time data (use client-side fetching)
- Very large datasets (consider pagination and partial caching)

## Related

- See `cache-private.md` for personalized content caching
- See `cache-lifecycle.md` for cache expiration control
- See `cache-tags.md` for tag-based invalidation
- See `isr.md` for time-based revalidation patterns
