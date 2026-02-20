# fetch

Next.js extends the native Web `fetch()` API with automatic request deduplication, caching, and revalidation capabilities.

## Function Signature

```typescript
async function fetch(
  input: string | URL | Request,
  options?: {
    cache?: 'force-cache' | 'no-store'
    next?: {
      revalidate?: number | false
      tags?: string[]
    }
  }
): Promise<Response>
```

## Parameters

### `input`
- **Type**: `string | URL | Request`
- **Description**: The resource URL or Request object to fetch

### `options` (optional)
- **Type**: `RequestInit & NextFetchRequestConfig`
- **Description**: Extended fetch options

#### Standard Options
All standard fetch options are supported (method, headers, body, etc.)

#### Next.js Extended Options

**`cache`**
- `'force-cache'` (default) - Cache the response indefinitely
- `'no-store'` - Fetch fresh data on every request

**`next.revalidate`**
- **Type**: `number | false`
- **Description**: Time in seconds to revalidate the cache
- `false` - Cache indefinitely (same as force-cache)
- `0` - Never cache (same as no-store)
- `number` - Revalidate after n seconds

**`next.tags`**
- **Type**: `string[]`
- **Description**: Array of cache tags for targeted revalidation

## Return Value

Returns a Promise that resolves to a `Response` object.

## Usage Examples

### Basic Fetch with Default Caching

```typescript
// Cached indefinitely by default
async function getData() {
  const res = await fetch('https://api.example.com/data')

  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
}
```

### No Caching (Always Fresh)

```typescript
// Option 1: Using cache option
const res = await fetch('https://api.example.com/data', {
  cache: 'no-store'
})

// Option 2: Using revalidate
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 0 }
})
```

### Time-based Revalidation

```typescript
// Revalidate every 60 seconds
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 }
})

// Revalidate every hour
const res = await fetch('https://api.example.com/posts', {
  next: { revalidate: 3600 }
})
```

### Tag-based Caching

```typescript
// Tag the cache for targeted revalidation
const res = await fetch('https://api.example.com/products', {
  next: { tags: ['products'] }
})

// Multiple tags
const res = await fetch('https://api.example.com/product/123', {
  next: { tags: ['products', 'product-123'] }
})
```

### Combining Options

```typescript
const res = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ key: 'value' }),
  next: {
    revalidate: 300, // 5 minutes
    tags: ['api-data']
  }
})
```

### In Server Components

```typescript
// app/posts/page.tsx
interface Post {
  id: number
  title: string
  body: string
}

export default async function PostsPage() {
  const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
    next: { revalidate: 3600 } // Revalidate every hour
  })

  const posts: Post[] = await res.json()

  return (
    <div>
      <h1>Posts</h1>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.body}</p>
        </article>
      ))}
    </div>
  )
}
```

### In Route Handlers

```typescript
// app/api/data/route.ts
export async function GET() {
  const res = await fetch('https://api.example.com/data', {
    headers: {
      'Authorization': `Bearer ${process.env.API_TOKEN}`
    },
    next: { revalidate: 60 }
  })

  const data = await res.json()

  return Response.json(data)
}
```

### Error Handling

```typescript
async function getProducts() {
  try {
    const res = await fetch('https://api.example.com/products', {
      next: { revalidate: 60, tags: ['products'] }
    })

    if (!res.ok) {
      // This will activate the closest `error.tsx` Error Boundary
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    return await res.json()
  } catch (error) {
    console.error('Failed to fetch products:', error)
    throw error
  }
}
```

## Best Practices

1. **Choose the Right Caching Strategy**
   - Use default caching for static data
   - Use `revalidate` for data that changes periodically
   - Use `no-store` for user-specific or real-time data

2. **Use Cache Tags for Granular Control**
   ```typescript
   // Tag individual items and collections
   await fetch(`/api/product/${id}`, {
     next: { tags: ['products', `product-${id}`] }
   })
   ```

3. **Handle Errors Gracefully**
   ```typescript
   const res = await fetch(url)
   if (!res.ok) {
     throw new Error('Failed to fetch')
   }
   ```

4. **Avoid Caching User-Specific Data**
   ```typescript
   // Don't cache personalized data
   const res = await fetch('/api/user/profile', {
     cache: 'no-store'
   })
   ```

5. **Request Deduplication**
   Next.js automatically deduplicates identical fetch requests during render:
   ```typescript
   // These will only make one network request
   const user1 = await fetch('/api/user/1')
   const user2 = await fetch('/api/user/1')
   ```

## Revalidation Methods

After caching data with tags, you can revalidate it using:

```typescript
import { revalidateTag, revalidatePath } from 'next/cache'

// Revalidate by tag
revalidateTag('products')

// Revalidate by path
revalidatePath('/products')
```

## Notes

- Fetch requests are automatically cached in Server Components
- Caching is opt-out in Route Handlers (use `cache: 'force-cache'` to enable)
- POST requests are not cached by default
- Fetch caching is only available on the server
- Use `cache: 'no-store'` or `revalidate: 0` for dynamic data
- Cache tags must be revalidated using `revalidateTag()` in Server Actions or Route Handlers

## Related

- [revalidatePath](./revalidatePath.md) - Revalidate by path
- [revalidateTag](./revalidateTag.md) - Revalidate by tag
- [cacheTag](./cacheTag.md) - Tag cached content
- [unstable_cache](./unstable_cache.md) - Cache function results
