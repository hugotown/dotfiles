---
name: implementing-nextjs-routing
description: Covers Next.js App Router routing patterns including dynamic routes, route groups, parallel routes, intercepting routes, and route handlers. Use when implementing navigation, creating API endpoints, or organizing routes.
---

# Next.js App Router Routing

This skill provides comprehensive guidance on implementing routing patterns in Next.js App Router, the modern file-system based routing solution that offers powerful features for building complex applications.

## Overview

Next.js App Router uses a file-system based routing where folders define routes and special files create the UI. This skill covers all routing patterns and conventions you need to build sophisticated navigation structures.

## Core Concepts

### File-System Based Routing
- Folders define route segments
- Files define UI shown for a route segment
- Nested folders create nested routes
- Special file conventions (page.js, layout.js, etc.)

### Route Segments
Each folder in the app directory represents a route segment that maps to a URL segment:
```
app/
  dashboard/
    settings/
      page.js → /dashboard/settings
```

## Skill Components

This skill is organized into the following detailed guides:

### 1. [Dynamic Routes](./dynamic-routes.md)
Learn to create routes with dynamic parameters:
- `[slug]` - Single dynamic segments
- `[...slug]` - Catch-all segments
- `[[...slug]]` - Optional catch-all segments
- `generateStaticParams` for static generation

### 2. [Route Groups](./route-groups.md)
Organize routes without affecting URL structure:
- `(folder)` - Grouping convention
- Multiple root layouts
- Route organization strategies

### 3. [Parallel Routes](./parallel-routes.md)
Render multiple pages simultaneously:
- `@folder` - Named slots convention
- Conditional rendering
- Independent navigation

### 4. [Intercepting Routes](./intercepting-routes.md)
Intercept routes for modal patterns:
- `(.)` - Same level interception
- `(..)` - Parent level interception
- `(...)` - Root interception
- Modal implementations

### 5. [Route Handlers](./route-handlers.md)
Create API endpoints with route handlers:
- `route.ts` - API route files
- HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Request/Response handling
- Streaming responses

### 6. [Middleware](./middleware.md)
Run code before requests complete:
- `middleware.ts` - Middleware file
- Path matching
- Redirects and rewrites
- Authentication patterns

### 7. [Loading and Streaming](./loading-and-streaming.md)
Implement loading states and streaming:
- `loading.js` - Instant loading states
- React Suspense integration
- Streaming Server-Side Rendering
- Progressive enhancement

## Quick Reference

### Special Files
```
page.js       - Route UI, makes path publicly accessible
layout.js     - Shared UI for segment and children
loading.js    - Loading UI for segment and children
error.js      - Error UI for segment and children
not-found.js  - Not found UI
route.js      - API endpoint
template.js   - Re-rendered layout
default.js    - Fallback UI for parallel routes
```

### Route Conventions
```
[folder]      - Dynamic route segment
[...folder]   - Catch-all segment
[[...folder]] - Optional catch-all
(folder)      - Route group (excluded from URL)
@folder       - Named slot for parallel routes
_folder       - Private folder (excluded from routing)
```

## Navigation

### Link Component
```typescript
import Link from 'next/link'

<Link href="/dashboard">Dashboard</Link>
<Link href={{ pathname: '/blog/[slug]', query: { slug: 'hello' } }}>
  Blog Post
</Link>
```

### useRouter Hook
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

### redirect Function
```typescript
import { redirect } from 'next/navigation'

async function fetchUser() {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }
  return user
}
```

## Best Practices

1. **Use Server Components by Default**: Only use 'use client' when needed for interactivity
2. **Leverage Layouts**: Share UI and state across routes
3. **Organize with Route Groups**: Use (folder) to organize without affecting URLs
4. **Implement Loading States**: Use loading.js for better UX
5. **Handle Errors Gracefully**: Use error.js boundaries
6. **Optimize with Static Generation**: Use generateStaticParams for dynamic routes
7. **Use Middleware Sparingly**: Middleware runs on every request
8. **Implement Progressive Enhancement**: Use streaming for large pages

## Common Patterns

### Protected Routes
```typescript
// app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

export default async function DashboardLayout({ children }) {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return <>{children}</>
}
```

### Nested Layouts
```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <div>
      <nav>{/* Dashboard nav */}</nav>
      <main>{children}</main>
    </div>
  )
}

// app/dashboard/settings/layout.tsx
export default function SettingsLayout({ children }) {
  return (
    <div>
      <aside>{/* Settings sidebar */}</aside>
      <div>{children}</div>
    </div>
  )
}
```

### Breadcrumbs
```typescript
// app/components/Breadcrumbs.tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Breadcrumbs() {
  const pathname = usePathname()
  const paths = pathname.split('/').filter(Boolean)

  return (
    <nav>
      <Link href="/">Home</Link>
      {paths.map((path, index) => {
        const href = `/${paths.slice(0, index + 1).join('/')}`
        return (
          <span key={href}>
            {' / '}
            <Link href={href}>{path}</Link>
          </span>
        )
      })}
    </nav>
  )
}
```

## When to Use This Skill

Use this skill when you need to:
- Set up routing structure for a Next.js application
- Implement dynamic routes with parameters
- Create API endpoints with route handlers
- Build complex navigation patterns (modals, tabs, etc.)
- Organize routes with groups
- Implement middleware for auth or redirects
- Add loading states and streaming
- Handle errors at the route level
- Create multi-layout applications

## Related Skills

- **Next.js Data Fetching**: Learn how to fetch data in routes
- **Next.js Rendering**: Understand Server/Client Components
- **Next.js Caching**: Optimize route performance
- **Next.js API Reference**: Detailed API documentation

## Additional Resources

- [Next.js Routing Documentation](https://nextjs.org/docs/app/building-your-application/routing)
- [Next.js App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Next.js Examples](https://github.com/vercel/next.js/tree/canary/examples)
