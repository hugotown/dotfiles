# useSelectedLayoutSegment

The `useSelectedLayoutSegment` hook allows you to read the active route segment one level below the Layout it is called from.

## Import

```typescript
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
```

## Function Signature

```typescript
const segment = useSelectedLayoutSegment(parallelRoutesKey?: string)
```

## Parameters

### `parallelRoutesKey` (optional)
- **Type**: `string`
- **Description**: The parallel route key to read the active segment from

## Return Value

Returns a string of the active segment, or `null` if none exists.

## Usage Examples

### Basic Usage

```typescript
// app/layout.tsx
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment()

  return (
    <div>
      <p>Active segment: {segment}</p>
      {children}
    </div>
  )
}

// URL: /dashboard → segment: "dashboard"
// URL: /blog → segment: "blog"
// URL: / → segment: null
```

### Navigation with Active States

```typescript
// app/layout.tsx
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import Link from 'next/link'

export default function Layout({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment()

  return (
    <div>
      <nav>
        <Link
          href="/dashboard"
          className={segment === 'dashboard' ? 'active' : ''}
        >
          Dashboard
        </Link>
        <Link
          href="/analytics"
          className={segment === 'analytics' ? 'active' : ''}
        >
          Analytics
        </Link>
        <Link
          href="/settings"
          className={segment === 'settings' ? 'active' : ''}
        >
          Settings
        </Link>
      </nav>
      {children}
    </div>
  )
}
```

### Nested Layouts

```typescript
// app/dashboard/layout.tsx
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const segment = useSelectedLayoutSegment()

  return (
    <div>
      <aside>
        <Link href="/dashboard/overview">
          Overview {segment === 'overview' && '✓'}
        </Link>
        <Link href="/dashboard/analytics">
          Analytics {segment === 'analytics' && '✓'}
        </Link>
      </aside>
      {children}
    </div>
  )
}
```

### Tabs Component

```typescript
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import Link from 'next/link'

const tabs = [
  { name: 'Overview', href: '/dashboard/overview', segment: 'overview' },
  { name: 'Team', href: '/dashboard/team', segment: 'team' },
  { name: 'Settings', href: '/dashboard/settings', segment: 'settings' }
]

export default function Tabs() {
  const activeSegment = useSelectedLayoutSegment()

  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.segment}
          href={tab.href}
          className={activeSegment === tab.segment ? 'active' : ''}
        >
          {tab.name}
        </Link>
      ))}
    </div>
  )
}
```

### Conditional Sidebar

```typescript
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment()

  // Show sidebar for specific segments
  const showSidebar = ['dashboard', 'analytics', 'reports'].includes(
    segment || ''
  )

  return (
    <div className="flex">
      {showSidebar && <Sidebar />}
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

### Dynamic Group Routes

```typescript
// app/(admin)/layout.tsx
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  const segment = useSelectedLayoutSegment()

  return (
    <div>
      <h2>Admin: {segment}</h2>
      {children}
    </div>
  )
}

// URL: /(admin)/users → segment: "users"
// URL: /(admin)/settings → segment: "settings"
```

### With Parallel Routes

```typescript
// app/layout.tsx
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function Layout({
  children,
  modal
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  const segment = useSelectedLayoutSegment()
  const modalSegment = useSelectedLayoutSegment('modal')

  return (
    <div>
      <p>Main: {segment}</p>
      <p>Modal: {modalSegment}</p>
      {children}
      {modal}
    </div>
  )
}
```

### Breadcrumb Component

```typescript
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import Link from 'next/link'

export default function Breadcrumbs() {
  const segment = useSelectedLayoutSegment()

  return (
    <nav>
      <Link href="/">Home</Link>
      {segment && (
        <>
          {' / '}
          <span>{segment}</span>
        </>
      )}
    </nav>
  )
}
```

### Section-Based Styling

```typescript
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment()

  return (
    <div className={`layout layout-${segment || 'home'}`}>
      {children}
    </div>
  )
}
```

### Multi-Level Navigation

```typescript
// app/docs/layout.tsx
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

const sections = {
  'getting-started': 'Getting Started',
  'api-reference': 'API Reference',
  'guides': 'Guides'
}

export default function DocsLayout({
  children
}: {
  children: React.ReactNode
}) {
  const segment = useSelectedLayoutSegment()
  const sectionTitle = segment ? sections[segment as keyof typeof sections] : 'Documentation'

  return (
    <div>
      <h1>{sectionTitle}</h1>
      <nav>
        {Object.entries(sections).map(([key, title]) => (
          <Link
            key={key}
            href={`/docs/${key}`}
            className={segment === key ? 'active' : ''}
          >
            {title}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
```

### Context Menu Based on Segment

```typescript
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function ContextMenu() {
  const segment = useSelectedLayoutSegment()

  const getActions = () => {
    switch (segment) {
      case 'posts':
        return ['New Post', 'Import', 'Export']
      case 'users':
        return ['Add User', 'Import CSV']
      case 'settings':
        return ['Reset', 'Export Config']
      default:
        return []
    }
  }

  const actions = getActions()

  return (
    <div>
      {actions.map((action) => (
        <button key={action}>{action}</button>
      ))}
    </div>
  )
}
```

## useSelectedLayoutSegments

For reading all active segments below a layout:

```typescript
'use client'

import { useSelectedLayoutSegments } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const segments = useSelectedLayoutSegments()

  return (
    <div>
      <p>Active path: {segments.join('/')}</p>
      {children}
    </div>
  )
}

// URL: /dashboard/analytics/reports
// segments: ['dashboard', 'analytics', 'reports']
```

## Best Practices

1. **Use for Active Link Highlighting**
   ```typescript
   const segment = useSelectedLayoutSegment()
   const isActive = segment === 'dashboard'
   ```

2. **Check for Null**
   ```typescript
   const segment = useSelectedLayoutSegment()

   if (!segment) {
     // Root route
     return <HomeNav />
   }
   ```

3. **Use in Layouts, Not Pages**
   ```typescript
   // ✅ In layout.tsx
   export default function Layout() {
     const segment = useSelectedLayoutSegment()
     // ...
   }

   // ❌ Less useful in page.tsx
   ```

4. **Combine with Link Component**
   ```typescript
   <Link
     href="/dashboard"
     className={segment === 'dashboard' ? 'active' : ''}
   >
     Dashboard
   </Link>
   ```

## Common Patterns

### Active Navigation

```typescript
function Nav() {
  const segment = useSelectedLayoutSegment()

  return (
    <nav>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={segment === link.segment ? 'active' : ''}
        >
          {link.name}
        </Link>
      ))}
    </nav>
  )
}
```

### Conditional Components

```typescript
function Layout({ children }) {
  const segment = useSelectedLayoutSegment()

  return (
    <div>
      {segment === 'dashboard' && <DashboardHeader />}
      {children}
    </div>
  )
}
```

## Important Notes

- Only works in Client Components
- Returns the segment one level below the Layout
- Returns `null` at root or if no child segment exists
- Useful for active link states in navigation
- Works with route groups and parallel routes
- More specific than `usePathname()` for layouts
- Use `useSelectedLayoutSegments()` for all child segments

## Related

- [usePathname](./usePathname.md) - Get full pathname
- [useParams](./useParams.md) - Access route parameters
- [useRouter](./useRouter.md) - Programmatic navigation
