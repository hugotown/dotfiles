# layout.js / layout.tsx

A layout is UI that is shared between multiple routes. Layouts preserve state, remain interactive, and do not re-render on navigation.

## File Signature

```tsx
// app/layout.tsx
export default function Layout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

## Props

Layouts accept two props: `children` and `params`.

### children (Required)

The content to be rendered inside the layout. This will be populated with a page or another nested layout during rendering.

```tsx
export default function Layout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <nav>Navigation</nav>
      <main>{children}</main>
    </div>
  )
}
```

### params (Optional)

The dynamic route parameters from the root segment down to that layout.

```tsx
// app/shop/[category]/layout.tsx
export default function CategoryLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { category: string }
}) {
  return (
    <div>
      <h1>Category: {params.category}</h1>
      {children}
    </div>
  )
}
```

**Important:** Layouts do NOT receive `searchParams`. Use a page or Client Component for accessing search parameters.

## Root Layout (Required)

The root layout is defined at the top level of the `app` directory and applies to all routes.

```tsx
// app/layout.tsx
export const metadata = {
  title: 'My App',
  description: 'My app description',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

**Root Layout Requirements:**
- MUST define `<html>` and `<body>` tags
- MUST be a Server Component (cannot use `'use client'`)
- Can set global metadata
- Replaces `_app.js` and `_document.js` from Pages Router

## Nested Layouts

Layouts can be nested to create hierarchical UI structures.

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard">
      <aside>
        <nav>Dashboard Nav</nav>
      </aside>
      <main>{children}</main>
    </div>
  )
}
```

**Nesting Behavior:**
- Layouts nest by default
- Parent layouts wrap child layouts
- Each level can have its own layout

```
app/layout.tsx              (Root)
  └── app/dashboard/layout.tsx    (Dashboard)
      └── app/dashboard/settings/layout.tsx  (Settings)
```

## Examples

### Basic Layout with Navigation

```tsx
// app/layout.tsx
import Link from 'next/link'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            <Link href="/">Home</Link>
            <Link href="/about">About</Link>
            <Link href="/blog">Blog</Link>
          </nav>
        </header>
        {children}
        <footer>© 2024 My Company</footer>
      </body>
    </html>
  )
}
```

### Dashboard Layout with Sidebar

```tsx
// app/dashboard/layout.tsx
import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
```

### Layout with Dynamic Params

```tsx
// app/[locale]/layout.tsx
import { notFound } from 'next/navigation'

const locales = ['en', 'es', 'fr']

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  // Validate locale
  if (!locales.includes(params.locale)) {
    notFound()
  }

  return (
    <html lang={params.locale}>
      <body>{children}</body>
    </html>
  )
}
```

### Layout with Metadata

```tsx
// app/blog/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Read our latest blog posts',
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="blog-container">
      {children}
    </div>
  )
}
```

### Layout Fetching Data

```tsx
// app/dashboard/layout.tsx
async function getUser() {
  const res = await fetch('https://api.example.com/user')
  return res.json()
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  return (
    <div>
      <header>
        <p>Welcome, {user.name}</p>
      </header>
      {children}
    </div>
  )
}
```

### Layout with Client Component Header

```tsx
// app/layout.tsx
import { Header } from '@/components/header'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  )
}
```

```tsx
// components/header.tsx
'use client'

import { usePathname } from 'next/navigation'

export function Header() {
  const pathname = usePathname()

  return (
    <header>
      Current path: {pathname}
    </header>
  )
}
```

### Multiple Root Layouts (Route Groups)

```tsx
// app/(marketing)/layout.tsx
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="marketing">
        {children}
      </body>
    </html>
  )
}
```

```tsx
// app/(shop)/layout.tsx
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="shop">
        {children}
      </body>
    </html>
  )
}
```

## TypeScript

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
}

type LayoutProps = {
  children: React.ReactNode
  params: { id: string }
}

export default function Layout({ children, params }: LayoutProps) {
  return <div>{children}</div>
}
```

## Version History

- **v13.0.0**: App Router introduced with layout.js convention
- **v13.4.0**: App Router stable

## Good to Know

- Layouts are Server Components by default (can be set to Client Components)
- Layouts do not have access to `searchParams`
- Layouts cannot use `pathname` (use Client Component instead)
- Layouts preserve state and remain interactive across navigations
- Layouts can fetch data directly
- Layouts cannot pass data down to children (use React Context or prop drilling through pages)
- Root layout must include `<html>` and `<body>` tags
- You can use Route Groups to create multiple root layouts
- `.js`, `.jsx`, or `.tsx` file extensions can be used
