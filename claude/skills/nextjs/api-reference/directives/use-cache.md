# use cache

The `'use cache'` directive marks functions or components for caching, enabling you to cache the output of expensive operations and reuse them across requests.

## Syntax

```typescript
'use cache'
```

Must be placed at the **top** of a function or component file, before any imports.

## Use Cases

### 1. Function-Level Caching

Cache the output of expensive computations or data fetching operations.

```typescript
// app/lib/data.ts
'use cache'

export async function getExpensiveData(id: string) {
  const data = await fetch(`https://api.example.com/data/${id}`)
  const processed = await data.json()

  // Expensive computation
  const result = complexCalculation(processed)

  return result
}
```

### 2. Component-Level Caching

Cache the entire rendered output of a component.

```typescript
// app/components/ProductList.tsx
'use cache'

interface Product {
  id: string
  name: string
  price: number
}

export async function ProductList({ category }: { category: string }) {
  const products = await fetch(`https://api.example.com/products?category=${category}`)
  const data: Product[] = await products.json()

  return (
    <div>
      {data.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>${product.price}</p>
        </div>
      ))}
    </div>
  )
}
```

### 3. Custom Cache Keys

Control cache invalidation with custom cache keys using function parameters.

```typescript
'use cache'

export async function getUserData(userId: string, timestamp: number) {
  const user = await db.users.findUnique({ where: { id: userId } })

  return {
    ...user,
    fetchedAt: new Date().toISOString()
  }
}

// Usage - cache key includes both parameters
const data1 = await getUserData('user-123', Date.now()) // Cache miss
const data2 = await getUserData('user-123', Date.now()) // Cache miss (different timestamp)
```

### 4. Caching with Object Parameters

```typescript
'use cache'

interface QueryParams {
  limit: number
  offset: number
  sortBy: string
}

export async function getItems(params: QueryParams) {
  const items = await db.items.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { [params.sortBy]: 'asc' }
  })

  return items
}

// Cache key is based on serialized parameters
const items = await getItems({ limit: 10, offset: 0, sortBy: 'createdAt' })
```

## Best Practices

### 1. Cache Expensive Operations

```typescript
'use cache'

// Good - caching expensive computation
export async function calculateRecommendations(userId: string) {
  const userHistory = await getUserPurchaseHistory(userId)
  const allProducts = await getAllProducts()

  // Complex ML algorithm
  const recommendations = runRecommendationAlgorithm(userHistory, allProducts)

  return recommendations
}
```

### 2. Avoid Caching Frequently Changing Data

```typescript
// Bad - don't cache real-time data
'use cache'
export async function getStockPrice(symbol: string) {
  return await fetch(`https://api.stocks.com/${symbol}`)
}

// Good - no caching for real-time data
export async function getStockPrice(symbol: string) {
  return await fetch(`https://api.stocks.com/${symbol}`)
}
```

### 3. Use with Database Queries

```typescript
'use cache'

export async function getPublishedPosts() {
  const posts = await db.post.findMany({
    where: { published: true },
    include: { author: true },
    orderBy: { createdAt: 'desc' }
  })

  return posts
}
```

### 4. Combine with Revalidation

```typescript
'use cache'

export async function getBlogPost(slug: string) {
  const post = await db.post.findUnique({
    where: { slug },
    include: { author: true, comments: true }
  })

  return post
}

// In next.config.js or route handler, set revalidation time
export const revalidate = 3600 // Revalidate every hour
```

## Cache Key Behavior

The cache key is automatically generated based on:
- Function name
- All function parameters (serialized)
- File path

```typescript
'use cache'

export async function getData(id: string, options?: { includeMetadata?: boolean }) {
  // Cache key: 'getData-id123-{includeMetadata:true}'
  return await fetchData(id, options)
}

const data1 = await getData('id123', { includeMetadata: true })  // Cache miss
const data2 = await getData('id123', { includeMetadata: true })  // Cache hit
const data3 = await getData('id123', { includeMetadata: false }) // Cache miss (different key)
```

## Common Pitfalls to Avoid

### 1. Don't Cache Functions with Side Effects

```typescript
// Bad - side effects shouldn't be cached
'use cache'
export async function createUser(email: string) {
  return await db.user.create({ data: { email } })
}

// Good - mutations should not use 'use cache'
export async function createUser(email: string) {
  return await db.user.create({ data: { email } })
}
```

### 2. Avoid Non-Serializable Return Values

```typescript
// Bad - functions and class instances aren't serializable
'use cache'
export function getUtility() {
  return {
    helper: () => console.log('hello'), // Function not serializable
    date: new Date() // Date objects need special handling
  }
}

// Good - return serializable data
'use cache'
export function getUtility() {
  return {
    timestamp: new Date().toISOString(), // Serializable string
    value: 42
  }
}
```

### 3. Be Careful with Environment Variables

```typescript
// Bad - cache will persist across environment changes
'use cache'
export function getConfig() {
  return {
    apiUrl: process.env.API_URL,
    env: process.env.NODE_ENV
  }
}

// Good - don't cache environment-dependent values
export function getConfig() {
  return {
    apiUrl: process.env.API_URL,
    env: process.env.NODE_ENV
  }
}
```

### 4. Position the Directive Correctly

```typescript
// Bad - directive must be first
import { db } from './db'
'use cache'

// Good
'use cache'
import { db } from './db'

export async function getData() {
  return await db.data.findMany()
}
```

## Performance Considerations

- **Memory**: Cached data is stored in memory; monitor cache size
- **Revalidation**: Set appropriate revalidation times to balance freshness and performance
- **Granularity**: Cache at the appropriate level (function vs component)
- **Parameters**: Keep cache keys simple to avoid excessive cache entries

## TypeScript Support

```typescript
'use cache'

interface User {
  id: string
  name: string
  email: string
}

export async function getUser(id: string): Promise<User> {
  const user = await db.user.findUnique({ where: { id } })

  if (!user) {
    throw new Error('User not found')
  }

  return user
}
```

## Related Directives

- [use cache private](./use-cache-private.md) - Per-user caching
- [use cache remote](./use-cache-remote.md) - Edge caching with dynamic contexts
- [use server](./use-server.md) - Server Actions (should not be combined with caching)
