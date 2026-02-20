# Caching and Revalidating

Understand Next.js App Router caching mechanisms and revalidation strategies for optimal performance.

## Caching Overview

Next.js has multiple layers of caching:

1. **Request Memoization** - Deduplicate requests during render
2. **Data Cache** - Persistent cache for fetch results
3. **Full Route Cache** - Cached HTML and RSC payload
4. **Router Cache** - Client-side cache of visited routes

## Data Cache

The Data Cache persists fetch results across requests and deployments.

### Force Cache (Default)

```javascript
// Cached indefinitely (default behavior)
fetch('https://api.example.com/data')

// Explicit force cache
fetch('https://api.example.com/data', {
  cache: 'force-cache'
})
```

### No Store (Opt Out)

```javascript
// Never cached, always fresh
fetch('https://api.example.com/user', {
  cache: 'no-store'
})
```

### Revalidate (Time-Based)

```javascript
// Cache and revalidate every 60 seconds
fetch('https://api.example.com/posts', {
  next: { revalidate: 60 }
})

// Cache and revalidate every hour
fetch('https://api.example.com/stats', {
  next: { revalidate: 3600 }
})
```

## Segment-Level Caching

Configure caching for entire route segments:

### Route Segment Config

```javascript
// app/posts/page.js

// Revalidate every 60 seconds
export const revalidate = 60

// Or disable caching
export const dynamic = 'force-dynamic'

// Or force static
export const dynamic = 'force-static'

export default async function PostsPage() {
  // All fetch requests in this segment will revalidate every 60 seconds
  const posts = await fetch('https://api.example.com/posts').then(r => r.json())

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Dynamic Options

```javascript
// app/dashboard/page.js

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic'

// Force static rendering
export const dynamic = 'force-static'

// Automatic (default)
export const dynamic = 'auto'

// Error on dynamic usage
export const dynamic = 'error'

export default async function Dashboard() {
  const data = await fetch('https://api.example.com/data').then(r => r.json())
  return <div>{data.value}</div>
}
```

## Time-Based Revalidation

### Per-Request Revalidation

```javascript
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 } // 1 hour
  })
  return res.json()
}

async function getComments() {
  const res = await fetch('https://api.example.com/comments', {
    next: { revalidate: 60 } // 1 minute
  })
  return res.json()
}

export default async function Page() {
  const [posts, comments] = await Promise.all([
    getPosts(),    // Revalidates every hour
    getComments(), // Revalidates every minute
  ])

  return (
    <div>
      <PostList posts={posts} />
      <CommentList comments={comments} />
    </div>
  )
}
```

### Segment-Level Revalidation

```javascript
// app/blog/page.js

// All fetches in this route revalidate every 3600 seconds
export const revalidate = 3600

async function getPosts() {
  // Uses segment revalidate time (3600s)
  const res = await fetch('https://api.example.com/posts')
  return res.json()
}

async function getCategories() {
  // Override with specific revalidate time
  const res = await fetch('https://api.example.com/categories', {
    next: { revalidate: 86400 } // 24 hours
  })
  return res.json()
}

export default async function BlogPage() {
  const [posts, categories] = await Promise.all([
    getPosts(),      // 3600s
    getCategories(), // 86400s
  ])

  return <div>...</div>
}
```

## On-Demand Revalidation

Revalidate cache on-demand when data changes.

### Revalidate by Path

```javascript
// app/actions.js
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData) {
  const title = formData.get('title')
  const content = formData.get('content')

  await fetch('https://api.example.com/posts', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  })

  // Revalidate the /blog page
  revalidatePath('/blog')
}
```

### Revalidate by Tag

```javascript
// app/posts/page.js
export default async function PostsPage() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts'] }
  }).then(r => r.json())

  return <div>...</div>
}

// app/actions.js
'use server'

import { revalidateTag } from 'next/cache'

export async function createPost(formData) {
  await fetch('https://api.example.com/posts', {
    method: 'POST',
    body: JSON.stringify({
      title: formData.get('title'),
      content: formData.get('content'),
    }),
  })

  // Revalidate all fetches tagged with 'posts'
  revalidateTag('posts')
}
```

### Multiple Tags

```javascript
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: {
      tags: ['posts', 'content', 'public'],
      revalidate: 3600
    }
  })
  return res.json()
}

// Revalidate specific tag
revalidateTag('posts')

// Or multiple tags
revalidateTag('content')
revalidateTag('public')
```

## API Route Revalidation

Trigger revalidation from API routes:

```javascript
// app/api/revalidate/route.js
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const body = await request.json()
  const secret = request.headers.get('x-revalidate-secret')

  // Validate secret
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
  }

  // Revalidate by path
  if (body.path) {
    revalidatePath(body.path)
    return NextResponse.json({ revalidated: true, path: body.path })
  }

  // Revalidate by tag
  if (body.tag) {
    revalidateTag(body.tag)
    return NextResponse.json({ revalidated: true, tag: body.tag })
  }

  return NextResponse.json({ message: 'Missing path or tag' }, { status: 400 })
}
```

### Trigger Revalidation

```bash
# From webhook or external system
curl -X POST http://localhost:3000/api/revalidate \
  -H 'Content-Type: application/json' \
  -H 'x-revalidate-secret: YOUR_SECRET' \
  -d '{"path": "/blog"}'

# Or revalidate by tag
curl -X POST http://localhost:3000/api/revalidate \
  -H 'Content-Type: application/json' \
  -H 'x-revalidate-secret: YOUR_SECRET' \
  -d '{"tag": "posts"}'
```

## Router Cache

Client-side cache of visited routes.

### How It Works

```javascript
'use client'

import { useRouter } from 'next/navigation'

export default function Navigation() {
  const router = useRouter()

  return (
    <button onClick={() => router.push('/dashboard')}>
      Go to Dashboard
      {/* This route will be cached on the client */}
    </button>
  )
}
```

### Invalidate Router Cache

```javascript
'use client'

import { useRouter } from 'next/navigation'

export default function RefreshButton() {
  const router = useRouter()

  return (
    <button onClick={() => router.refresh()}>
      Refresh
      {/* Invalidates router cache and refetches from server */}
    </button>
  )
}
```

## Cache Strategies by Use Case

### Static Content (Blog, Docs)

```javascript
// app/blog/page.js

// Revalidate daily
export const revalidate = 86400

export default async function BlogPage() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json())

  return <PostList posts={posts} />
}
```

### Dynamic Content (User Dashboard)

```javascript
// app/dashboard/page.js

// Never cache
export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const data = await fetch('https://api.example.com/user/dashboard', {
    cache: 'no-store'
  }).then(r => r.json())

  return <DashboardView data={data} />
}
```

### Mixed Content (E-commerce)

```javascript
// app/products/page.js

export default async function ProductsPage() {
  // Static: product categories (revalidate daily)
  const categories = await fetch('https://api.example.com/categories', {
    next: { revalidate: 86400 }
  }).then(r => r.json())

  // Dynamic: trending products (revalidate every 5 minutes)
  const trending = await fetch('https://api.example.com/products/trending', {
    next: { revalidate: 300 }
  }).then(r => r.json())

  // User-specific: recommendations (no cache)
  const recommendations = await fetch('https://api.example.com/recommendations', {
    cache: 'no-store'
  }).then(r => r.json())

  return (
    <div>
      <Categories data={categories} />
      <Trending products={trending} />
      <Recommendations products={recommendations} />
    </div>
  )
}
```

## Opting Out of Caching

### Request-Level Opt Out

```javascript
fetch('https://api.example.com/data', {
  cache: 'no-store'
})
```

### Segment-Level Opt Out

```javascript
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

### Using Dynamic Functions

These functions automatically opt out of caching:

```javascript
import { cookies, headers } from 'next/headers'

export default async function Page() {
  // Using cookies opts out of caching
  const cookieStore = cookies()
  const token = cookieStore.get('token')

  // Using headers opts out of caching
  const headersList = headers()
  const userAgent = headersList.get('user-agent')

  return <div>...</div>
}
```

## Request Memoization

Automatic deduplication during a single render:

```javascript
// lib/data.js
export async function getUser(id) {
  const res = await fetch(`https://api.example.com/users/${id}`)
  return res.json()
}

// app/profile/page.js
import { getUser } from '@/lib/data'

async function UserHeader({ id }) {
  const user = await getUser(id) // Request 1
  return <h1>{user.name}</h1>
}

async function UserProfile({ id }) {
  const user = await getUser(id) // Deduped (same request)
  return <p>{user.bio}</p>
}

export default function Page({ params }) {
  return (
    <div>
      <UserHeader id={params.id} />
      <UserProfile id={params.id} />
      {/* Only ONE fetch request is made */}
    </div>
  )
}
```

### Manual Memoization

```javascript
import { cache } from 'react'

export const getUser = cache(async (id) => {
  const res = await fetch(`https://api.example.com/users/${id}`)
  return res.json()
})
```

## Best Practices

1. **Default to caching** - Use force-cache for static data
2. **Revalidate strategically** - Choose appropriate revalidation intervals
3. **Tag your requests** - Use tags for granular revalidation control
4. **Opt out when needed** - Use no-store for user-specific data
5. **Use on-demand revalidation** - Revalidate when data changes
6. **Understand the layers** - Know which cache layer applies
7. **Monitor cache behavior** - Use Next.js built-in logging
8. **Consider CDN caching** - Additional caching at edge

## Common Pitfalls

1. **Over-caching user data** - Personal data should use no-store
2. **Under-caching static data** - Missing performance gains
3. **Not using tags** - Harder to revalidate specific data
4. **Forgetting to revalidate** - Stale content after updates
5. **Mixing cache strategies** - Inconsistent behavior
6. **Not testing cache behavior** - Unexpected caching issues
7. **Ignoring router cache** - Client-side caching surprises
8. **Caching errors** - Error responses shouldn't be cached

## Debugging Cache

### Enable Logging

```javascript
// next.config.js
module.exports = {
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}
```

### Check Cache Headers

```javascript
async function getData() {
  const res = await fetch('https://api.example.com/data')

  console.log('Cache-Control:', res.headers.get('cache-control'))
  console.log('Age:', res.headers.get('age'))

  return res.json()
}
```

## Checklist

- [ ] Understand the four cache layers
- [ ] Use appropriate cache strategies per route
- [ ] Configure revalidation times
- [ ] Implement on-demand revalidation
- [ ] Tag fetch requests for granular control
- [ ] Opt out of caching for dynamic data
- [ ] Test cache behavior in production
- [ ] Monitor cache hit rates
- [ ] Document caching decisions
- [ ] Review and update strategies regularly
