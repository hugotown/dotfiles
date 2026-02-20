# Route Groups

Route Groups allow you to organize routes without affecting the URL structure. Folders wrapped in parentheses `(folder)` are omitted from the URL path.

## Syntax

```
app/
└── (marketing)/
    ├── about/
    │   └── page.tsx        # /about
    └── blog/
        └── page.tsx        # /blog
```

The `(marketing)` folder is a route group - it's used for organization but doesn't appear in the URL.

## Basic Example

```
app/
├── (marketing)/
│   ├── about/
│   │   └── page.tsx        # URL: /about
│   └── contact/
│       └── page.tsx        # URL: /contact
└── (shop)/
    ├── products/
    │   └── page.tsx        # URL: /products
    └── cart/
        └── page.tsx        # URL: /cart
```

The route groups `(marketing)` and `(shop)` organize routes but don't affect URLs.

## Use Cases

### 1. Organize Routes by Purpose

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
├── (dashboard)/
│   ├── analytics/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
└── (marketing)/
    ├── about/
    │   └── page.tsx
    └── pricing/
        └── page.tsx
```

### 2. Multiple Layouts

Create different layouts for different sections without affecting URLs:

```
app/
├── (marketing)/
│   ├── layout.tsx          # Marketing layout
│   ├── about/
│   │   └── page.tsx
│   └── blog/
│       └── page.tsx
└── (shop)/
    ├── layout.tsx          # Shop layout
    ├── products/
    │   └── page.tsx
    └── cart/
        └── page.tsx
```

**Marketing layout:**

```tsx
// app/(marketing)/layout.tsx
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <nav>Marketing Nav</nav>
      <main>{children}</main>
      <footer>Marketing Footer</footer>
    </div>
  )
}
```

**Shop layout:**

```tsx
// app/(shop)/layout.tsx
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <nav>Shop Nav</nav>
      <aside>Filters</aside>
      <main>{children}</main>
    </div>
  )
}
```

### 3. Multiple Root Layouts

Create entirely different root layouts for different sections:

```
app/
├── (marketing)/
│   ├── layout.tsx          # Root layout for marketing
│   └── page.tsx
└── (app)/
    ├── layout.tsx          # Root layout for app
    └── dashboard/
        └── page.tsx
```

**Marketing root layout:**

```tsx
// app/(marketing)/layout.tsx
export default function MarketingRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="marketing-theme">
        {children}
      </body>
    </html>
  )
}
```

**App root layout:**

```tsx
// app/(app)/layout.tsx
export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="app-theme">
        {children}
      </body>
    </html>
  )
}
```

**Important:** When using multiple root layouts, you must include `<html>` and `<body>` tags in each.

### 4. Conditional Layout Application

```
app/
├── (with-sidebar)/
│   ├── layout.tsx          # Includes sidebar
│   ├── dashboard/
│   │   └── page.tsx
│   └── analytics/
│       └── page.tsx
└── (full-width)/
    ├── layout.tsx          # No sidebar
    ├── landing/
    │   └── page.tsx
    └── checkout/
        └── page.tsx
```

## Examples

### Organizing by Team

```
app/
├── (team-a)/
│   ├── feature-1/
│   │   └── page.tsx
│   └── feature-2/
│       └── page.tsx
└── (team-b)/
    ├── feature-3/
    │   └── page.tsx
    └── feature-4/
        └── page.tsx
```

### Organizing by Feature

```
app/
├── (user-management)/
│   ├── users/
│   │   └── page.tsx
│   └── roles/
│       └── page.tsx
├── (content)/
│   ├── posts/
│   │   └── page.tsx
│   └── media/
│       └── page.tsx
└── (settings)/
    ├── general/
    │   └── page.tsx
    └── advanced/
        └── page.tsx
```

### Public vs Protected Routes

```
app/
├── (public)/
│   ├── layout.tsx
│   ├── page.tsx            # Home
│   ├── about/
│   │   └── page.tsx
│   └── contact/
│       └── page.tsx
└── (protected)/
    ├── layout.tsx
    ├── dashboard/
    │   └── page.tsx
    └── profile/
        └── page.tsx
```

**Protected layout with auth:**

```tsx
// app/(protected)/layout.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div>
      <nav>Protected Nav</nav>
      {children}
    </div>
  )
}
```

### Platform-Specific Layouts

```
app/
├── (web)/
│   ├── layout.tsx          # Web-optimized layout
│   └── page.tsx
└── (mobile)/
    ├── layout.tsx          # Mobile-optimized layout
    └── page.tsx
```

### Locale-Based Organization

```
app/
├── (en)/
│   ├── layout.tsx
│   └── about/
│       └── page.tsx        # URL: /about
└── (es)/
    ├── layout.tsx
    └── about/
        └── page.tsx        # URL: /about (Spanish version)
```

**Note:** For proper i18n, use dynamic routes like `[lang]` instead.

### Admin vs User Interface

```
app/
├── (admin)/
│   ├── layout.tsx
│   ├── users/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
└── (user)/
    ├── layout.tsx
    ├── dashboard/
    │   └── page.tsx
    └── profile/
        └── page.tsx
```

## Combining with Other Features

### Route Groups + Dynamic Routes

```
app/
└── (shop)/
    └── products/
        └── [id]/
            └── page.tsx    # URL: /products/[id]
```

### Route Groups + Parallel Routes

```
app/
└── (dashboard)/
    ├── layout.tsx
    ├── @analytics/
    │   └── page.tsx
    └── @stats/
        └── page.tsx
```

### Route Groups + Intercepting Routes

```
app/
└── (main)/
    ├── feed/
    │   └── page.tsx
    └── (..)photo/
        └── [id]/
            └── page.tsx
```

### Nested Route Groups

```
app/
└── (main)/
    ├── (marketing)/
    │   └── about/
    │       └── page.tsx
    └── (shop)/
        └── products/
            └── page.tsx
```

## Multiple Root Layouts Example

```
app/
├── (marketing)/
│   ├── layout.tsx
│   ├── page.tsx            # URL: /
│   └── about/
│       └── page.tsx        # URL: /about
└── (app)/
    ├── layout.tsx
    └── dashboard/
        └── page.tsx        # URL: /dashboard
```

**Important:**
- Each root layout must include `<html>` and `<body>` tags
- Navigation between routes with different root layouts will cause a full page reload
- Shared UI should be in a common component, not in layouts

## Opt-out of Layout

Skip the parent layout by creating a route group:

```
app/
├── layout.tsx              # Global layout
├── page.tsx                # Uses global layout
└── (no-layout)/
    └── special/
        └── page.tsx        # Skips global layout
```

## Naming Conventions

Route group names are for organization only and don't affect behavior:

```
app/
├── (group-1)/              # ✅ kebab-case
├── (GroupTwo)/             # ✅ PascalCase
├── (group_three)/          # ✅ snake_case
└── (groupfour)/            # ✅ lowercase
```

**Best practice:** Use descriptive names that indicate purpose:

```
✅ Good:
(auth)
(dashboard)
(marketing)
(protected)
(public)

❌ Avoid:
(group1)
(a)
(misc)
```

## TypeScript

Route groups don't affect params or props:

```tsx
// app/(shop)/products/[id]/page.tsx
type Props = {
  params: { id: string }
}

export default function Product({ params }: Props) {
  return <div>Product: {params.id}</div>
}
```

## Version History

- **v13.0.0**: Route Groups introduced with App Router
- **v13.4.0**: App Router stable

## Good to Know

- Route group folders are omitted from the URL path
- Routes inside the same group share the same layout
- Use parentheses to denote a route group: `(folder)`
- Can have multiple route groups at the same level
- Can create multiple root layouts with route groups
- Multiple root layouts cause full page reload on navigation
- Route groups don't affect params or data fetching
- Names are for organization only (no runtime impact)
- Can be nested
- Combine with dynamic routes, parallel routes, and intercepting routes
- Great for organizing large applications by feature, team, or access level
