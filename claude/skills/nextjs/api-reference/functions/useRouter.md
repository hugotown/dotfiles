# useRouter

The `useRouter` hook allows you to programmatically navigate between routes in Client Components.

## Import

```typescript
'use client'

import { useRouter } from 'next/navigation'
```

## Function Signature

```typescript
const router = useRouter()
```

## Methods

### `router.push(href: string, options?: NavigateOptions)`
Navigate to a new route. Adds a new entry to the browser history stack.

### `router.replace(href: string, options?: NavigateOptions)`
Navigate to a new route without adding a new entry to the browser history stack.

### `router.refresh()`
Refresh the current route. Makes a new request to the server and re-renders Server Components.

### `router.back()`
Navigate back to the previous route in the browser history stack.

### `router.forward()`
Navigate forward to the next page in the browser history stack.

### `router.prefetch(href: string)`
Prefetch a route for faster client-side transitions.

## NavigateOptions

```typescript
type NavigateOptions = {
  scroll?: boolean  // Scroll to top after navigation (default: true)
}
```

## Usage Examples

### Basic Navigation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  return (
    <button onClick={() => router.push('/dashboard')}>
      Dashboard
    </button>
  )
}
```

### Navigate with Query Parameters

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function SearchForm() {
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const query = formData.get('query')

    router.push(`/search?q=${encodeURIComponent(query as string)}`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="query" type="text" />
      <button type="submit">Search</button>
    </form>
  )
}
```

### Replace Current Route

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()

  const handleLogin = async () => {
    await login()

    // Replace login page with dashboard (can't go back to login)
    router.replace('/dashboard')
  }

  return (
    <button onClick={handleLogin}>
      Login
    </button>
  )
}
```

### Back and Forward Navigation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function Navigation() {
  const router = useRouter()

  return (
    <div>
      <button onClick={() => router.back()}>Back</button>
      <button onClick={() => router.forward()}>Forward</button>
    </div>
  )
}
```

### Refresh Current Route

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function RefreshButton() {
  const router = useRouter()

  return (
    <button onClick={() => router.refresh()}>
      Refresh Data
    </button>
  )
}
```

### Prefetch Routes

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    // Prefetch frequently accessed routes
    router.prefetch('/dashboard')
    router.prefetch('/profile')
  }, [router])

  return <div>Page Content</div>
}
```

### Disable Scroll on Navigation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function TabNavigation() {
  const router = useRouter()

  const changeTab = (tab: string) => {
    // Navigate without scrolling to top
    router.push(`/dashboard?tab=${tab}`, { scroll: false })
  }

  return (
    <div>
      <button onClick={() => changeTab('overview')}>Overview</button>
      <button onClick={() => changeTab('analytics')}>Analytics</button>
    </div>
  )
}
```

### Navigate After Form Submission

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function CreatePostForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const post = await createPost(/* ... */)

      // Navigate to the new post
      router.push(`/posts/${post.id}`)
    } catch (error) {
      console.error(error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  )
}
```

### Conditional Navigation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function ActionButton() {
  const router = useRouter()

  const handleAction = async () => {
    const result = await performAction()

    if (result.success) {
      router.push('/success')
    } else {
      router.push('/error')
    }
  }

  return <button onClick={handleAction}>Perform Action</button>
}
```

### Navigate with State

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter()

  const viewProduct = () => {
    // Pass data via URL parameters or search params
    router.push(`/products/${product.id}`)

    // Or use localStorage/sessionStorage for temporary state
    sessionStorage.setItem('lastViewed', product.id)
    router.push('/products')
  }

  return (
    <button onClick={viewProduct}>
      View Product
    </button>
  )
}
```

### Refresh After Mutation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function UpdateButton() {
  const router = useRouter()

  const handleUpdate = async () => {
    await updateData()

    // Refresh to show updated data
    router.refresh()
  }

  return (
    <button onClick={handleUpdate}>
      Update
    </button>
  )
}
```

### Dynamic Route Navigation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function UserSelector({ users }: { users: User[] }) {
  const router = useRouter()

  const viewUser = (userId: string) => {
    router.push(`/users/${userId}`)
  }

  return (
    <select onChange={(e) => viewUser(e.target.value)}>
      {users.map(user => (
        <option key={user.id} value={user.id}>
          {user.name}
        </option>
      ))}
    </select>
  )
}
```

### Navigate with Confirmation

```typescript
'use client'

import { useRouter } from 'next/navigation'

export default function DeleteButton({ id }: { id: string }) {
  const router = useRouter()

  const handleDelete = async () => {
    if (confirm('Are you sure?')) {
      await deleteItem(id)
      router.push('/items')
    }
  }

  return (
    <button onClick={handleDelete}>
      Delete
    </button>
  )
}
```

### Tab Navigation Without Scroll

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'

export default function Tabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'home'

  const setTab = (tab: string) => {
    router.push(`?tab=${tab}`, { scroll: false })
  }

  return (
    <div>
      <button onClick={() => setTab('home')}>Home</button>
      <button onClick={() => setTab('profile')}>Profile</button>
      <button onClick={() => setTab('settings')}>Settings</button>

      {activeTab === 'home' && <HomeTab />}
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  )
}
```

### Locale Switching

```typescript
'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = (locale: string) => {
    // Assuming routes like /en/page or /es/page
    const segments = pathname.split('/')
    segments[1] = locale
    router.push(segments.join('/'))
  }

  return (
    <select onChange={(e) => switchLocale(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="fr">Français</option>
    </select>
  )
}
```

## Best Practices

1. **Use Only in Client Components**
   ```typescript
   // ✅ Client Component
   'use client'
   import { useRouter } from 'next/navigation'

   // ❌ Server Component
   import { useRouter } from 'next/navigation' // Error!
   ```

2. **Use router.replace() for Redirects**
   ```typescript
   // After login, replace history entry
   router.replace('/dashboard')

   // User can't navigate back to login page
   ```

3. **Use router.refresh() for Server Data**
   ```typescript
   // Refetch Server Component data
   const handleUpdate = async () => {
     await updateData()
     router.refresh()
   }
   ```

4. **Encode URL Parameters**
   ```typescript
   // ✅ Properly encoded
   router.push(`/search?q=${encodeURIComponent(query)}`)

   // ❌ Not encoded
   router.push(`/search?q=${query}`)
   ```

5. **Prefetch Important Routes**
   ```typescript
   useEffect(() => {
     router.prefetch('/important-page')
   }, [router])
   ```

6. **Use scroll: false for In-Page Navigation**
   ```typescript
   // Tab or filter changes
   router.push('/page?filter=new', { scroll: false })
   ```

## Common Patterns

### Post-Mutation Navigation

```typescript
const handleCreate = async (data: FormData) => {
  const item = await createItem(data)
  router.push(`/items/${item.id}`)
}
```

### Redirect After Auth

```typescript
const handleLogin = async () => {
  await signIn()
  router.replace('/dashboard')
}
```

### Refresh Server Data

```typescript
const handleLike = async () => {
  await likePost()
  router.refresh() // Re-render Server Components
}
```

### Go Back with Fallback

```typescript
const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/') // Fallback to home
  }
}
```

## Important Notes

- Only works in Client Components (`'use client'`)
- `router.push()` adds to history, `router.replace()` doesn't
- `router.refresh()` re-executes Server Components
- Import from `'next/navigation'`, not `'next/router'`
- Prefetching happens automatically for `<Link>` components
- `router.back()` and `router.forward()` use browser history

## Related

- [Link Component](https://nextjs.org/docs/app/api-reference/components/link) - Declarative navigation
- [usePathname](./usePathname.md) - Get current pathname
- [useSearchParams](./useSearchParams.md) - Access query parameters
- [redirect](./redirect.md) - Server-side redirects
