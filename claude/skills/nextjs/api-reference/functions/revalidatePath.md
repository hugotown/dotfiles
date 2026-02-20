# revalidatePath

The `revalidatePath()` function allows you to purge cached data on-demand for a specific path, causing fresh data to be fetched on the next request.

## Function Signature

```typescript
import { revalidatePath } from 'next/cache'

function revalidatePath(path: string, type?: 'page' | 'layout'): void
```

## Parameters

### `path`
- **Type**: `string`
- **Description**: The path to revalidate. Can be a literal path (e.g., `/posts/1`) or a route pattern (e.g., `/posts/[slug]`)

### `type` (optional)
- **Type**: `'page' | 'layout'`
- **Default**: `'page'`
- **Description**: The type of path to revalidate
  - `'page'` - Revalidate only the specific page
  - `'layout'` - Revalidate the layout and all nested pages

## Return Value

Returns `void`.

## Usage Examples

### Basic Revalidation in Server Action

```typescript
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  const content = formData.get('content')

  // Save to database
  await db.post.create({
    data: { title, content }
  })

  // Revalidate the posts list page
  revalidatePath('/posts')
}
```

### Revalidate Multiple Paths

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function updatePost(id: string, data: any) {
  await db.post.update({
    where: { id },
    data
  })

  // Revalidate multiple related paths
  revalidatePath('/posts')           // Posts list
  revalidatePath(`/posts/${id}`)     // Individual post
  revalidatePath('/')                // Home page
}
```

### Revalidate After Delete

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deletePost(id: string) {
  await db.post.delete({
    where: { id }
  })

  revalidatePath('/posts')
  redirect('/posts')
}
```

### Revalidate Layout

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function updateUserProfile(userId: string, data: any) {
  await db.user.update({
    where: { id: userId },
    data
  })

  // Revalidate layout to update navbar, etc.
  revalidatePath('/dashboard', 'layout')
}
```

### In Route Handler

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')

  if (!path) {
    return Response.json(
      { error: 'Path required' },
      { status: 400 }
    )
  }

  revalidatePath(path)

  return Response.json({ revalidated: true, now: Date.now() })
}
```

### Webhook Revalidation

```typescript
// app/api/webhook/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { secret, path } = await request.json()

  // Verify webhook secret
  if (secret !== process.env.WEBHOOK_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 })
  }

  revalidatePath(path)

  return Response.json({ revalidated: true })
}
```

### Content Management System Integration

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function publishArticle(id: string) {
  const article = await db.article.update({
    where: { id },
    data: { published: true, publishedAt: new Date() }
  })

  // Revalidate all affected pages
  revalidatePath('/')                      // Home page
  revalidatePath('/articles')              // Articles list
  revalidatePath(`/articles/${article.slug}`) // Individual article
  revalidatePath('/sitemap.xml')           // Sitemap

  return article
}
```

### E-commerce Product Update

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function updateProduct(id: string, data: any) {
  const product = await db.product.update({
    where: { id },
    data
  })

  // Revalidate product pages
  revalidatePath('/products')
  revalidatePath(`/products/${product.slug}`)
  revalidatePath(`/categories/${product.categoryId}`)

  return product
}
```

### Form Submission with Revalidation

```typescript
// app/posts/new/page.tsx
import { createPost } from './actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create</button>
    </form>
  )
}

// app/posts/new/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: {
      title: formData.get('title'),
      content: formData.get('content')
    }
  })

  revalidatePath('/posts')
  redirect(`/posts/${post.id}`)
}
```

### Optimistic Updates with Revalidation

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function toggleLike(postId: string, userId: string) {
  const like = await db.like.findUnique({
    where: {
      postId_userId: { postId, userId }
    }
  })

  if (like) {
    await db.like.delete({
      where: { id: like.id }
    })
  } else {
    await db.like.create({
      data: { postId, userId }
    })
  }

  // Revalidate to show updated like count
  revalidatePath(`/posts/${postId}`)
}
```

### Revalidate Dynamic Segments

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function updateComment(postId: string, commentId: string) {
  await db.comment.update({
    where: { id: commentId },
    data: { /* ... */ }
  })

  // Revalidate the dynamic route
  revalidatePath(`/posts/${postId}`)
}
```

### Batch Revalidation

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateAll() {
  const paths = [
    '/',
    '/about',
    '/posts',
    '/products',
    '/contact'
  ]

  paths.forEach(path => {
    revalidatePath(path)
  })

  return { revalidated: paths.length }
}
```

### Conditional Revalidation

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function updatePost(id: string, data: any, published: boolean) {
  await db.post.update({
    where: { id },
    data
  })

  // Only revalidate public pages if post is published
  if (published) {
    revalidatePath('/posts')
    revalidatePath(`/posts/${id}`)
  }

  // Always revalidate admin dashboard
  revalidatePath('/admin/posts')
}
```

## Best Practices

1. **Revalidate All Related Paths**
   ```typescript
   'use server'

   export async function updatePost(id: string, data: any) {
     await db.post.update({ where: { id }, data })

     // Revalidate all paths that show this post
     revalidatePath('/posts')           // List page
     revalidatePath(`/posts/${id}`)     // Detail page
     revalidatePath('/')                // Home page (if showing recent posts)
   }
   ```

2. **Use Layout Type for Shared Components**
   ```typescript
   'use server'

   export async function updateUserSettings(userId: string, settings: any) {
     await db.user.update({ where: { id: userId }, data: settings })

     // Revalidate layout to update navbar, sidebar, etc.
     revalidatePath('/dashboard', 'layout')
   }
   ```

3. **Combine with redirect**
   ```typescript
   'use server'

   import { revalidatePath } from 'next/cache'
   import { redirect } from 'next/navigation'

   export async function createPost(data: any) {
     const post = await db.post.create({ data })

     revalidatePath('/posts')
     redirect(`/posts/${post.id}`)
   }
   ```

4. **Don't Overuse**
   ```typescript
   // ❌ Revalidating on every request defeats caching
   export async function GET() {
     revalidatePath('/data')
     const data = await fetchData()
     return Response.json(data)
   }

   // ✅ Only revalidate when data changes
   export async function POST() {
     await updateData()
     revalidatePath('/data')
     return Response.json({ success: true })
   }
   ```

5. **Use in Server Actions and Route Handlers Only**
   ```typescript
   // ✅ Server Action
   'use server'
   export async function updateData() {
     revalidatePath('/data')
   }

   // ✅ Route Handler
   export async function POST() {
     revalidatePath('/data')
     return Response.json({ ok: true })
   }

   // ❌ Server Component (won't work)
   export default async function Page() {
     revalidatePath('/data') // Error!
     return <div>Page</div>
   }
   ```

6. **Consider Using revalidateTag for More Granular Control**
   ```typescript
   // If you need to revalidate multiple related items
   // across different paths, consider using tags

   // Instead of:
   revalidatePath('/posts')
   revalidatePath('/posts/1')
   revalidatePath('/posts/2')

   // Use:
   revalidateTag('posts')
   ```

## Common Patterns

### CRUD Operations

```typescript
'use server'

import { revalidatePath } from 'next/cache'

// Create
export async function createItem(data: any) {
  await db.item.create({ data })
  revalidatePath('/items')
}

// Update
export async function updateItem(id: string, data: any) {
  await db.item.update({ where: { id }, data })
  revalidatePath('/items')
  revalidatePath(`/items/${id}`)
}

// Delete
export async function deleteItem(id: string) {
  await db.item.delete({ where: { id } })
  revalidatePath('/items')
}
```

### On-Demand ISR (Incremental Static Regeneration)

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  const secret = searchParams.get('secret')

  // Verify secret
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!path) {
    return Response.json({ error: 'Path required' }, { status: 400 })
  }

  revalidatePath(path)

  return Response.json({ revalidated: true, now: Date.now() })
}

// Usage: GET /api/revalidate?path=/posts&secret=xxx
```

### CMS Webhook Handler

```typescript
// app/api/cms-webhook/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { event, data } = await request.json()

  switch (event) {
    case 'post.published':
      revalidatePath('/posts')
      revalidatePath(`/posts/${data.slug}`)
      break

    case 'page.updated':
      revalidatePath(`/${data.slug}`)
      break

    case 'menu.updated':
      revalidatePath('/', 'layout')
      break
  }

  return Response.json({ received: true })
}
```

## Notes

- Only works in Server Actions and Route Handlers
- Cannot be used in Server Components
- Does not return a value
- Revalidation is synchronous
- Affects all data fetching in the specified path
- Use `type: 'layout'` to revalidate the layout and all child pages
- Does not trigger rebuilds in development mode
- Combined with ISR for on-demand revalidation

## Related

- [revalidateTag](./revalidateTag.md) - Revalidate by cache tag
- [fetch](./fetch.md) - Fetch with caching options
- [unstable_cache](./unstable_cache.md) - Cache function results
- [redirect](./redirect.md) - Redirect after revalidation
