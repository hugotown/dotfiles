# Server-Side Data Fetching

Server Components in Next.js App Router allow you to fetch data directly on the server, eliminating the need for client-side data fetching in many cases.

## Basic Server Component Fetch

```tsx
// app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts')

  if (!res.ok) {
    throw new Error('Failed to fetch posts')
  }

  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()

  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Fetch Options and Caching Behavior

### Default: Cache Everything

```tsx
// Cached indefinitely by default
const res = await fetch('https://api.example.com/data')
```

### Opt Out of Caching

```tsx
// Option 1: Using cache: 'no-store'
const res = await fetch('https://api.example.com/data', {
  cache: 'no-store'
})

// Option 2: Using revalidate: 0
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 0 }
})
```

### Time-Based Revalidation

```tsx
// Revalidate every 60 seconds
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 }
})
```

### Tag-Based Revalidation

```tsx
// Tag data for on-demand revalidation
const res = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] }
})

// Later, revalidate using:
// revalidateTag('posts')
```

## Database Queries

```tsx
// app/products/page.tsx
import { db } from '@/lib/db'

async function getProducts() {
  return await db.product.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' }
  })
}

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <div>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

## Error Handling

### Using Error Boundaries

```tsx
// app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts')

  if (!res.ok) {
    throw new Error('Failed to fetch posts')
  }

  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()
  return <PostsList posts={posts} />
}
```

```tsx
// app/posts/error.tsx
'use client'

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
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

### Try-Catch Pattern

```tsx
async function getPostsWithFallback() {
  try {
    const res = await fetch('https://api.example.com/posts')
    if (!res.ok) throw new Error('Failed to fetch')
    return await res.json()
  } catch (error) {
    console.error('Error fetching posts:', error)
    return [] // Return fallback data
  }
}

export default async function PostsPage() {
  const posts = await getPostsWithFallback()

  if (posts.length === 0) {
    return <p>No posts available</p>
  }

  return <PostsList posts={posts} />
}
```

## Route Segment Config

Configure caching behavior for entire route segments:

```tsx
// app/posts/page.tsx

// Revalidate every 3600 seconds (1 hour)
export const revalidate = 3600

// Or disable caching entirely
export const dynamic = 'force-dynamic'

// Or force static rendering
export const dynamic = 'force-static'

export default async function PostsPage() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json())
  return <PostsList posts={posts} />
}
```

## Request Memoization

Next.js automatically deduplicates identical fetch requests in a single render pass:

```tsx
// Both components can call the same fetch function
// The request is only made once

async function getUser(id: string) {
  const res = await fetch(`https://api.example.com/users/${id}`)
  return res.json()
}

async function UserProfile({ userId }: { userId: string }) {
  const user = await getUser(userId)
  return <div>{user.name}</div>
}

async function UserPosts({ userId }: { userId: string }) {
  const user = await getUser(userId)
  const posts = await fetch(`https://api.example.com/users/${userId}/posts`)
    .then(r => r.json())

  return <PostsList posts={posts} author={user.name} />
}

export default async function UserPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <UserProfile userId={params.id} />
      <UserPosts userId={params.id} />
    </div>
  )
}
```

## Using ORM/Database Clients

### Prisma Example

```tsx
import { prisma } from '@/lib/prisma'

async function getPost(slug: string) {
  return await prisma.post.findUnique({
    where: { slug },
    include: {
      author: true,
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  })
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound()
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <p>By {post.author.name}</p>
      <div>{post.content}</div>
    </article>
  )
}
```

### Drizzle ORM Example

```tsx
import { db } from '@/lib/db'
import { posts, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function getPostWithAuthor(id: number) {
  return await db.select()
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id))
    .limit(1)
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const [post] = await getPostWithAuthor(parseInt(params.id))

  if (!post) {
    notFound()
  }

  return <PostDetail post={post} />
}
```

## Security Considerations

### Environment Variables

```tsx
// Safe: API keys are not exposed to client
async function getSecretData() {
  const res = await fetch('https://api.example.com/data', {
    headers: {
      'Authorization': `Bearer ${process.env.API_SECRET_KEY}`
    }
  })
  return res.json()
}
```

### Sanitizing Data

```tsx
import { sanitize } from '@/lib/sanitize'

async function getPost(id: string) {
  const post = await db.post.findUnique({ where: { id } })

  return {
    ...post,
    // Sanitize user-generated content
    content: sanitize(post.content)
  }
}
```

## Best Practices

1. **Use Server Components by default** - Only use Client Components when needed for interactivity
2. **Fetch at the component level** - Fetch data where it's needed, not at the page level
3. **Use appropriate caching** - Cache static data, revalidate dynamic data
4. **Handle errors gracefully** - Use error boundaries and provide fallbacks
5. **Optimize database queries** - Select only needed fields, use indexes
6. **Use request memoization** - Don't worry about duplicate fetches in the same render
7. **Keep secrets on server** - Never expose API keys or secrets to the client
8. **Type your data** - Use TypeScript for type-safe data fetching
9. **Use loading states** - Implement loading.tsx for better UX
10. **Monitor performance** - Track slow queries and optimize as needed

## Common Patterns

### Fetch with TypeScript

```tsx
interface Post {
  id: number
  title: string
  content: string
  publishedAt: Date
}

async function getPosts(): Promise<Post[]> {
  const res = await fetch('https://api.example.com/posts')
  if (!res.ok) throw new Error('Failed to fetch posts')
  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()
  return <PostsList posts={posts} />
}
```

### Conditional Fetching

```tsx
async function getData(showAll: boolean) {
  if (showAll) {
    return await db.post.findMany()
  } else {
    return await db.post.findMany({ where: { published: true } })
  }
}

export default async function Page({ searchParams }: {
  searchParams: { all?: string }
}) {
  const posts = await getData(searchParams.all === 'true')
  return <PostsList posts={posts} />
}
```

### Dynamic Route Data

```tsx
export async function generateStaticParams() {
  const posts = await db.post.findMany({ select: { slug: true } })

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await db.post.findUnique({
    where: { slug: params.slug }
  })

  return <PostDetail post={post} />
}
```
