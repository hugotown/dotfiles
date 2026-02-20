# redirect & permanentRedirect

The `redirect()` and `permanentRedirect()` functions allow you to redirect users to another URL from Server Components, Route Handlers, and Server Actions.

## Function Signatures

```typescript
import { redirect, permanentRedirect } from 'next/navigation'

function redirect(path: string, type?: 'replace' | 'push'): never
function permanentRedirect(path: string, type?: 'replace' | 'push'): never
```

## Parameters

### `path`
- **Type**: `string`
- **Description**: The URL to redirect to. Can be relative or absolute.

### `type` (optional)
- **Type**: `'replace' | 'push'`
- **Default**: `'replace'`
- **Description**: The type of redirect to perform
  - `'replace'` - Replace current history entry (default)
  - `'push'` - Add new entry to history stack

## Return Value

These functions never return. They throw a `NEXT_REDIRECT` error internally to stop execution.

## HTTP Status Codes

- `redirect()` - Returns **307** (Temporary Redirect) by default
- `permanentRedirect()` - Returns **308** (Permanent Redirect)

## Usage Examples

### Basic Redirect in Server Component

```typescript
// app/profile/page.tsx
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return <div>Profile Page</div>
}
```

### Redirect After Authentication Check

```typescript
// app/admin/page.tsx
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.isAdmin) {
    redirect('/unauthorized')
  }

  return <div>Admin Dashboard</div>
}
```

### Redirect in Server Action

```typescript
// app/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  const content = formData.get('content')

  // Save to database
  const post = await db.post.create({
    data: { title, content }
  })

  revalidatePath('/posts')
  redirect(`/posts/${post.id}`)
}
```

### Redirect in Route Handler

```typescript
// app/api/auth/route.ts
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    redirect('/login')
  }

  // Verify token and create session
  const session = await verifyToken(token)

  if (!session) {
    redirect('/login?error=invalid_token')
  }

  redirect('/dashboard')
}
```

### Permanent Redirect

```typescript
// app/old-page/page.tsx
import { permanentRedirect } from 'next/navigation'

export default function OldPage() {
  // This page has moved permanently
  permanentRedirect('/new-page')
}
```

### Redirect with Query Parameters

```typescript
'use server'

import { redirect } from 'next/navigation'

export async function searchProducts(query: string) {
  if (!query) {
    redirect('/products')
  }

  redirect(`/products?search=${encodeURIComponent(query)}`)
}
```

### Conditional Redirects

```typescript
import { redirect } from 'next/navigation'

export default async function Page({
  params
}: {
  params: { id: string }
}) {
  const post = await getPost(params.id)

  if (!post) {
    redirect('/404')
  }

  if (post.draft && !isAdmin()) {
    redirect('/')
  }

  if (post.redirectUrl) {
    redirect(post.redirectUrl)
  }

  return <PostView post={post} />
}
```

### Redirect After Form Submission

```typescript
// app/posts/new/page.tsx
import { createPost } from './actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  )
}

// app/posts/new/actions.ts
'use server'

import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const post = await db.post.create({
    data: {
      title: formData.get('title'),
      content: formData.get('content')
    }
  })

  // Redirect to the new post
  redirect(`/posts/${post.id}`)
}
```

### Redirect with Type Parameter

```typescript
'use server'

import { redirect } from 'next/navigation'

export async function navigateToProduct(id: string) {
  // Replace current entry (default)
  redirect(`/products/${id}`, 'replace')

  // Or push new entry to history
  // redirect(`/products/${id}`, 'push')
}
```

### External Redirects

```typescript
import { redirect } from 'next/navigation'

export default async function ExternalRedirect() {
  // Redirect to external URL
  redirect('https://example.com')
}
```

### Locale-based Redirects

```typescript
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'en'

  if (locale !== 'en') {
    redirect(`/${locale}/home`)
  }

  return <div>Home Page</div>
}
```

### Redirect After Logout

```typescript
'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function logout() {
  const cookieStore = await cookies()

  // Clear session cookie
  cookieStore.delete('session')

  // Redirect to home page
  redirect('/')
}
```

### Feature Flag Redirects

```typescript
import { redirect } from 'next/navigation'

export default async function BetaFeaturePage() {
  const flags = await getFeatureFlags()

  if (!flags.betaFeature) {
    redirect('/')
  }

  return <div>Beta Feature</div>
}
```

## Best Practices

1. **Use redirect for Temporary Changes**
   ```typescript
   // Temporary redirect (307)
   redirect('/maintenance')
   ```

2. **Use permanentRedirect for Moved Content**
   ```typescript
   // Permanent redirect (308) - tells search engines
   permanentRedirect('/new-url')
   ```

3. **Redirect Early**
   ```typescript
   // ✅ Check auth first
   export default async function Page() {
     const user = await getUser()
     if (!user) redirect('/login')

     const data = await fetchData()
     return <div>{data}</div>
   }

   // ❌ Don't fetch data if you'll redirect
   export default async function Page() {
     const data = await fetchData() // Wasted work
     const user = await getUser()
     if (!user) redirect('/login')

     return <div>{data}</div>
   }
   ```

4. **Handle Redirects in try-catch**
   ```typescript
   // No need for try-catch - redirect throws internally
   // Next.js handles it automatically
   export default async function Page() {
     const user = await getUser()
     if (!user) redirect('/login') // This is fine
     return <div>Content</div>
   }
   ```

5. **Combine with Revalidation**
   ```typescript
   'use server'

   import { redirect } from 'next/navigation'
   import { revalidatePath } from 'next/cache'

   export async function updatePost(id: string, data: any) {
     await db.post.update({ where: { id }, data })

     revalidatePath('/posts')
     revalidatePath(`/posts/${id}`)
     redirect(`/posts/${id}`)
   }
   ```

6. **Encode Query Parameters**
   ```typescript
   const query = 'hello world'

   // ✅ Properly encoded
   redirect(`/search?q=${encodeURIComponent(query)}`)

   // ❌ Not encoded - may break
   redirect(`/search?q=${query}`)
   ```

7. **Don't Use in Client Components**
   ```typescript
   // ❌ Won't work in Client Components
   'use client'
   export default function ClientComponent() {
     redirect('/somewhere') // Error!
   }

   // ✅ Use router.push() instead
   'use client'
   import { useRouter } from 'next/navigation'

   export default function ClientComponent() {
     const router = useRouter()

     const handleClick = () => {
       router.push('/somewhere')
     }

     return <button onClick={handleClick}>Go</button>
   }
   ```

## Common Patterns

### Protected Route

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

export default async function ProtectedPage() {
  const session = await getServerSession()

  if (!session) {
    redirect('/api/auth/signin')
  }

  return <div>Protected Content</div>
}
```

### Role-Based Access

```typescript
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/unauthorized')

  return <div>Admin Panel</div>
}
```

### Post-Mutation Redirect

```typescript
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function deletePost(id: string) {
  await db.post.delete({ where: { id } })

  revalidatePath('/posts')
  redirect('/posts')
}
```

## Error Handling

Redirects throw a `NEXT_REDIRECT` error internally. This is expected behavior and handled by Next.js:

```typescript
// You don't need to catch redirect errors
export default async function Page() {
  const user = await getUser()

  if (!user) {
    redirect('/login') // Throws NEXT_REDIRECT - this is normal
  }

  // Code after redirect won't execute
  return <div>Content</div>
}
```

## Notes

- `redirect()` and `permanentRedirect()` can only be called in Server Components, Route Handlers, and Server Actions
- They work by throwing a `NEXT_REDIRECT` error (this is expected behavior)
- Code after `redirect()` won't execute
- For client-side navigation, use `useRouter()` from `next/navigation`
- Redirects are SEO-friendly and preserve proper HTTP status codes
- External URLs are supported
- Relative and absolute paths are supported

## Related

- [useRouter](./useRouter.md) - Client-side navigation
- [notFound](./notFound.md) - Trigger 404 pages
- [revalidatePath](./revalidatePath.md) - Revalidate cached paths
- [NextResponse.redirect](./NextResponse.md#redirect) - Redirect in middleware
