# notFound

The `notFound()` function allows you to trigger the rendering of a 404 error page from within Server Components, Route Handlers, and Server Actions.

## Function Signature

```typescript
import { notFound } from 'next/navigation'

function notFound(): never
```

## Return Value

This function never returns. It throws a `NEXT_NOT_FOUND` error internally to trigger the not-found UI.

## Usage Examples

### Basic Usage in Server Component

```typescript
// app/posts/[id]/page.tsx
import { notFound } from 'next/navigation'

interface Post {
  id: string
  title: string
  content: string
}

export default async function PostPage({
  params
}: {
  params: { id: string }
}) {
  const post = await getPost(params.id)

  if (!post) {
    notFound()
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

### With not-found.tsx File

```typescript
// app/posts/[id]/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h2>Post Not Found</h2>
      <p>The post you're looking for doesn't exist.</p>
      <a href="/posts">View all posts</a>
    </div>
  )
}

// app/posts/[id]/page.tsx
import { notFound } from 'next/navigation'

export default async function PostPage({
  params
}: {
  params: { id: string }
}) {
  const post = await getPost(params.id)

  if (!post) {
    notFound() // Triggers app/posts/[id]/not-found.tsx
  }

  return <div>{post.title}</div>
}
```

### Multiple Validation Checks

```typescript
import { notFound } from 'next/navigation'

export default async function ProductPage({
  params
}: {
  params: { category: string; id: string }
}) {
  const category = await getCategory(params.category)

  if (!category) {
    notFound()
  }

  const product = await getProduct(params.id)

  if (!product) {
    notFound()
  }

  // Check if product belongs to category
  if (product.categoryId !== category.id) {
    notFound()
  }

  return (
    <div>
      <h1>{product.name}</h1>
      <p>Category: {category.name}</p>
    </div>
  )
}
```

### In Server Action

```typescript
// app/actions.ts
'use server'

import { notFound } from 'next/navigation'

export async function getPostData(id: string) {
  const post = await db.post.findUnique({
    where: { id }
  })

  if (!post) {
    notFound()
  }

  return post
}
```

### In Route Handler

```typescript
// app/api/posts/[id]/route.ts
import { notFound } from 'next/navigation'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const post = await getPost(params.id)

  if (!post) {
    notFound()
  }

  return Response.json(post)
}
```

### With Database Queries

```typescript
import { notFound } from 'next/navigation'

export default async function UserPage({
  params
}: {
  params: { username: string }
}) {
  const user = await db.user.findUnique({
    where: { username: params.username }
  })

  if (!user) {
    notFound()
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>@{user.username}</p>
    </div>
  )
}
```

### Published Content Check

```typescript
import { notFound } from 'next/navigation'

export default async function ArticlePage({
  params
}: {
  params: { slug: string }
}) {
  const article = await getArticle(params.slug)

  // Article doesn't exist
  if (!article) {
    notFound()
  }

  // Article exists but isn't published
  if (!article.published) {
    const user = await getCurrentUser()

    // Only show unpublished to authors
    if (!user || user.id !== article.authorId) {
      notFound()
    }
  }

  return <ArticleView article={article} />
}
```

### Nested not-found.tsx Files

```typescript
// app/not-found.tsx (root level)
export default function RootNotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">Go home</a>
    </div>
  )
}

// app/blog/not-found.tsx (blog section)
export default function BlogNotFound() {
  return (
    <div>
      <h1>Blog Post Not Found</h1>
      <p>This blog post doesn't exist.</p>
      <a href="/blog">View all posts</a>
    </div>
  )
}

// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

export default async function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound() // Triggers app/blog/not-found.tsx
  }

  return <div>{post.title}</div>
}
```

### With Authorization

```typescript
import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'

export default async function PrivateDocPage({
  params
}: {
  params: { id: string }
}) {
  const doc = await getDocument(params.id)

  // Document doesn't exist
  if (!doc) {
    notFound()
  }

  const user = await getCurrentUser()

  // Not logged in - redirect to login
  if (!user) {
    redirect('/login')
  }

  // Logged in but no access - show 404
  // (Don't reveal that the doc exists)
  if (!canAccess(user, doc)) {
    notFound()
  }

  return <DocumentView doc={doc} />
}
```

### Handling Invalid IDs

```typescript
import { notFound } from 'next/navigation'

export default async function Page({
  params
}: {
  params: { id: string }
}) {
  // Validate ID format
  if (!isValidObjectId(params.id)) {
    notFound()
  }

  const item = await getItem(params.id)

  if (!item) {
    notFound()
  }

  return <ItemView item={item} />
}
```

### With Type Guards

```typescript
import { notFound } from 'next/navigation'

type Post = {
  id: string
  title: string
  content: string
}

async function getPost(id: string): Promise<Post | null> {
  // ... database query
  return null
}

export default async function PostPage({
  params
}: {
  params: { id: string }
}) {
  const post = await getPost(params.id)

  if (!post) {
    notFound()
  }

  // TypeScript knows post is Post (not null) here
  return <h1>{post.title}</h1>
}
```

## Creating not-found.tsx Files

Create custom 404 pages at different levels of your app:

### Root Level

```typescript
// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">404</h1>
      <h2 className="text-2xl">Page Not Found</h2>
      <p className="mt-4">Could not find the requested resource</p>
      <Link href="/" className="mt-6 text-blue-500 hover:underline">
        Return Home
      </Link>
    </div>
  )
}
```

### Section Level

```typescript
// app/blog/not-found.tsx
import Link from 'next/link'

export default function BlogNotFound() {
  return (
    <div>
      <h1>Blog Post Not Found</h1>
      <p>This blog post doesn't exist or has been removed.</p>
      <div className="mt-6 space-x-4">
        <Link href="/blog">All Posts</Link>
        <Link href="/">Home</Link>
      </div>
    </div>
  )
}
```

### Dynamic Segment Level

```typescript
// app/users/[id]/not-found.tsx
import Link from 'next/link'

export default function UserNotFound() {
  return (
    <div>
      <h1>User Not Found</h1>
      <p>The user you're looking for doesn't exist.</p>
      <Link href="/users">View all users</Link>
    </div>
  )
}
```

## Best Practices

1. **Check Existence Before Using Data**
   ```typescript
   // ✅ Check first
   const post = await getPost(id)
   if (!post) notFound()
   return <h1>{post.title}</h1>

   // ❌ Don't use optional chaining as a workaround
   const post = await getPost(id)
   return <h1>{post?.title}</h1> // Shows blank if null
   ```

2. **Use Specific not-found.tsx Files**
   ```typescript
   // Create contextual 404 pages
   // app/products/not-found.tsx
   // app/blog/not-found.tsx
   // app/users/not-found.tsx
   ```

3. **Don't Reveal Sensitive Information**
   ```typescript
   // ✅ Hide existence of private resources
   if (!doc || !canAccess(user, doc)) {
     notFound()
   }

   // ❌ Don't reveal that resource exists
   if (!doc) notFound()
   if (!canAccess(user, doc)) {
     return <div>Access Denied</div>
   }
   ```

4. **Validate Early**
   ```typescript
   // ✅ Validate format first
   if (!isValidId(params.id)) {
     notFound()
   }

   const item = await getItem(params.id)
   if (!item) {
     notFound()
   }
   ```

5. **Don't Use in Client Components**
   ```typescript
   // ❌ Won't work
   'use client'
   export default function ClientPage() {
     notFound() // Error!
   }

   // ✅ Call in Server Component or action
   export default async function ServerPage() {
     const data = await getData()
     if (!data) notFound()
   }
   ```

6. **Combine with Other Checks**
   ```typescript
   const post = await getPost(id)

   if (!post) {
     notFound()
   }

   if (post.private && !user) {
     redirect('/login')
   }

   if (!canView(user, post)) {
     notFound() // Or redirect to /unauthorized
   }
   ```

## Common Patterns

### Resource Not Found

```typescript
export default async function Page({ params }: { params: { id: string } }) {
  const resource = await fetchResource(params.id)

  if (!resource) {
    notFound()
  }

  return <ResourceView resource={resource} />
}
```

### Conditional Access

```typescript
export default async function Page({ params }: { params: { id: string } }) {
  const item = await getItem(params.id)

  if (!item || (item.private && !await hasAccess(item))) {
    notFound()
  }

  return <ItemView item={item} />
}
```

### Invalid Parameter

```typescript
export default async function Page({ params }: { params: { id: string } }) {
  if (!isValidUUID(params.id)) {
    notFound()
  }

  const data = await fetchData(params.id)

  if (!data) {
    notFound()
  }

  return <DataView data={data} />
}
```

## Error Handling

The `notFound()` function throws a `NEXT_NOT_FOUND` error. This is expected behavior:

```typescript
// You don't need try-catch for notFound()
export default async function Page({ params }: { params: { id: string } }) {
  const post = await getPost(params.id)

  if (!post) {
    notFound() // Throws NEXT_NOT_FOUND - this is normal
  }

  // Code after notFound() won't execute
  return <div>{post.title}</div>
}
```

## HTTP Status Code

When `notFound()` is called, Next.js returns a **404 Not Found** HTTP status code.

## not-found.tsx Resolution

Next.js looks for `not-found.tsx` files in this order:

1. Same directory as the page
2. Parent directories (walking up)
3. Root `app/not-found.tsx`

```
app/
├── not-found.tsx           # Root fallback
└── blog/
    ├── not-found.tsx       # Blog section
    └── [slug]/
        ├── not-found.tsx   # Blog post specific
        └── page.tsx
```

## Notes

- Only works in Server Components, Route Handlers, and Server Actions
- Throws a `NEXT_NOT_FOUND` error (expected behavior)
- Code after `notFound()` won't execute
- Triggers the nearest `not-found.tsx` file
- Returns HTTP 404 status code
- Cannot be used in Client Components
- Doesn't require try-catch handling

## Related

- [redirect](./redirect.md) - Redirect to another page
- [error.tsx](https://nextjs.org/docs/app/api-reference/file-conventions/error) - Handle errors
- [not-found.tsx](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) - Custom 404 UI
