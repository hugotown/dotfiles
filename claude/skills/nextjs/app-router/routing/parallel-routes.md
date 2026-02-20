# Parallel Routes in Next.js App Router

Parallel routes allow you to simultaneously render multiple pages in the same layout. This enables advanced routing patterns like dashboards with multiple panels, modals, split views, and conditional UI based on application state.

## Overview

Parallel routes are created using **named slots** defined with the `@folder` convention. Each slot is passed to the parent layout as a prop, allowing you to render multiple pages independently within the same layout.

## Basic Syntax

### Creating Named Slots

Create a slot by prefixing a folder name with `@`:

```
app/
  layout.tsx
  @analytics/
    page.tsx
  @team/
    page.tsx
  page.tsx
```

**Layout receives slots as props:**

```typescript
// app/layout.tsx
export default function Layout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode
  analytics: React.ReactNode
  team: React.ReactNode
}) {
  return (
    <div>
      <div>{children}</div>
      <div className="grid grid-cols-2">
        <div>{analytics}</div>
        <div>{team}</div>
      </div>
    </div>
  )
}
```

This renders:
- `children` - The main page content from `page.tsx`
- `analytics` - Content from `@analytics/page.tsx`
- `team` - Content from `@team/page.tsx`

## Use Cases

### 1. Dashboard with Multiple Panels

Create a dashboard with multiple independent panels:

```
app/
  dashboard/
    layout.tsx
    @revenue/
      page.tsx
    @users/
      page.tsx
    @notifications/
      page.tsx
    page.tsx
```

**Dashboard Layout:**

```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  revenue,
  users,
  notifications,
}: {
  children: React.ReactNode
  revenue: React.ReactNode
  users: React.ReactNode
  notifications: React.ReactNode
}) {
  return (
    <div className="dashboard">
      <div className="main-content">{children}</div>
      <div className="grid grid-cols-3 gap-4">
        <div className="panel">{revenue}</div>
        <div className="panel">{users}</div>
        <div className="panel">{notifications}</div>
      </div>
    </div>
  )
}
```

**Revenue Panel:**

```typescript
// app/dashboard/@revenue/page.tsx
export default async function RevenuePanel() {
  const revenue = await fetchRevenueData()

  return (
    <div>
      <h2>Revenue</h2>
      <p>${revenue.total}</p>
      <chart data={revenue.monthly} />
    </div>
  )
}
```

### 2. Modal Patterns

Implement modals that maintain background content:

```
app/
  layout.tsx
  @modal/
    (.)photos/
      [id]/
        page.tsx
  photos/
    [id]/
      page.tsx
  page.tsx
```

**Root Layout with Modal:**

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {modal}
      </body>
    </html>
  )
}
```

**Modal Content:**

```typescript
// app/@modal/(.)photos/[id]/page.tsx
import { Modal } from '@/components/Modal'

export default function PhotoModal({ params }: { params: { id: string } }) {
  return (
    <Modal>
      <img src={`/photos/${params.id}`} alt="Photo" />
    </Modal>
  )
}
```

### 3. Conditional UI Based on Authentication

Show different content based on user state:

```
app/
  layout.tsx
  @authenticated/
    page.tsx
  @guest/
    page.tsx
  default.tsx
```

**Conditional Layout:**

```typescript
// app/layout.tsx
import { auth } from '@/lib/auth'

export default async function Layout({
  authenticated,
  guest,
}: {
  authenticated: React.ReactNode
  guest: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="en">
      <body>{session ? authenticated : guest}</body>
    </html>
  )
}
```

### 4. Split View / Side-by-Side Content

Display related content side-by-side:

```
app/
  docs/
    layout.tsx
    @main/
      [slug]/
        page.tsx
    @sidebar/
      [slug]/
        page.tsx
```

**Split View Layout:**

```typescript
// app/docs/layout.tsx
export default function DocsLayout({
  main,
  sidebar,
}: {
  main: React.ReactNode
  sidebar: React.ReactNode
}) {
  return (
    <div className="flex">
      <main className="flex-1">{main}</main>
      <aside className="w-80">{sidebar}</aside>
    </div>
  )
}
```

## Independent Navigation

Each slot can navigate independently without affecting other slots:

```
app/
  dashboard/
    layout.tsx
    @analytics/
      page.tsx
      revenue/
        page.tsx    → /dashboard/revenue (only analytics slot changes)
      users/
        page.tsx    → /dashboard/users (only analytics slot changes)
    @team/
      page.tsx
      members/
        page.tsx    → /dashboard/members (only team slot changes)
```

**Navigation within a slot:**

```typescript
// app/dashboard/@analytics/page.tsx
import Link from 'next/link'

export default function AnalyticsHome() {
  return (
    <div>
      <h2>Analytics</h2>
      <nav>
        <Link href="/dashboard/revenue">Revenue</Link>
        <Link href="/dashboard/users">Users</Link>
      </nav>
    </div>
  )
}
```

When navigating to `/dashboard/revenue`, only the `@analytics` slot renders the new content while `@team` remains unchanged.

## default.js - The Fallback

The `default.js` file serves as a fallback to render when Next.js cannot recover a slot's active state after a navigation.

### When default.js is Used

```
app/
  layout.tsx
  @team/
    page.tsx
    settings/
      page.tsx
  @analytics/
    page.tsx
    default.tsx    # Fallback for @analytics
  page.tsx
```

**Scenario:**
1. User is on `/` - Both slots show their `page.tsx`
2. User navigates to `/settings` - `@team` shows settings, but `@analytics/settings/page.tsx` doesn't exist
3. Next.js renders `@analytics/default.tsx` instead

**Default fallback:**

```typescript
// app/@analytics/default.tsx
export default function AnalyticsDefault() {
  return <div>Select a view from the main content</div>
}
```

### Without default.js

If no `default.js` exists, Next.js will render `null` for that slot, which might cause layout issues.

**Best Practice:** Always provide `default.js` for each parallel route:

```typescript
// app/@analytics/default.tsx
export default function Default() {
  return null // Or a meaningful fallback
}
```

## Conditional Rendering in Slots

You can conditionally render slot content in the layout:

```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode
  analytics: React.ReactNode
  team: React.ReactNode
}) {
  const showAnalytics = true // Could be based on user permissions

  return (
    <div>
      <main>{children}</main>
      {showAnalytics && <aside>{analytics}</aside>}
      <section>{team}</section>
    </div>
  )
}
```

## Loading States

Each slot can have its own loading state:

```
app/
  dashboard/
    @analytics/
      page.tsx
      loading.tsx    # Loading state for analytics
    @team/
      page.tsx
      loading.tsx    # Loading state for team
```

**Loading UI:**

```typescript
// app/dashboard/@analytics/loading.tsx
export default function AnalyticsLoading() {
  return <div className="animate-pulse">Loading analytics...</div>
}
```

This allows each slot to show loading independently while data fetches.

## Error Handling

Each slot can have its own error boundary:

```
app/
  dashboard/
    @analytics/
      page.tsx
      error.tsx      # Error boundary for analytics
    @team/
      page.tsx
      error.tsx      # Error boundary for team
```

**Error UI:**

```typescript
// app/dashboard/@analytics/error.tsx
'use client'

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h2>Analytics Error</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Advanced Patterns

### Tab Navigation with Parallel Routes

```
app/
  profile/
    layout.tsx
    @posts/
      page.tsx
    @photos/
      page.tsx
    @likes/
      page.tsx
    default.tsx
```

**Tab Layout:**

```typescript
// app/profile/layout.tsx
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import Link from 'next/link'

export default function ProfileLayout({
  posts,
  photos,
  likes,
}: {
  posts: React.ReactNode
  photos: React.ReactNode
  likes: React.ReactNode
}) {
  const segment = useSelectedLayoutSegment()

  return (
    <div>
      <nav>
        <Link href="/profile" className={!segment ? 'active' : ''}>
          Posts
        </Link>
        <Link href="/profile/photos" className={segment === 'photos' ? 'active' : ''}>
          Photos
        </Link>
        <Link href="/profile/likes" className={segment === 'likes' ? 'active' : ''}>
          Likes
        </Link>
      </nav>
      <div>
        {!segment && posts}
        {segment === 'photos' && photos}
        {segment === 'likes' && likes}
      </div>
    </div>
  )
}
```

### Modal with Background Softlock

```
app/
  layout.tsx
  @modal/
    (.)login/
      page.tsx
    default.tsx
  login/
    page.tsx
  page.tsx
```

**Modal with Backdrop:**

```typescript
// app/@modal/(.)login/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'

export default function LoginModal() {
  const router = useRouter()

  return (
    <div className="modal-backdrop" onClick={() => router.back()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <LoginForm />
      </div>
    </div>
  )
}
```

### Multi-Column Layout

```
app/
  feed/
    layout.tsx
    @main/
      page.tsx
      [post]/
        page.tsx
    @sidebar/
      page.tsx
    @trending/
      page.tsx
```

**Three-Column Layout:**

```typescript
// app/feed/layout.tsx
export default function FeedLayout({
  main,
  sidebar,
  trending,
}: {
  main: React.ReactNode
  sidebar: React.ReactNode
  trending: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-3">{sidebar}</aside>
      <main className="col-span-6">{main}</main>
      <aside className="col-span-3">{trending}</aside>
    </div>
  )
}
```

## Best Practices

### 1. Always Provide default.js

Prevent broken layouts when routes don't match:

```typescript
// app/@analytics/default.tsx
export default function Default() {
  return null
}
```

### 2. Use for Independent Content

Parallel routes work best when content is truly independent:

```
✅ Good - Independent panels
dashboard/
  @revenue/
  @users/

❌ Avoid - Tightly coupled content
blog/
  @post/
  @comments/  # Comments depend on post, use regular nesting
```

### 3. Combine with Intercepting Routes

Use with intercepting routes for modal patterns:

```
app/
  @modal/
    (.)photo/[id]/page.tsx    # Modal view
  photo/[id]/page.tsx         # Full page view
```

### 4. Keep Slot Logic Simple

Don't overcomplicate slot rendering logic:

```typescript
// ✅ Simple conditional
<div>
  {showSidebar && sidebar}
  {main}
</div>

// ❌ Overcomplicated
<div>
  {user?.role === 'admin' && user?.permissions?.includes('view_analytics')
    ? analytics
    : fallback}
</div>
```

### 5. Use TypeScript for Type Safety

Define clear types for layout props:

```typescript
interface LayoutProps {
  children: React.ReactNode
  analytics: React.ReactNode
  team: React.ReactNode
}

export default function Layout({ children, analytics, team }: LayoutProps) {
  // Layout code
}
```

## Common Pitfalls

### 1. Missing default.js

```
❌ Layout breaks when navigating to unmatched routes
app/
  @analytics/
    page.tsx
  # No default.tsx

✅ Provides fallback
app/
  @analytics/
    page.tsx
    default.tsx
```

### 2. Incorrect Slot Naming

```
❌ Wrong - no @ prefix
app/
  analytics/
    page.tsx

✅ Correct - @ prefix for slots
app/
  @analytics/
    page.tsx
```

### 3. Not Handling Slot in Layout

```
❌ Slot prop not used
export default function Layout({ children, analytics }: LayoutProps) {
  return <div>{children}</div> // analytics never rendered
}

✅ All slots rendered
export default function Layout({ children, analytics }: LayoutProps) {
  return (
    <div>
      {children}
      {analytics}
    </div>
  )
}
```

### 4. Confusing with Route Groups

```
Route Group: (folder)   - Organizational only, excluded from URL
Parallel Route: @folder - Named slot, rendered in parallel
```

## Comparison with Other Patterns

### Parallel Routes vs. Regular Nesting

**Parallel Routes:**
- Independent navigation
- Rendered simultaneously
- Can have different loading/error states

```
app/
  @analytics/page.tsx
  @team/page.tsx
```

**Regular Nesting:**
- Sequential navigation
- Parent must render before child
- Shared loading/error states

```
app/
  analytics/page.tsx
  team/page.tsx
```

### Parallel Routes vs. Client-Side State

**Parallel Routes (Server):**
- URL-driven
- SSR-friendly
- Shareable state via URL

**Client State (Client):**
- In-memory only
- Requires JavaScript
- Not shareable

Use parallel routes when state should be in URL, use client state for ephemeral UI.

## Summary

Parallel routes enable sophisticated UI patterns in Next.js:

- **Syntax**: `@folder` creates named slots
- **Props**: Slots passed to parent layout as props
- **Independence**: Each slot navigates independently
- **Fallback**: Use `default.js` for unmatched routes
- **Loading/Error**: Each slot has its own boundaries
- **Use Cases**: Dashboards, modals, tabs, split views

Parallel routes shine when you need multiple independent sections of UI that can navigate and load independently while sharing a common layout.
