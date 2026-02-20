# unstable_cache

The `unstable_cache()` function allows you to cache the results of expensive operations like database queries and API calls for reuse across requests.

## Function Signature

```typescript
import { unstable_cache } from 'next/cache'

function unstable_cache<T>(
  fn: () => Promise<T>,
  keys?: string[],
  options?: {
    tags?: string[]
    revalidate?: number | false
  }
): () => Promise<T>
```

## Parameters

### `fn`
- **Type**: `() => Promise<T>`
- **Description**: The async function to cache

### `keys` (optional)
- **Type**: `string[]`
- **Description**: Array of cache keys to uniquely identify the cached data

### `options` (optional)
- **tags**: `string[]` - Cache tags for invalidation with `revalidateTag()`
- **revalidate**: `number | false` - Revalidation time in seconds

## Return Value

Returns a wrapped version of the function that caches its results.

## Usage Examples

### Basic Usage

```typescript
import { unstable_cache } from 'next/cache'

const getCachedPosts = unstable_cache(
  async () => {
    return await db.post.findMany()
  },
  ['posts']
)

export default async function Page() {
  const posts = await getCachedPosts()
  return <PostList posts={posts} />
}
```

### With Revalidation Time

```typescript
import { unstable_cache } from 'next/cache'

const getCachedProducts = unstable_cache(
  async () => {
    return await db.product.findMany()
  },
  ['products'],
  {
    revalidate: 3600 // Revalidate every hour
  }
)
```

### With Cache Tags

```typescript
import { unstable_cache } from 'next/cache'

const getCachedPost = unstable_cache(
  async (id: string) => {
    return await db.post.findUnique({ where: { id } })
  },
  ['post'],
  {
    tags: ['posts'],
    revalidate: 60
  }
)
```

### Parameterized Cache Function

```typescript
import { unstable_cache } from 'next/cache'

function getCachedUser(userId: string) {
  return unstable_cache(
    async () => {
      return await db.user.findUnique({
        where: { id: userId }
      })
    },
    ['user', userId],
    {
      tags: [`user-${userId}`],
      revalidate: 300
    }
  )()
}

// Usage
const user = await getCachedUser('123')
```

### Database Query Caching

```typescript
import { unstable_cache } from 'next/cache'

const getCategories = unstable_cache(
  async () => {
    return await db.category.findMany({
      orderBy: { name: 'asc' }
    })
  },
  ['categories'],
  {
    tags: ['categories'],
    revalidate: 3600 // 1 hour
  }
)
```

### External API Caching

```typescript
import { unstable_cache } from 'next/cache'

const getWeatherData = unstable_cache(
  async (city: string) => {
    const res = await fetch(
      `https://api.weather.com/data/${city}`
    )
    return res.json()
  },
  ['weather'],
  {
    tags: ['weather'],
    revalidate: 600 // 10 minutes
  }
)
```

### Complex Data Aggregation

```typescript
import { unstable_cache } from 'next/cache'

const getDashboardStats = unstable_cache(
  async () => {
    const [users, posts, comments] = await Promise.all([
      db.user.count(),
      db.post.count(),
      db.comment.count()
    ])

    return { users, posts, comments }
  },
  ['dashboard-stats'],
  {
    tags: ['stats'],
    revalidate: 300
  }
)
```

### With Multiple Parameters

```typescript
import { unstable_cache } from 'next/cache'

function getCachedProducts(category: string, limit: number) {
  return unstable_cache(
    async () => {
      return await db.product.findMany({
        where: { categoryId: category },
        take: limit
      })
    },
    ['products', category, limit.toString()],
    {
      tags: ['products', `category-${category}`],
      revalidate: 3600
    }
  )()
}
```

### User-Specific Caching

```typescript
import { unstable_cache } from 'next/cache'

export function getCachedUserProfile(userId: string) {
  return unstable_cache(
    async () => {
      return await db.user.findUnique({
        where: { id: userId },
        include: {
          posts: true,
          followers: true
        }
      })
    },
    ['user-profile', userId],
    {
      tags: [`user-${userId}`],
      revalidate: 60
    }
  )()
}
```

### With Revalidation

```typescript
import { unstable_cache, revalidateTag } from 'next/cache'

// Cache the data
const getCachedPosts = unstable_cache(
  async () => {
    return await db.post.findMany()
  },
  ['posts'],
  { tags: ['posts'] }
)

// Revalidate when data changes
'use server'

export async function createPost(data: any) {
  await db.post.create({ data })

  // Invalidate the cache
  revalidateTag('posts')
}
```

### Expensive Computation

```typescript
import { unstable_cache } from 'next/cache'

const getAnalytics = unstable_cache(
  async () => {
    // Expensive analytics calculation
    const data = await db.event.findMany()

    return data.reduce((acc, event) => {
      // Complex aggregation logic
      return acc
    }, {})
  },
  ['analytics'],
  {
    tags: ['analytics'],
    revalidate: 7200 // 2 hours
  }
)
```

### Search Results Caching

```typescript
import { unstable_cache } from 'next/cache'

function getCachedSearchResults(query: string) {
  return unstable_cache(
    async () => {
      return await db.post.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { content: { contains: query } }
          ]
        }
      })
    },
    ['search', query],
    {
      tags: ['search', 'posts'],
      revalidate: 300
    }
  )()
}
```

### Conditional Caching

```typescript
import { unstable_cache } from 'next/cache'

function getCachedData(useCache: boolean) {
  if (!useCache) {
    return async () => await db.data.findMany()
  }

  return unstable_cache(
    async () => await db.data.findMany(),
    ['data'],
    { tags: ['data'], revalidate: 3600 }
  )
}
```

### Hierarchical Data

```typescript
import { unstable_cache } from 'next/cache'

const getCategoriesWithProducts = unstable_cache(
  async () => {
    return await db.category.findMany({
      include: {
        products: {
          where: { published: true },
          take: 10
        }
      }
    })
  },
  ['categories-with-products'],
  {
    tags: ['categories', 'products'],
    revalidate: 1800
  }
)
```

### Infinite Cache

```typescript
import { unstable_cache } from 'next/cache'

// Cache forever (until manually revalidated)
const getStaticContent = unstable_cache(
  async () => {
    return await db.content.findMany({
      where: { static: true }
    })
  },
  ['static-content'],
  {
    tags: ['static'],
    revalidate: false // Never auto-revalidate
  }
)
```

## Best Practices

1. **Use Unique Cache Keys**
   ```typescript
   // ✅ Include all parameters in cache key
   const getUser = (id: string) =>
     unstable_cache(
       async () => await db.user.findUnique({ where: { id } }),
       ['user', id]
     )()

   // ❌ Missing parameters in key
   const getUser = (id: string) =>
     unstable_cache(
       async () => await db.user.findUnique({ where: { id } }),
       ['user'] // Missing id!
     )()
   ```

2. **Add Cache Tags for Invalidation**
   ```typescript
   unstable_cache(
     async () => await getData(),
     ['data'],
     { tags: ['data'] } // ✅ Can revalidate with revalidateTag('data')
   )
   ```

3. **Set Appropriate Revalidation Times**
   ```typescript
   // Fast-changing data
   revalidate: 60      // 1 minute

   // Moderate data
   revalidate: 3600    // 1 hour

   // Slow-changing data
   revalidate: 86400   // 1 day

   // Static data
   revalidate: false   // Never
   ```

4. **Wrap Expensive Operations**
   ```typescript
   // ✅ Cache expensive queries
   const getStats = unstable_cache(
     async () => {
       // Expensive aggregation
       return await db.event.groupBy({ ... })
     },
     ['stats'],
     { revalidate: 3600 }
   )

   // ❌ Don't cache simple operations
   const getUser = unstable_cache(
     async (id) => await db.user.findUnique({ where: { id } }),
     ['user']
   ) // Overhead might not be worth it for simple queries
   ```

5. **Handle Parameters Correctly**
   ```typescript
   // ✅ Include all parameters
   function getCached(a: string, b: number) {
     return unstable_cache(
       async () => await fetchData(a, b),
       ['data', a, b.toString()]
     )()
   }
   ```

6. **Combine with revalidateTag**
   ```typescript
   // Cache
   const getData = unstable_cache(
     async () => await db.data.findMany(),
     ['data'],
     { tags: ['data'] }
   )

   // Invalidate
   'use server'
   export async function updateData() {
     await db.data.update({ ... })
     revalidateTag('data')
   }
   ```

## Common Patterns

### CRUD with Caching

```typescript
import { unstable_cache, revalidateTag } from 'next/cache'

// Read (cached)
const getPosts = unstable_cache(
  async () => await db.post.findMany(),
  ['posts'],
  { tags: ['posts'], revalidate: 3600 }
)

// Create (invalidate cache)
'use server'
export async function createPost(data: any) {
  await db.post.create({ data })
  revalidateTag('posts')
}

// Update (invalidate cache)
export async function updatePost(id: string, data: any) {
  await db.post.update({ where: { id }, data })
  revalidateTag('posts')
  revalidateTag(`post-${id}`)
}

// Delete (invalidate cache)
export async function deletePost(id: string) {
  await db.post.delete({ where: { id } })
  revalidateTag('posts')
}
```

### API Integration

```typescript
const getExternalData = unstable_cache(
  async () => {
    const res = await fetch('https://api.example.com/data')
    return res.json()
  },
  ['external-data'],
  {
    tags: ['external'],
    revalidate: 600
  }
)
```

### User Dashboard

```typescript
function getUserDashboard(userId: string) {
  return unstable_cache(
    async () => {
      return await db.user.findUnique({
        where: { id: userId },
        include: {
          posts: { take: 10 },
          comments: { take: 10 },
          stats: true
        }
      })
    },
    ['user-dashboard', userId],
    {
      tags: [`user-${userId}`],
      revalidate: 300
    }
  )()
}
```

## Notes

- Function is marked as `unstable` and may change
- Use for expensive operations (database, API calls, computations)
- Cache keys should include all parameters
- Cache is shared across requests
- Works with `revalidateTag()` for invalidation
- Set `revalidate: false` for infinite cache
- Returns a function that must be called
- Deduplicates identical requests

## Related

- [revalidateTag](./revalidateTag.md) - Invalidate cache by tag
- [revalidatePath](./revalidatePath.md) - Invalidate cache by path
- [fetch](./fetch.md) - Fetch with caching
- [cacheLife](./cacheLife.md) - Set cache duration
- [cacheTag](./cacheTag.md) - Tag cached content
