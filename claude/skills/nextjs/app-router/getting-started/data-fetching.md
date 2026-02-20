# Data Fetching

Learn how to fetch data in Next.js App Router using async Server Components, the extended fetch API, and streaming patterns.

## Async Server Components

Server Components can be async, allowing you to use `await` directly in the component.

### Basic Data Fetching

```javascript
// app/posts/page.js
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
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Multiple Data Sources

```javascript
// app/dashboard/page.js
async function getUser() {
  const res = await fetch('https://api.example.com/user')
  return res.json()
}

async function getStats() {
  const res = await fetch('https://api.example.com/stats')
  return res.json()
}

export default async function Dashboard() {
  // Sequential fetching (slower)
  const user = await getUser()
  const stats = await getStats()

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <p>Views: {stats.views}</p>
    </div>
  )
}
```

## Parallel Data Fetching

Fetch data in parallel for better performance:

```javascript
// app/dashboard/page.js
async function getUser() {
  const res = await fetch('https://api.example.com/user')
  return res.json()
}

async function getStats() {
  const res = await fetch('https://api.example.com/stats')
  return res.json()
}

export default async function Dashboard() {
  // Parallel fetching (faster)
  const [user, stats] = await Promise.all([
    getUser(),
    getStats(),
  ])

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <p>Views: {stats.views}</p>
    </div>
  )
}
```

### Parallel with Error Handling

```javascript
export default async function Dashboard() {
  const [userData, statsData] = await Promise.allSettled([
    getUser(),
    getStats(),
  ])

  const user = userData.status === 'fulfilled' ? userData.value : null
  const stats = statsData.status === 'fulfilled' ? statsData.value : null

  return (
    <div>
      {user ? (
        <h1>Welcome, {user.name}</h1>
      ) : (
        <h1>Welcome, Guest</h1>
      )}
      {stats && <p>Views: {stats.views}</p>}
    </div>
  )
}
```

## Sequential Data Fetching

When one request depends on another:

```javascript
// app/user/[id]/page.js
async function getUser(id) {
  const res = await fetch(`https://api.example.com/users/${id}`)
  return res.json()
}

async function getUserPosts(userId) {
  const res = await fetch(`https://api.example.com/users/${userId}/posts`)
  return res.json()
}

export default async function UserPage({ params }) {
  // Must fetch user first to get user ID
  const user = await getUser(params.id)
  const posts = await getUserPosts(user.id)

  return (
    <div>
      <h1>{user.name}</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Extended Fetch API

Next.js extends the native `fetch` API with caching and revalidation options.

### Cache Options

```javascript
// Force cache (default)
fetch('https://api.example.com/data', { cache: 'force-cache' })

// No cache (always fetch fresh)
fetch('https://api.example.com/data', { cache: 'no-store' })

// Revalidate after 60 seconds
fetch('https://api.example.com/data', {
  next: { revalidate: 60 }
})
```

### Examples

```javascript
// Static data (cached indefinitely)
async function getCategories() {
  const res = await fetch('https://api.example.com/categories', {
    cache: 'force-cache'
  })
  return res.json()
}

// Dynamic data (never cached)
async function getCurrentUser() {
  const res = await fetch('https://api.example.com/user', {
    cache: 'no-store'
  })
  return res.json()
}

// Revalidated data (cached with TTL)
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 } // Revalidate every hour
  })
  return res.json()
}
```

## Direct Database Access

Server Components can access databases directly:

```javascript
// app/users/page.js
import { db } from '@/lib/database'

export default async function UsersPage() {
  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

### Prisma Example

```javascript
// lib/prisma.js
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// app/posts/page.js
import { prisma } from '@/lib/prisma'

export default async function PostsPage() {
  const posts = await prisma.post.findMany({
    include: {
      author: true,
    },
  })

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author.name}</p>
        </article>
      ))}
    </div>
  )
}
```

## Streaming with Suspense

Stream data to show content progressively:

```javascript
// app/dashboard/page.js
import { Suspense } from 'react'

async function User() {
  const user = await getUser() // Fast
  return <h1>Welcome, {user.name}</h1>
}

async function Stats() {
  const stats = await getStats() // Slow
  return <p>Views: {stats.views}</p>
}

export default function Dashboard() {
  return (
    <div>
      <Suspense fallback={<p>Loading user...</p>}>
        <User />
      </Suspense>

      <Suspense fallback={<p>Loading stats...</p>}>
        <Stats />
      </Suspense>
    </div>
  )
}
```

### Multiple Suspense Boundaries

```javascript
// app/page.js
import { Suspense } from 'react'

async function Header() {
  const data = await fetchHeader()
  return <header>{data.title}</header>
}

async function Sidebar() {
  const data = await fetchSidebar()
  return <aside>{data.content}</aside>
}

async function Content() {
  const data = await fetchContent()
  return <main>{data.body}</main>
}

export default function Page() {
  return (
    <div>
      <Suspense fallback={<div>Loading header...</div>}>
        <Header />
      </Suspense>

      <div className="flex">
        <Suspense fallback={<div>Loading sidebar...</div>}>
          <Sidebar />
        </Suspense>

        <Suspense fallback={<div>Loading content...</div>}>
          <Content />
        </Suspense>
      </div>
    </div>
  )
}
```

## Request Deduplication

Next.js automatically deduplicates identical `fetch` requests:

```javascript
async function getUser(id) {
  const res = await fetch(`https://api.example.com/users/${id}`)
  return res.json()
}

export default async function Page() {
  // These three calls result in only ONE network request
  const user1 = await getUser('123')
  const user2 = await getUser('123')
  const user3 = await getUser('123')

  return <div>{user1.name}</div>
}
```

### React Cache API

For non-fetch requests, use React's `cache`:

```javascript
// lib/data.js
import { cache } from 'react'
import { db } from './database'

export const getUser = cache(async (id) => {
  return db.user.findUnique({
    where: { id },
  })
})

// app/profile/page.js
import { getUser } from '@/lib/data'

export default async function ProfilePage() {
  // Multiple calls to getUser with same ID will be deduped
  const user = await getUser('123')

  return <div>{user.name}</div>
}
```

## Error Handling

Handle fetch errors gracefully:

```javascript
// app/posts/page.js
async function getPosts() {
  try {
    const res = await fetch('https://api.example.com/posts')

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    return res.json()
  } catch (error) {
    console.error('Failed to fetch posts:', error)
    return []
  }
}

export default async function PostsPage() {
  const posts = await getPosts()

  if (posts.length === 0) {
    return <p>No posts found</p>
  }

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Error Boundaries

Use `error.js` for component-level error handling:

```javascript
// app/posts/error.js
'use client'

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Failed to load posts</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}

// app/posts/page.js
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
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

## Dynamic Data Patterns

### Search Params

```javascript
// app/search/page.js
async function searchProducts(query) {
  const res = await fetch(
    `https://api.example.com/products?q=${query}`,
    { cache: 'no-store' }
  )
  return res.json()
}

export default async function SearchPage({ searchParams }) {
  const query = searchParams.q || ''
  const products = query ? await searchProducts(query) : []

  return (
    <div>
      <h1>Search Results for "{query}"</h1>
      <ul>
        {products.map(product => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### Dynamic Params

```javascript
// app/products/[id]/page.js
async function getProduct(id) {
  const res = await fetch(`https://api.example.com/products/${id}`)

  if (!res.ok) {
    throw new Error('Product not found')
  }

  return res.json()
}

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id)

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>Price: ${product.price}</p>
    </div>
  )
}
```

## Server Actions

Mutate data with Server Actions:

```javascript
// app/actions.js
'use server'

export async function createPost(formData) {
  const title = formData.get('title')
  const content = formData.get('content')

  const res = await fetch('https://api.example.com/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })

  if (!res.ok) {
    throw new Error('Failed to create post')
  }

  revalidatePath('/posts')
}

// app/posts/new/page.js
import { createPost } from '@/app/actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />
      <button type="submit">Create Post</button>
    </form>
  )
}
```

## Best Practices

1. **Fetch in Server Components** - Keep data fetching on the server
2. **Use parallel fetching** - Fetch independent data with Promise.all
3. **Implement proper caching** - Use appropriate cache strategies
4. **Stream with Suspense** - Show content progressively
5. **Handle errors gracefully** - Use try/catch and error boundaries
6. **Deduplicate requests** - Leverage automatic deduplication
7. **Revalidate strategically** - Choose appropriate revalidation times
8. **Use TypeScript** - Type your data for better DX

## Common Pitfalls

1. **Fetching in Client Components** - Use Server Components for data fetching
2. **Sequential fetching** - Use Promise.all when requests are independent
3. **Not handling errors** - Always handle fetch failures
4. **Over-caching** - Use no-store for dynamic/user-specific data
5. **Under-caching** - Use force-cache for static data
6. **Forgetting to revalidate** - Stale data without revalidation
7. **Not using Suspense** - Missing streaming opportunities
8. **Waterfall requests** - Nested components causing sequential fetches

## Checklist

- [ ] Fetch data in Server Components
- [ ] Use parallel fetching when possible
- [ ] Configure appropriate cache strategies
- [ ] Implement Suspense boundaries for streaming
- [ ] Handle errors with try/catch and error.js
- [ ] Use revalidation for time-sensitive data
- [ ] Leverage request deduplication
- [ ] Avoid waterfalls with proper data flow
- [ ] Type data responses with TypeScript
- [ ] Test error states and loading states
