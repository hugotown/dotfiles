# Error Handling

Learn how to handle errors gracefully in Next.js App Router using error boundaries, not-found pages, and error recovery patterns.

## Error Boundaries

Next.js uses React Error Boundaries to handle errors in specific route segments.

### Basic Error Boundary

```javascript
// app/dashboard/error.js
'use client' // Error components must be Client Components

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}

// app/dashboard/page.js
export default async function DashboardPage() {
  const data = await fetchData() // If this throws, error.js catches it

  return <div>{data.value}</div>
}
```

### Error Props

```typescript
// app/error.tsx
'use client'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="error-container">
      <h2>Error Occurred</h2>
      <p>{error.message}</p>
      {error.digest && <p>Error ID: {error.digest}</p>}
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Error Hierarchy

Errors bubble up to the nearest error boundary:

```
app/
├── layout.js
├── error.js              # Catches errors in root layout children
├── page.js
└── dashboard/
    ├── layout.js
    ├── error.js          # Catches errors in dashboard segment
    ├── page.js
    └── analytics/
        ├── error.js      # Catches errors in analytics segment
        └── page.js
```

### Error Boundary Example

```javascript
// app/error.js (Root error boundary)
'use client'

export default function RootError({ error, reset }) {
  return (
    <html>
      <body>
        <h1>Application Error</h1>
        <p>{error.message}</p>
        <button onClick={reset}>Reset</button>
      </body>
    </html>
  )
}

// app/dashboard/error.js (Dashboard error boundary)
'use client'

export default function DashboardError({ error, reset }) {
  return (
    <div className="dashboard-error">
      <h2>Dashboard Error</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Global Error Handler

Handle errors in the root layout with `global-error.js`:

```javascript
// app/global-error.js
'use client'

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body>
        <h1>Global Error</h1>
        <p>{error.message}</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
```

**Note:** `global-error.js` must include `<html>` and `<body>` tags as it replaces the root layout when active.

## Not Found Errors

Handle 404 errors with `not-found.js`:

### Basic Not Found Page

```javascript
// app/not-found.js
import Link from 'next/link'

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  )
}
```

### Programmatic Not Found

```javascript
// app/blog/[slug]/page.js
import { notFound } from 'next/navigation'

async function getPost(slug) {
  const res = await fetch(`https://api.example.com/posts/${slug}`)

  if (!res.ok) {
    return null
  }

  return res.json()
}

export default async function BlogPost({ params }) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound() // Triggers not-found.js
  }

  return <article>{post.content}</article>
}
```

### Nested Not Found

```javascript
// app/blog/not-found.js
export default function BlogNotFound() {
  return (
    <div>
      <h2>Blog Post Not Found</h2>
      <p>The requested blog post does not exist</p>
      <Link href="/blog">View all posts</Link>
    </div>
  )
}

// app/blog/[slug]/page.js
import { notFound } from 'next/navigation'

export default async function BlogPost({ params }) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound() // Uses app/blog/not-found.js
  }

  return <article>{post.content}</article>
}
```

## Error Recovery

The `reset()` function attempts to re-render the error boundary:

```javascript
// app/posts/error.js
'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error to error reporting service
    console.error('Error:', error)
  }, [error])

  return (
    <div>
      <h2>Failed to load posts</h2>
      <p>{error.message}</p>
      <div>
        <button onClick={() => reset()}>
          Try again
        </button>
        <button onClick={() => window.location.href = '/'}>
          Go home
        </button>
      </div>
    </div>
  )
}
```

## Loading States During Error Recovery

```javascript
// app/dashboard/error.js
'use client'

import { useState } from 'react'

export default function Error({ error, reset }) {
  const [isResetting, setIsResetting] = useState(false)

  async function handleReset() {
    setIsResetting(true)
    try {
      await reset()
    } catch (err) {
      console.error('Reset failed:', err)
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={handleReset} disabled={isResetting}>
        {isResetting ? 'Retrying...' : 'Try again'}
      </button>
    </div>
  )
}
```

## Custom Error Types

Handle different error types:

```javascript
// lib/errors.js
export class AuthenticationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NotFoundError'
  }
}

// app/dashboard/page.js
import { AuthenticationError } from '@/lib/errors'

export default async function Dashboard() {
  const session = await getSession()

  if (!session) {
    throw new AuthenticationError('Please log in to continue')
  }

  return <div>Dashboard</div>
}

// app/dashboard/error.js
'use client'

export default function Error({ error, reset }) {
  if (error.name === 'AuthenticationError') {
    return (
      <div>
        <h2>Authentication Required</h2>
        <p>{error.message}</p>
        <a href="/login">Go to Login</a>
      </div>
    )
  }

  return (
    <div>
      <h2>Error</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## API Route Error Handling

Handle errors in API routes:

```javascript
// app/api/users/route.js
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const users = await db.user.findMany()

    return NextResponse.json(users)
  } catch (error) {
    console.error('Database error:', error)

    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const body = await request.json()

    // Validation
    if (!body.email || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const user = await db.user.create({
      data: body,
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)

    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
```

## Server Action Error Handling

Handle errors in Server Actions:

```javascript
// app/actions.js
'use server'

export async function createPost(formData) {
  try {
    const title = formData.get('title')
    const content = formData.get('content')

    if (!title || !content) {
      return { error: 'Title and content are required' }
    }

    const post = await db.post.create({
      data: { title, content },
    })

    revalidatePath('/blog')
    return { success: true, post }
  } catch (error) {
    console.error('Error creating post:', error)
    return { error: 'Failed to create post' }
  }
}

// app/blog/new/page.js
'use client'

import { createPost } from '@/app/actions'
import { useState } from 'react'

export default function NewPost() {
  const [error, setError] = useState(null)

  async function handleSubmit(formData) {
    const result = await createPost(formData)

    if (result.error) {
      setError(result.error)
    } else {
      // Success
      window.location.href = '/blog'
    }
  }

  return (
    <form action={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input name="title" placeholder="Title" />
      <textarea name="content" placeholder="Content" />
      <button type="submit">Create Post</button>
    </form>
  )
}
```

## Error Monitoring

Integrate with error monitoring services:

```javascript
// app/error.js
'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log to Sentry
    Sentry.captureException(error)

    // Or your custom error service
    fetch('/api/log-error', {
      method: 'POST',
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }),
    })
  }, [error])

  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Styled Error Pages

Create professional error pages:

```javascript
// app/error.js
'use client'

export default function Error({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-gray-600">
            {error.message || 'An unexpected error occurred'}
          </p>
          <div className="mt-6 space-x-4">
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try again
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
```

## Error Handling Patterns

### Graceful Degradation

```javascript
// app/dashboard/page.js
export default async function Dashboard() {
  let userData = null
  let statsData = null

  try {
    userData = await fetchUser()
  } catch (error) {
    console.error('Failed to fetch user:', error)
  }

  try {
    statsData = await fetchStats()
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }

  return (
    <div>
      {userData ? (
        <UserProfile user={userData} />
      ) : (
        <p>Unable to load user profile</p>
      )}

      {statsData ? (
        <Stats data={statsData} />
      ) : (
        <p>Stats unavailable</p>
      )}
    </div>
  )
}
```

### Fallback Content

```javascript
// app/blog/page.js
async function getPosts() {
  try {
    const res = await fetch('https://api.example.com/posts')
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  } catch (error) {
    console.error('Error fetching posts:', error)
    return [] // Return empty array as fallback
  }
}

export default async function BlogPage() {
  const posts = await getPosts()

  if (posts.length === 0) {
    return (
      <div>
        <h1>Blog</h1>
        <p>No posts available at the moment. Please check back later.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Blog</h1>
      <PostList posts={posts} />
    </div>
  )
}
```

## Best Practices

1. **Create error boundaries at appropriate levels** - Don't just rely on root error boundary
2. **Provide helpful error messages** - Tell users what went wrong and what to do
3. **Implement error recovery** - Allow users to retry failed operations
4. **Log errors** - Send to monitoring service for debugging
5. **Handle not-found separately** - Use not-found.js for 404s
6. **Test error states** - Verify error handling works as expected
7. **Use custom error types** - Different handling for different error types
8. **Graceful degradation** - Show partial content when possible

## Common Pitfalls

1. **Not using 'use client'** - Error components must be Client Components
2. **Forgetting global-error.js** - Root layout errors need special handling
3. **Not logging errors** - Missing critical debugging information
4. **Poor error messages** - Generic messages don't help users
5. **No recovery mechanism** - Users stuck in error state
6. **Catching too broadly** - Errors should bubble to appropriate boundary
7. **Not testing error states** - Broken error handling discovered in production
8. **Exposing sensitive data** - Error messages revealing internal details

## Error Handling Checklist

- [ ] Implement error.js at appropriate route levels
- [ ] Create global-error.js for root layout errors
- [ ] Add not-found.js for 404 handling
- [ ] Provide clear, helpful error messages
- [ ] Implement error recovery with reset()
- [ ] Log errors to monitoring service
- [ ] Test error boundaries
- [ ] Handle API route errors
- [ ] Handle Server Action errors
- [ ] Style error pages professionally
- [ ] Implement graceful degradation where appropriate
- [ ] Never expose sensitive information in errors
