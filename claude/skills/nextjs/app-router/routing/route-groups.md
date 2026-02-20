# Route Groups in Next.js App Router

Route groups allow you to organize your routes logically without affecting the URL structure. This is useful for grouping routes by feature, team ownership, or shared layouts without creating additional path segments.

## Overview

Route groups are created by wrapping a folder name in parentheses: `(folderName)`. The folder name is excluded from the URL path, allowing you to organize routes without changing the URL structure.

## Basic Syntax

### Creating a Route Group

```
app/
  (marketing)/
    about/
      page.tsx       → /about (not /marketing/about)
    blog/
      page.tsx       → /blog (not /marketing/blog)
  (shop)/
    products/
      page.tsx       → /products (not /shop/products)
    cart/
      page.tsx       → /cart (not /shop/cart)
```

The parentheses tell Next.js that the folder is for organization only and should not be included in the route's URL path.

## Use Cases

### 1. Organizing Routes by Section

Group routes by application section without affecting URLs:

```
app/
  (marketing)/
    layout.tsx       # Marketing layout with hero, CTA
    page.tsx         # Home page → /
    about/
      page.tsx       # About page → /about
    pricing/
      page.tsx       # Pricing page → /pricing
  (dashboard)/
    layout.tsx       # Dashboard layout with sidebar
    page.tsx         # Dashboard home → /dashboard
    analytics/
      page.tsx       # Analytics → /dashboard/analytics
    settings/
      page.tsx       # Settings → /dashboard/settings
```

**Marketing Layout:**
```typescript
// app/(marketing)/layout.tsx
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <header>
        <nav>{/* Public navigation */}</nav>
      </header>
      <main>{children}</main>
      <footer>{/* Marketing footer */}</footer>
    </div>
  )
}
```

**Dashboard Layout:**
```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <aside>{/* Dashboard sidebar */}</aside>
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

### 2. Multiple Root Layouts

Create different root layouts for different sections of your app:

```
app/
  (marketing)/
    layout.tsx       # Root layout for marketing
    page.tsx
    about/
      page.tsx
  (app)/
    layout.tsx       # Different root layout for app
    dashboard/
      page.tsx
    settings/
      page.tsx
  layout.tsx         # Global root layout (optional)
```

**Marketing Root Layout:**
```typescript
// app/(marketing)/layout.tsx
export default function MarketingRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="marketing-theme">
        <header>{/* Marketing header */}</header>
        {children}
        <footer>{/* Marketing footer */}</footer>
      </body>
    </html>
  )
}
```

**App Root Layout:**
```typescript
// app/(app)/layout.tsx
export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="app-theme">
        <nav>{/* App navigation */}</nav>
        <div className="app-container">{children}</div>
      </body>
    </html>
  )
}
```

### 3. Organizing by Feature

Group related features together:

```
app/
  (auth)/
    login/
      page.tsx       → /login
    register/
      page.tsx       → /register
    forgot-password/
      page.tsx       → /forgot-password
    layout.tsx       # Shared auth layout
  (blog)/
    layout.tsx       # Blog layout
    [slug]/
      page.tsx       → /[slug]
    categories/
      [category]/
        page.tsx     → /categories/[category]
```

### 4. Team-Based Organization

Organize routes by team ownership:

```
app/
  (team-a)/
    feature-x/
      page.tsx
    feature-y/
      page.tsx
  (team-b)/
    feature-z/
      page.tsx
```

### 5. Conditional Layouts

Use route groups to apply different layouts based on conditions:

```
app/
  (authenticated)/
    layout.tsx       # Requires authentication
    dashboard/
      page.tsx
    profile/
      page.tsx
  (public)/
    layout.tsx       # Public access
    page.tsx
    about/
      page.tsx
```

## Advanced Patterns

### Nested Route Groups

You can nest route groups for more granular organization:

```
app/
  (marketing)/
    (landing)/
      page.tsx       → /
      features/
        page.tsx     → /features
    (content)/
      blog/
        page.tsx     → /blog
      docs/
        page.tsx     → /docs
```

### Route Groups with Dynamic Routes

Combine route groups with dynamic routing:

```
app/
  (shop)/
    products/
      [id]/
        page.tsx     → /products/[id]
    categories/
      [category]/
        page.tsx     → /categories/[category]
```

### Multiple Layouts in Hierarchy

Stack multiple layouts using route groups:

```
app/
  (platform)/
    layout.tsx       # Platform-wide layout
    (admin)/
      layout.tsx     # Admin-specific layout
      users/
        page.tsx     → /users
      settings/
        page.tsx     → /settings
    (user)/
      layout.tsx     # User-specific layout
      dashboard/
        page.tsx     → /dashboard
```

**Platform Layout:**
```typescript
// app/(platform)/layout.tsx
export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="platform-container">
      <TopBar />
      {children}
    </div>
  )
}
```

**Admin Layout:**
```typescript
// app/(platform)/(admin)/layout.tsx
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main>{children}</main>
    </div>
  )
}
```

## Opting Into Route Groups

### Without Root Layout

You can create route groups that each have their own root `<html>` and `<body>` tags:

```
app/
  (marketing)/
    layout.tsx       # Has <html> and <body>
    page.tsx
  (app)/
    layout.tsx       # Has <html> and <body>
    page.tsx
  # No root layout.tsx
```

This is useful when sections need completely different HTML structures.

### With Shared Root Layout

Or have a shared root layout with section-specific layouts:

```
app/
  layout.tsx         # Shared root with <html> and <body>
  (marketing)/
    layout.tsx       # Marketing-specific layout
    page.tsx
  (app)/
    layout.tsx       # App-specific layout
    page.tsx
```

## Best Practices

### 1. Use Descriptive Names

Name route groups based on their purpose:

```
✅ Good
app/
  (marketing)/
  (dashboard)/
  (admin)/
  (auth)/

❌ Avoid
app/
  (group1)/
  (section)/
  (misc)/
```

### 2. Don't Overuse Route Groups

Only use route groups when you need different layouts or want to organize logically:

```
✅ Good - Different layouts needed
app/
  (marketing)/
    layout.tsx       # Marketing layout
  (app)/
    layout.tsx       # App layout

❌ Unnecessary - Could use regular folders
app/
  (products)/
    phones/
      page.tsx       # No special layout or organization benefit
```

### 3. Combine with Other Routing Features

Route groups work well with other routing patterns:

```typescript
app/
  (shop)/
    layout.tsx
    products/
      [id]/
        page.tsx     # Dynamic route
        @reviews/    # Parallel route
          page.tsx
```

### 4. Use for Authentication Boundaries

Create clear boundaries for authenticated vs. public routes:

```typescript
// app/(authenticated)/layout.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return <>{children}</>
}
```

### 5. Keep Route Groups Flat

Avoid deep nesting of route groups:

```
✅ Good
app/
  (marketing)/
  (dashboard)/

❌ Avoid
app/
  (section)/
    (subsection)/
      (subsubsection)/
```

## Common Patterns

### Marketing Site + App

```
app/
  (marketing)/
    layout.tsx
    page.tsx         → /
    about/
      page.tsx       → /about
    pricing/
      page.tsx       → /pricing
    contact/
      page.tsx       → /contact
  (app)/
    layout.tsx
    dashboard/
      page.tsx       → /dashboard
    projects/
      page.tsx       → /projects
      [id]/
        page.tsx     → /projects/[id]
  (auth)/
    layout.tsx
    login/
      page.tsx       → /login
    signup/
      page.tsx       → /signup
```

### Multi-Tenant Application

```
app/
  (public)/
    layout.tsx
    page.tsx
    about/
      page.tsx
  (tenant)/
    layout.tsx       # Tenant-specific layout
    [tenantId]/
      dashboard/
        page.tsx     → /[tenantId]/dashboard
      settings/
        page.tsx     → /[tenantId]/settings
```

### Admin + User Sections

```
app/
  layout.tsx         # Root layout
  (admin)/
    layout.tsx       # Admin layout with admin nav
    users/
      page.tsx       → /users
    reports/
      page.tsx       → /reports
  (user)/
    layout.tsx       # User layout with user nav
    dashboard/
      page.tsx       → /dashboard
    profile/
      page.tsx       → /profile
```

## Route Group Metadata

You can define metadata in route group layouts:

```typescript
// app/(marketing)/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | My Marketing Site',
    default: 'My Marketing Site',
  },
  description: 'Marketing site description',
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
```

## Private Folders vs Route Groups

**Private Folders** (`_folder`): Excluded from routing entirely
```
app/
  _lib/           # Not a route, just organization
    utils.ts
  page.tsx
```

**Route Groups** (`(folder)`): Affects layout hierarchy but not URL
```
app/
  (marketing)/    # Affects layout, not URL
    page.tsx
```

Use private folders for utilities/components, use route groups for layout organization.

## Troubleshooting

### Multiple Root Layouts Not Working

Ensure each route group has its own `layout.tsx` with `<html>` and `<body>`:

```typescript
// app/(marketing)/layout.tsx
export default function MarketingLayout({
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

### Route Conflicts

Avoid having the same route path in different route groups:

```
❌ Conflicts
app/
  (group1)/
    about/
      page.tsx     → /about
  (group2)/
    about/
      page.tsx     → /about (CONFLICT!)
```

### Shared Components

Use a private folder or regular folder outside route groups for shared components:

```
app/
  _components/     # Shared across groups
    Button.tsx
  (marketing)/
    page.tsx
  (app)/
    page.tsx
```

## Summary

Route groups are a powerful organization tool in Next.js App Router:

- **Syntax**: `(folderName)` excludes folder from URL path
- **Purpose**: Organize routes without affecting URLs
- **Multiple Layouts**: Create different layouts for different sections
- **Authentication**: Separate public and protected routes
- **Team Organization**: Organize by team or feature ownership
- **Best Practice**: Use descriptively, don't overuse, combine with other patterns

Use route groups to create clear boundaries in your application and maintain clean URL structures while organizing code logically.
