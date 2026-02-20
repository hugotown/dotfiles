# Linking and Navigating

Master client-side navigation in Next.js App Router using the Link component, useRouter hook, and navigation APIs.

## Link Component

The `<Link>` component is the primary way to navigate between routes.

### Basic Link

```javascript
import Link from 'next/link'

export default function Nav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href="/blog">Blog</Link>
    </nav>
  )
}
```

### Link with Dynamic Routes

```javascript
import Link from 'next/link'

export default function BlogList({ posts }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

### Link with Query Parameters

```javascript
<Link href={{
  pathname: '/products',
  query: { category: 'electronics', sort: 'price' },
}}>
  Electronics
</Link>

// URL: /products?category=electronics&sort=price
```

### Link with Hash

```javascript
<Link href="/docs#installation">
  Jump to Installation
</Link>
```

### Styling Active Links

```javascript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav>
      <Link
        href="/"
        className={pathname === '/' ? 'active' : ''}
      >
        Home
      </Link>
      <Link
        href="/about"
        className={pathname === '/about' ? 'active' : ''}
      >
        About
      </Link>
    </nav>
  )
}
```

### Link Props

```javascript
<Link
  href="/dashboard"
  replace          // Replace history instead of push
  scroll={false}   // Disable scroll to top
  prefetch={false} // Disable prefetching
>
  Dashboard
</Link>
```

## useRouter Hook

For programmatic navigation, use the `useRouter` hook.

### Basic Navigation

```javascript
'use client'

import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    // Handle login...
    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit">Login</button>
    </form>
  )
}
```

### Router Methods

```javascript
'use client'

import { useRouter } from 'next/navigation'

export default function Navigation() {
  const router = useRouter()

  return (
    <div>
      <button onClick={() => router.push('/dashboard')}>
        Go to Dashboard
      </button>

      <button onClick={() => router.replace('/login')}>
        Replace with Login
      </button>

      <button onClick={() => router.back()}>
        Go Back
      </button>

      <button onClick={() => router.forward()}>
        Go Forward
      </button>

      <button onClick={() => router.refresh()}>
        Refresh Data
      </button>
    </div>
  )
}
```

### Navigate with Query Parameters

```javascript
'use client'

import { useRouter } from 'next/navigation'

export default function FilterProducts() {
  const router = useRouter()

  function applyFilter(category) {
    router.push(`/products?category=${category}`)
  }

  return (
    <div>
      <button onClick={() => applyFilter('electronics')}>
        Electronics
      </button>
      <button onClick={() => applyFilter('clothing')}>
        Clothing
      </button>
    </div>
  )
}
```

## usePathname Hook

Get the current pathname:

```javascript
'use client'

import { usePathname } from 'next/navigation'

export default function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <nav>
      <Link href="/">Home</Link>
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/')
        return (
          <span key={href}>
            {' / '}
            <Link href={href}>{segment}</Link>
          </span>
        )
      })}
    </nav>
  )
}
```

## useSearchParams Hook

Access URL search parameters:

```javascript
'use client'

import { useSearchParams } from 'next/navigation'

export default function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')
  const sort = searchParams.get('sort')

  return (
    <div>
      <p>Search: {query}</p>
      <p>Sort: {sort || 'default'}</p>
    </div>
  )
}
```

### Update Search Params

```javascript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function FilterPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateFilter(key, value) {
    const params = new URLSearchParams(searchParams)
    params.set(key, value)
    router.push(`?${params.toString()}`)
  }

  return (
    <div>
      <button onClick={() => updateFilter('sort', 'price')}>
        Sort by Price
      </button>
      <button onClick={() => updateFilter('sort', 'date')}>
        Sort by Date
      </button>
    </div>
  )
}
```

## Server-Side Navigation

Use `redirect` for server-side navigation:

```javascript
// app/profile/page.js
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function ProfilePage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return <div>Profile</div>
}
```

### Redirect with URL

```javascript
import { redirect } from 'next/navigation'

export default async function OldPage() {
  redirect('/new-page')
}
```

### Conditional Redirect

```javascript
import { redirect } from 'next/navigation'

export default async function Page({ params }) {
  const post = await getPost(params.id)

  if (!post) {
    redirect('/404')
  }

  if (post.status === 'draft') {
    redirect('/blog')
  }

  return <article>{post.content}</article>
}
```

## Prefetching

Next.js automatically prefetches routes when `<Link>` components appear in the viewport.

### Disable Prefetching

```javascript
<Link href="/dashboard" prefetch={false}>
  Dashboard
</Link>
```

### Programmatic Prefetch

```javascript
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function PrefetchExample() {
  const router = useRouter()

  useEffect(() => {
    // Prefetch the dashboard route
    router.prefetch('/dashboard')
  }, [router])

  return <div>Prefetching dashboard...</div>
}
```

## Scroll Behavior

### Disable Scroll to Top

```javascript
<Link href="/blog" scroll={false}>
  Blog (no scroll)
</Link>
```

### Manual Scroll Control

```javascript
'use client'

import { useRouter } from 'next/navigation'

export default function NavigateWithScroll() {
  const router = useRouter()

  function navigate() {
    router.push('/about')
    window.scrollTo(0, 0) // Scroll to top
  }

  return <button onClick={navigate}>Go to About</button>
}
```

## Loading States

Show loading UI during navigation:

```javascript
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NavigateWithLoading() {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)

  async function navigate() {
    setIsNavigating(true)
    router.push('/dashboard')
    // Loading state will show until page loads
  }

  return (
    <button onClick={navigate} disabled={isNavigating}>
      {isNavigating ? 'Loading...' : 'Go to Dashboard'}
    </button>
  )
}
```

## Route Groups and Navigation

Navigate within route groups:

```javascript
// app/(shop)/layout.js
import Link from 'next/link'

export default function ShopLayout({ children }) {
  return (
    <div>
      <nav>
        <Link href="/products">Products</Link>
        <Link href="/cart">Cart</Link>
        <Link href="/checkout">Checkout</Link>
      </nav>
      {children}
    </div>
  )
}
```

## External Links

For external URLs, `<Link>` automatically opens in a new tab:

```javascript
<Link href="https://example.com">
  External Site
</Link>

// Or explicitly:
<Link href="https://example.com" target="_blank" rel="noopener noreferrer">
  External Site (New Tab)
</Link>
```

## Navigation Performance Patterns

### Optimistic Navigation

```javascript
'use client'

import { useRouter } from 'next/navigation'
import { useOptimistic } from 'react'

export default function TodoList({ todos }) {
  const router = useRouter()
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, newTodo]
  )

  async function addTodo(formData) {
    const newTodo = { id: Date.now(), text: formData.get('text') }
    addOptimisticTodo(newTodo)

    await saveTodo(newTodo)
    router.refresh()
  }

  return (
    <div>
      {optimisticTodos.map(todo => (
        <div key={todo.id}>{todo.text}</div>
      ))}
      <form action={addTodo}>
        <input name="text" />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}
```

### Parallel Routes Navigation

```javascript
'use client'

import { useRouter } from 'next/navigation'

export default function ModalNavigation() {
  const router = useRouter()

  function openModal() {
    router.push('/products/123/modal')
  }

  function closeModal() {
    router.back()
  }

  return (
    <div>
      <button onClick={openModal}>Open Product Modal</button>
      <button onClick={closeModal}>Close Modal</button>
    </div>
  )
}
```

## Best Practices

1. **Use `<Link>` for navigation** - Automatic prefetching and optimization
2. **Use `useRouter` for programmatic navigation** - Forms, redirects after actions
3. **Avoid full page reloads** - Use client-side navigation for better UX
4. **Leverage prefetching** - Keep default prefetching enabled for better performance
5. **Handle loading states** - Show feedback during navigation
6. **Use Server Actions** - For form submissions and mutations
7. **Implement optimistic updates** - Update UI before server confirms
8. **Use `redirect()` in Server Components** - For auth and conditional routing

## Common Pitfalls

1. **Using `<a>` instead of `<Link>`** - Loses client-side navigation benefits
2. **Importing wrong `useRouter`** - Use `next/navigation`, not `next/router`
3. **Not handling loading states** - Poor UX during navigation
4. **Over-prefetching** - Disable for authenticated routes or heavy pages
5. **Forgetting `scroll={false}`** - Unwanted scroll behavior on same-page navigation
6. **Using `router.push` in Server Components** - Use `redirect()` instead
7. **Not updating search params correctly** - Losing existing params when updating
8. **Mixing client and server navigation** - Understand when to use each

## Navigation Checklist

- [ ] Use `<Link>` for standard navigation
- [ ] Use `useRouter` for programmatic navigation
- [ ] Handle loading states during navigation
- [ ] Implement active link styling
- [ ] Configure prefetching appropriately
- [ ] Use `redirect()` for server-side navigation
- [ ] Manage scroll behavior
- [ ] Update URL params correctly
- [ ] Handle external links properly
- [ ] Test navigation in all routes
