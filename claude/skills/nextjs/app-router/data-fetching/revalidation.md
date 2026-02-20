# Data Revalidation

Revalidation allows you to update cached data without rebuilding your entire application. Next.js provides multiple strategies for keeping data fresh.

## Types of Revalidation

### 1. Time-Based Revalidation (ISR)
### 2. On-Demand Revalidation
### 3. Route Segment Config

## Time-Based Revalidation

Automatically revalidate data after a specific time interval.

### Using fetch with next.revalidate

```tsx
// Revalidate every 60 seconds
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 }
  })
  return res.json()
}

export default async function Page() {
  const data = await getData()
  return <DataDisplay data={data} />
}
```

### Route Segment Config

Set revalidation for entire route segments:

```tsx
// app/posts/page.tsx

// Revalidate this page every 3600 seconds (1 hour)
export const revalidate = 3600

async function getPosts() {
  const res = await fetch('https://api.example.com/posts')
  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()
  return <PostsList posts={posts} />
}
```

### Per-Request Revalidation

Different requests can have different revalidation times:

```tsx
export default async function Dashboard() {
  // Revalidate user data every 60 seconds
  const user = await fetch('https://api.example.com/user', {
    next: { revalidate: 60 }
  }).then(r => r.json())

  // Revalidate stats every 300 seconds (5 minutes)
  const stats = await fetch('https://api.example.com/stats', {
    next: { revalidate: 300 }
  }).then(r => r.json())

  // Revalidate posts every 3600 seconds (1 hour)
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }
  }).then(r => r.json())

  return <DashboardView user={user} stats={stats} posts={posts} />
}
```

## On-Demand Revalidation

Manually revalidate data when specific events occur.

### revalidatePath

Revalidate a specific path:

```tsx
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
    }
  })

  // Revalidate the posts list page
  revalidatePath('/posts')

  // Revalidate the specific post page
  revalidatePath(`/posts/${post.id}`)

  // Revalidate the homepage
  revalidatePath('/')
}
```

### revalidatePath with Layout Option

```tsx
'use server'

import { revalidatePath } from 'next/cache'

export async function updateUser(formData: FormData) {
  await db.user.update({
    where: { id: userId },
    data: { name: formData.get('name') as string }
  })

  // Revalidate the page and its layout
  revalidatePath('/profile', 'layout')

  // Or revalidate just the page (default)
  revalidatePath('/profile', 'page')
}
```

### revalidateTag

Tag requests and revalidate all at once:

```tsx
// Tag requests when fetching
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts'] }
  })
  return res.json()
}

async function getFeaturedPosts() {
  const res = await fetch('https://api.example.com/posts/featured', {
    next: { tags: ['posts', 'featured'] }
  })
  return res.json()
}
```

```tsx
// Revalidate all requests tagged with 'posts'
'use server'

import { revalidateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  await db.post.create({
    data: {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
    }
  })

  // Revalidates both getPosts and getFeaturedPosts
  revalidateTag('posts')
}

export async function updatePost(id: number, formData: FormData) {
  await db.post.update({
    where: { id },
    data: {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
    }
  })

  // Revalidate specific post
  revalidateTag(`post-${id}`)

  // Revalidate all posts
  revalidateTag('posts')
}
```

### Multiple Tags

Tag with multiple identifiers:

```tsx
async function getUserPosts(userId: number) {
  const res = await fetch(`https://api.example.com/users/${userId}/posts`, {
    next: {
      tags: ['posts', `user-${userId}`, `user-${userId}-posts`]
    }
  })
  return res.json()
}

// Later, revalidate by user
export async function deleteUser(userId: number) {
  await db.user.delete({ where: { id: userId } })

  // Revalidates all data tagged with this user
  revalidateTag(`user-${userId}`)
}

// Or revalidate all posts
export async function updatePostsLayout() {
  // Revalidates all posts regardless of user
  revalidateTag('posts')
}
```

## Combining Revalidation Strategies

Use both time-based and on-demand revalidation:

```tsx
// Fetch with tag and time-based revalidation
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: {
      tags: ['products'],
      revalidate: 3600  // Also revalidate every hour
    }
  })
  return res.json()
}

// Server Action that triggers immediate revalidation
export async function updateProduct(id: number, formData: FormData) {
  'use server'

  await db.product.update({
    where: { id },
    data: { name: formData.get('name') as string }
  })

  // Immediately revalidate
  revalidateTag('products')
  revalidateTag(`product-${id}`)
}
```

## Route Handler Revalidation

Revalidate from API routes:

```tsx
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  // Verify secret token
  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ message: 'Invalid secret' }, { status: 401 })
  }

  const path = request.nextUrl.searchParams.get('path')
  const tag = request.nextUrl.searchParams.get('tag')

  if (path) {
    revalidatePath(path)
    return Response.json({ revalidated: true, path })
  }

  if (tag) {
    revalidateTag(tag)
    return Response.json({ revalidated: true, tag })
  }

  return Response.json({
    message: 'Missing path or tag'
  }, { status: 400 })
}
```

Usage:

```bash
# Revalidate a path
curl -X POST 'http://localhost:3000/api/revalidate?secret=MY_SECRET&path=/posts'

# Revalidate a tag
curl -X POST 'http://localhost:3000/api/revalidate?secret=MY_SECRET&tag=posts'
```

## Webhook-Triggered Revalidation

Revalidate when external systems update:

```tsx
// app/api/webhooks/cms/route.ts
import { revalidateTag } from 'next/cache'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  // Verify webhook signature
  const signature = headers().get('x-webhook-signature')
  if (!verifySignature(signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const data = await request.json()

  // Revalidate based on the event type
  switch (data.event) {
    case 'post.created':
    case 'post.updated':
    case 'post.deleted':
      revalidateTag('posts')
      revalidateTag(`post-${data.postId}`)
      break

    case 'page.updated':
      revalidatePath(data.page.slug)
      break

    default:
      return Response.json({ error: 'Unknown event' }, { status: 400 })
  }

  return Response.json({ revalidated: true })
}

function verifySignature(signature: string | null): boolean {
  // Implement signature verification
  return signature === process.env.WEBHOOK_SECRET
}
```

## Opt Out of Caching

Force fresh data on every request:

### Using cache: 'no-store'

```tsx
// Never cache this request
async function getDynamicData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store'
  })
  return res.json()
}

export default async function Page() {
  const data = await getDynamicData()
  return <DataDisplay data={data} />
}
```

### Using revalidate: 0

```tsx
// Equivalent to cache: 'no-store'
async function getDynamicData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 0 }
  })
  return res.json()
}
```

### Route Segment Config

```tsx
// app/dashboard/page.tsx

// Disable caching for entire route
export const dynamic = 'force-dynamic'

// Or set revalidate to 0
export const revalidate = 0

export default async function DashboardPage() {
  const data = await fetchLiveData()
  return <Dashboard data={data} />
}
```

## Revalidation in Dynamic Routes

```tsx
// app/posts/[id]/page.tsx

export async function generateStaticParams() {
  const posts = await db.post.findMany({ select: { id: true } })
  return posts.map(post => ({ id: post.id.toString() }))
}

export const revalidate = 3600 // Revalidate every hour

export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await fetch(`https://api.example.com/posts/${params.id}`, {
    next: { tags: [`post-${params.id}`] }
  }).then(r => r.json())

  return <Post post={post} />
}
```

Server Action to revalidate specific post:

```tsx
'use server'

import { revalidateTag, revalidatePath } from 'next/cache'

export async function updatePost(id: string, formData: FormData) {
  await db.post.update({
    where: { id: parseInt(id) },
    data: { content: formData.get('content') as string }
  })

  // Revalidate the specific post page
  revalidatePath(`/posts/${id}`)

  // Revalidate using tags
  revalidateTag(`post-${id}`)

  // Revalidate the posts list
  revalidateTag('posts')
}
```

## Cache Invalidation Patterns

### Hierarchical Invalidation

```tsx
'use server'

import { revalidateTag } from 'next/cache'

export async function createComment(postId: number, formData: FormData) {
  await db.comment.create({
    data: {
      postId,
      content: formData.get('content') as string,
    }
  })

  // Invalidate in order of specificity
  revalidateTag(`post-${postId}-comments`)  // Most specific
  revalidateTag(`post-${postId}`)           // Post page
  revalidateTag('comments')                  // All comments
  revalidateTag('posts')                     // All posts
}
```

### Selective Invalidation

```tsx
'use server'

export async function updatePost(id: number, updates: {
  title?: string
  content?: string
  featured?: boolean
}) {
  await db.post.update({ where: { id }, data: updates })

  // Always revalidate the post itself
  revalidateTag(`post-${id}`)

  // Only revalidate featured if that changed
  if (updates.featured !== undefined) {
    revalidateTag('featured-posts')
  }

  // Only revalidate lists if title changed (affects previews)
  if (updates.title) {
    revalidateTag('posts')
  }
}
```

## Testing Revalidation

```tsx
// app/test/revalidation/page.tsx

export const revalidate = 10 // Revalidate every 10 seconds

async function getTime() {
  const res = await fetch('https://worldtimeapi.org/api/timezone/UTC')
  return res.json()
}

export default async function RevalidationTest() {
  const time = await getTime()

  return (
    <div>
      <h1>Revalidation Test</h1>
      <p>Current time: {time.datetime}</p>
      <p>This page revalidates every 10 seconds</p>
      <p>Hard refresh to see immediate changes</p>
    </div>
  )
}
```

## Best Practices

1. **Use tags for flexibility** - Tags allow granular revalidation
2. **Combine strategies** - Use both time-based and on-demand
3. **Revalidate hierarchically** - Invalidate from specific to general
4. **Set appropriate intervals** - Balance freshness with server load
5. **Use revalidatePath for pages** - Simpler for full page updates
6. **Use revalidateTag for data** - Better for shared data across pages
7. **Secure revalidation endpoints** - Require authentication
8. **Log revalidation events** - Track what gets revalidated when
9. **Test revalidation timing** - Ensure data stays fresh
10. **Monitor cache hit rates** - Balance between caching and freshness

## Common Patterns

### Blog with ISR

```tsx
// Posts list revalidates every hour
export const revalidate = 3600

export default async function BlogPage() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { tags: ['posts'] }
  }).then(r => r.json())

  return <PostsList posts={posts} />
}

// Individual post revalidates when updated
export async function updateBlogPost(id: number, content: string) {
  'use server'

  await db.post.update({ where: { id }, data: { content } })
  revalidatePath(`/blog/${id}`)
  revalidateTag('posts')
}
```

### E-commerce Product Pages

```tsx
// Product pages update when inventory changes
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`, {
    next: {
      tags: ['products', `product-${id}`],
      revalidate: 300  // Also revalidate every 5 minutes
    }
  })
  return res.json()
}

// Update inventory triggers revalidation
export async function updateInventory(productId: number, quantity: number) {
  'use server'

  await db.product.update({
    where: { id: productId },
    data: { inventory: quantity }
  })

  revalidateTag(`product-${productId}`)

  if (quantity === 0) {
    // Product out of stock, update listings
    revalidateTag('products')
  }
}
```

### Dashboard with Mixed Revalidation

```tsx
export default async function Dashboard() {
  // Real-time data, never cache
  const liveStats = await fetch('https://api.example.com/stats/live', {
    cache: 'no-store'
  }).then(r => r.json())

  // Semi-live data, revalidate every minute
  const recentActivity = await fetch('https://api.example.com/activity', {
    next: { revalidate: 60 }
  }).then(r => r.json())

  // Historical data, revalidate every hour
  const historicalData = await fetch('https://api.example.com/history', {
    next: { revalidate: 3600 }
  }).then(r => r.json())

  return (
    <DashboardLayout
      liveStats={liveStats}
      recentActivity={recentActivity}
      historicalData={historicalData}
    />
  )
}
```

## Revalidation Edge Cases

### Revalidate After Redirect

```tsx
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: { title: formData.get('title') as string }
  })

  // Revalidate before redirect
  revalidatePath('/posts')

  // Then redirect
  redirect(`/posts/${post.id}`)
}
```

### Conditional Revalidation

```tsx
'use server'

export async function updatePost(id: number, formData: FormData) {
  const published = formData.get('published') === 'true'

  await db.post.update({
    where: { id },
    data: {
      title: formData.get('title') as string,
      published
    }
  })

  // Always revalidate the post
  revalidateTag(`post-${id}`)

  // Only revalidate public pages if post is published
  if (published) {
    revalidatePath('/posts')
    revalidatePath('/')
  }
}
```
