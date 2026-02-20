# Layouts and Pages

Learn how to create layouts and pages in Next.js App Router.

## Pages

A page is UI that is unique to a route. Define pages by exporting a component from a `page.js` file.

### Basic Page

```javascript
// app/page.js
export default function HomePage() {
  return <h1>Home Page</h1>
}
```

### Nested Page

```javascript
// app/dashboard/page.js
export default function DashboardPage() {
  return <h1>Dashboard</h1>
}
```

### Dynamic Page

```javascript
// app/blog/[slug]/page.js
export default function BlogPost({ params }) {
  return <h1>Post: {params.slug}</h1>
}
```

### Page with TypeScript

```typescript
// app/blog/[slug]/page.tsx
interface PageProps {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function BlogPost({ params, searchParams }: PageProps) {
  return (
    <div>
      <h1>Post: {params.slug}</h1>
      {searchParams.tag && <p>Tag: {searchParams.tag}</p>}
    </div>
  )
}
```

## Layouts

A layout is UI that is shared between multiple routes. Layouts preserve state, remain interactive, and don't re-render.

### Root Layout (Required)

Every app must have a root layout:

```javascript
// app/layout.js
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header>My App</header>
        <main>{children}</main>
        <footer>© 2024</footer>
      </body>
    </html>
  )
}
```

**Important:** Only the root layout can contain `<html>` and `<body>` tags.

### Nested Layout

```javascript
// app/dashboard/layout.js
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard">
      <aside>
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/dashboard/analytics">Analytics</a>
          <a href="/dashboard/settings">Settings</a>
        </nav>
      </aside>
      <div className="content">{children}</div>
    </div>
  )
}
```

### Layout Composition

Layouts nest automatically:

```
app/
├── layout.js                    # Root layout
└── dashboard/
    ├── layout.js                # Dashboard layout
    ├── page.js                  # Uses both layouts
    └── settings/
        └── page.js              # Uses all three layouts
```

Rendering hierarchy:

```
<RootLayout>
  <DashboardLayout>
    <SettingsPage />
  </DashboardLayout>
</RootLayout>
```

### Layout with Metadata

```javascript
// app/dashboard/layout.js
export const metadata = {
  title: 'Dashboard',
  description: 'User dashboard',
}

export default function DashboardLayout({ children }) {
  return <div className="dashboard">{children}</div>
}
```

## Templates

Templates are similar to layouts but create a new instance on navigation (don't persist state).

```javascript
// app/template.js
export default function Template({ children }) {
  return <div className="template">{children}</div>
}
```

### When to Use Templates vs Layouts

**Use Layouts when:**
- You want to preserve state across navigation
- You want to avoid re-rendering
- You're creating persistent UI (headers, sidebars)

**Use Templates when:**
- You need to reset state on navigation
- You want re-render on route change
- You need enter/exit animations

### Layout vs Template Example

```javascript
// app/layout.js (state persists)
export default function Layout({ children }) {
  const [count, setCount] = useState(0)

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count} (persists across routes)
      </button>
      {children}
    </div>
  )
}

// app/template.js (state resets)
export default function Template({ children }) {
  const [count, setCount] = useState(0)

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count} (resets on navigation)
      </button>
      {children}
    </div>
  )
}
```

## Layout Props

Layouts receive `children` and can receive `params`:

```typescript
// app/[locale]/layout.tsx
interface LayoutProps {
  children: React.ReactNode
  params: { locale: string }
}

export default function LocaleLayout({ children, params }: LayoutProps) {
  return (
    <div lang={params.locale}>
      {children}
    </div>
  )
}
```

## Page Props

Pages receive `params` and `searchParams`:

```typescript
// app/products/[id]/page.tsx
interface PageProps {
  params: { id: string }
  searchParams: { sort?: string; filter?: string }
}

export default function ProductPage({ params, searchParams }: PageProps) {
  return (
    <div>
      <h1>Product: {params.id}</h1>
      <p>Sort: {searchParams.sort || 'default'}</p>
      <p>Filter: {searchParams.filter || 'none'}</p>
    </div>
  )
}
```

## Multiple Root Layouts

Use route groups to create multiple root layouts:

```
app/
├── (marketing)/
│   ├── layout.js          # Marketing root layout
│   ├── page.js            # Home page
│   └── about/
│       └── page.js        # About page
├── (app)/
│   ├── layout.js          # App root layout
│   └── dashboard/
│       └── page.js        # Dashboard page
```

```javascript
// app/(marketing)/layout.js
export default function MarketingLayout({ children }) {
  return (
    <html lang="en">
      <body className="marketing">
        <nav>Marketing Nav</nav>
        {children}
      </body>
    </html>
  )
}

// app/(app)/layout.js
export default function AppLayout({ children }) {
  return (
    <html lang="en">
      <body className="app">
        <nav>App Nav</nav>
        {children}
      </body>
    </html>
  )
}
```

## Layout Best Practices

### 1. Fetch Data in Layouts

```javascript
// app/dashboard/layout.js
async function getUser() {
  const res = await fetch('https://api.example.com/user')
  return res.json()
}

export default async function DashboardLayout({ children }) {
  const user = await getUser()

  return (
    <div>
      <header>Welcome, {user.name}</header>
      {children}
    </div>
  )
}
```

### 2. Shared Components

```javascript
// app/layout.js
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
```

### 3. Client Components in Layouts

```javascript
// app/layout.js
import ClientSidebar from '@/components/ClientSidebar'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientSidebar />
        {children}
      </body>
    </html>
  )
}

// components/ClientSidebar.js
'use client'

import { useState } from 'react'

export default function ClientSidebar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <aside>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && <nav>Navigation</nav>}
    </aside>
  )
}
```

## Metadata

### Static Metadata

```javascript
// app/about/page.js
export const metadata = {
  title: 'About Us',
  description: 'Learn more about our company',
}

export default function AboutPage() {
  return <h1>About Us</h1>
}
```

### Dynamic Metadata

```javascript
// app/blog/[slug]/page.js
export async function generateMetadata({ params }) {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.image],
    },
  }
}

export default function BlogPost({ params }) {
  return <article>...</article>
}
```

### Metadata Inheritance

Metadata merges from root to leaf:

```javascript
// app/layout.js
export const metadata = {
  title: {
    template: '%s | My App',
    default: 'My App',
  },
}

// app/blog/page.js
export const metadata = {
  title: 'Blog', // Becomes "Blog | My App"
}
```

## Common Patterns

### Dashboard Layout with Sidebar

```javascript
// app/dashboard/layout.js
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
```

### Conditional Layout

```javascript
// app/layout.js
import { auth } from '@/lib/auth'
import AuthenticatedNav from '@/components/AuthenticatedNav'
import PublicNav from '@/components/PublicNav'

export default async function RootLayout({ children }) {
  const session = await auth()

  return (
    <html lang="en">
      <body>
        {session ? <AuthenticatedNav /> : <PublicNav />}
        {children}
      </body>
    </html>
  )
}
```

### Loading State in Layout

```javascript
// app/dashboard/layout.js
import { Suspense } from 'react'
import UserProfile from '@/components/UserProfile'

export default function DashboardLayout({ children }) {
  return (
    <div>
      <header>
        <Suspense fallback={<div>Loading user...</div>}>
          <UserProfile />
        </Suspense>
      </header>
      {children}
    </div>
  )
}
```

## Common Pitfalls

1. **Putting `<html>` in nested layout** - Only root layout should have `<html>` and `<body>`
2. **Fetching same data in layout and page** - Data is not deduped between layout and page
3. **Not using layouts for shared UI** - Duplicating navigation/headers across pages
4. **Forgetting layouts persist** - State in layouts survives navigation
5. **Not leveraging route groups** - Missing multiple root layout opportunities
6. **Client components in server layouts** - Marking entire layout as 'use client'

## Checklist

- [ ] Root layout includes `<html>` and `<body>`
- [ ] Layouts handle shared UI (navigation, footers)
- [ ] Metadata is configured for SEO
- [ ] Nested layouts are used appropriately
- [ ] Server Components are preferred
- [ ] Client Components are minimized
- [ ] Loading states are handled
- [ ] Error boundaries are in place
