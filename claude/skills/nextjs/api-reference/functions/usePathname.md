# usePathname

The `usePathname` hook allows you to read the current URL's pathname in Client Components.

## Import

```typescript
'use client'

import { usePathname } from 'next/navigation'
```

## Function Signature

```typescript
const pathname = usePathname()
```

## Return Value

Returns a string of the current pathname. For example:
- `/` returns `"/"`
- `/dashboard` returns `"/dashboard"`
- `/blog/post-1` returns `"/blog/post-1"`

## Usage Examples

### Basic Usage

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav>
      <a href="/" className={pathname === '/' ? 'active' : ''}>
        Home
      </a>
      <a href="/about" className={pathname === '/about' ? 'active' : ''}>
        About
      </a>
      <a href="/contact" className={pathname === '/contact' ? 'active' : ''}>
        Contact
      </a>
    </nav>
  )
}
```

### Active Link Highlighting

```typescript
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function NavLink({
  href,
  children
}: {
  href: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={isActive ? 'font-bold text-blue-600' : 'text-gray-600'}
    >
      {children}
    </Link>
  )
}
```

### Active Link with Partial Match

```typescript
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function SidebarLink({
  href,
  children
}: {
  href: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isActive = pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`block p-2 ${isActive ? 'bg-blue-100' : ''}`}
    >
      {children}
    </Link>
  )
}
```

### Breadcrumbs

```typescript
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <nav>
      <Link href="/">Home</Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`
        const label = segment.charAt(0).toUpperCase() + segment.slice(1)

        return (
          <span key={href}>
            {' / '}
            <Link href={href}>{label}</Link>
          </span>
        )
      })}
    </nav>
  )
}
```

### Conditional Rendering Based on Route

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = pathname.startsWith('/dashboard')

  return (
    <div className="flex">
      {showSidebar && <Sidebar />}
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

### Track Page Views

```typescript
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    // Track page view
    trackPageView(pathname)
  }, [pathname])

  return null
}
```

### Section-Based Styling

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const getSection = () => {
    if (pathname.startsWith('/blog')) return 'blog'
    if (pathname.startsWith('/docs')) return 'docs'
    if (pathname.startsWith('/shop')) return 'shop'
    return 'default'
  }

  return (
    <div data-section={getSection()}>
      {children}
    </div>
  )
}
```

### Multi-Level Navigation

```typescript
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    children: [
      { name: 'Overview', href: '/dashboard/overview' },
      { name: 'Analytics', href: '/dashboard/analytics' }
    ]
  },
  {
    name: 'Settings',
    href: '/settings',
    children: [
      { name: 'Profile', href: '/settings/profile' },
      { name: 'Account', href: '/settings/account' }
    ]
  }
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav>
      {navigation.map((item) => {
        const isActive = pathname.startsWith(item.href)

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={isActive ? 'font-bold' : ''}
            >
              {item.name}
            </Link>

            {isActive && item.children && (
              <ul>
                {item.children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      className={pathname === child.href ? 'active' : ''}
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}
```

### Route-Specific Header

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function Header() {
  const pathname = usePathname()

  const getTitle = () => {
    switch (pathname) {
      case '/':
        return 'Home'
      case '/about':
        return 'About Us'
      case '/contact':
        return 'Contact'
      default:
        return 'Page'
    }
  }

  return <h1>{getTitle()}</h1>
}
```

### Show/Hide Elements by Route

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()

  // Hide footer on checkout pages
  if (pathname.startsWith('/checkout')) {
    return null
  }

  return <footer>Footer Content</footer>
}
```

### Dynamic Class Based on Route

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function Body({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const getBodyClass = () => {
    if (pathname === '/') return 'home-page'
    if (pathname.startsWith('/blog')) return 'blog-page'
    if (pathname.startsWith('/shop')) return 'shop-page'
    return 'default-page'
  }

  return (
    <body className={getBodyClass()}>
      {children}
    </body>
  )
}
```

### Check Route Depth

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function BackButton() {
  const pathname = usePathname()
  const depth = pathname.split('/').filter(Boolean).length

  // Only show back button on nested routes
  if (depth <= 1) {
    return null
  }

  return <button onClick={() => window.history.back()}>← Back</button>
}
```

### Locale Detection

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function LocaleIndicator() {
  const pathname = usePathname()

  // Extract locale from pathname like /en/page or /es/page
  const locale = pathname.split('/')[1]

  return <div>Current Locale: {locale}</div>
}
```

### Sidebar Active State

```typescript
'use client'

import { usePathname } from 'next/navigation'

const sidebarItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/posts', label: 'Posts' },
  { href: '/dashboard/users', label: 'Users' },
  { href: '/dashboard/settings', label: 'Settings' }
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside>
      {sidebarItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={pathname === item.href ? 'active' : ''}
        >
          {item.label}
        </a>
      ))}
    </aside>
  )
}
```

## Best Practices

1. **Use Only in Client Components**
   ```typescript
   // ✅ Client Component
   'use client'
   import { usePathname } from 'next/navigation'

   // ❌ Server Component (use params instead)
   import { usePathname } from 'next/navigation' // Error!
   ```

2. **Compare with Exact or Partial Matches**
   ```typescript
   // Exact match
   const isActive = pathname === '/dashboard'

   // Partial match
   const isActive = pathname.startsWith('/dashboard')
   ```

3. **Memoize Expensive Calculations**
   ```typescript
   import { useMemo } from 'react'

   const breadcrumbs = useMemo(() => {
     return pathname.split('/').filter(Boolean)
   }, [pathname])
   ```

4. **Handle Root Path Correctly**
   ```typescript
   // Root path is "/"
   const isHome = pathname === '/'

   // Not "/home" or empty string
   ```

5. **Use for Analytics Tracking**
   ```typescript
   useEffect(() => {
     analytics.track('pageview', { path: pathname })
   }, [pathname])
   ```

## Common Patterns

### Active Link Component

```typescript
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function NavLink({
  href,
  exact = false,
  children
}: {
  href: string
  exact?: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isActive = exact
    ? pathname === href
    : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={isActive ? 'active' : ''}
    >
      {children}
    </Link>
  )
}
```

### Route-Based Layout

```typescript
'use client'

import { usePathname } from 'next/navigation'

export default function ConditionalLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth')

  if (isAuthPage) {
    return <SimpleLayout>{children}</SimpleLayout>
  }

  return <FullLayout>{children}</FullLayout>
}
```

### Analytics Component

```typescript
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    window.gtag?.('config', 'GA_TRACKING_ID', {
      page_path: pathname
    })
  }, [pathname])

  return null
}
```

## Important Notes

- Returns the pathname without query parameters or hash
- Returns `null` during server-side rendering
- Only works in Client Components
- Import from `'next/navigation'`, not `'next/router'`
- Use `useSearchParams()` to access query parameters
- Use `useParams()` to access dynamic route parameters

## Related

- [useSearchParams](./useSearchParams.md) - Access query parameters
- [useParams](./useParams.md) - Access route parameters
- [useRouter](./useRouter.md) - Programmatic navigation
- [useSelectedLayoutSegment](./useSelectedLayoutSegment.md) - Get active segment
