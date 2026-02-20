# Parallel Routes

Parallel Routes allow you to simultaneously or conditionally render multiple pages in the same layout. They're useful for highly dynamic sections like dashboards and feeds.

## Syntax

Parallel routes are created using named slots with the `@folder` convention:

```
app/
├── layout.tsx
├── page.tsx
├── @analytics/
│   └── page.tsx
└── @team/
    └── page.tsx
```

## Slots

Slots are defined with the `@folder` naming convention and passed to the layout as props:

```tsx
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
      <div>{analytics}</div>
      <div>{team}</div>
    </div>
  )
}
```

**Important:** `children` is an implicit slot that doesn't need to be in an `@` folder.

## Basic Example

### Directory Structure

```
app/
├── layout.tsx
├── page.tsx
├── @viewer/
│   └── page.tsx
└── @editor/
    └── page.tsx
```

### Layout Implementation

```tsx
// app/layout.tsx
export default function Layout({
  children,
  viewer,
  editor,
}: {
  children: React.ReactNode
  viewer: React.ReactNode
  editor: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">{children}</div>
      <div>{viewer}</div>
      <div>{editor}</div>
    </div>
  )
}
```

### Slot Pages

```tsx
// app/page.tsx
export default function Page() {
  return <h1>Main Content</h1>
}
```

```tsx
// app/@viewer/page.tsx
export default function ViewerPage() {
  return <div>Viewer Panel</div>
}
```

```tsx
// app/@editor/page.tsx
export default function EditorPage() {
  return <div>Editor Panel</div>
}
```

## Use Cases

### 1. Dashboard Layout

```
app/
├── dashboard/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── @analytics/
│   │   └── page.tsx
│   ├── @revenue/
│   │   └── page.tsx
│   └── @notifications/
│       └── page.tsx
```

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  analytics,
  revenue,
  notifications,
}: {
  children: React.ReactNode
  analytics: React.ReactNode
  revenue: React.ReactNode
  notifications: React.ReactNode
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">{children}</div>
        <div>{notifications}</div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>{analytics}</div>
        <div>{revenue}</div>
      </div>
    </div>
  )
}
```

### 2. Conditional Rendering

```tsx
// app/dashboard/layout.tsx
import { checkUserRole } from '@/lib/auth'

export default async function DashboardLayout({
  children,
  admin,
  user,
}: {
  children: React.ReactNode
  admin: React.ReactNode
  user: React.ReactNode
}) {
  const role = await checkUserRole()

  return (
    <div>
      <div>{children}</div>
      {role === 'admin' ? admin : user}
    </div>
  )
}
```

### 3. Modal Pattern

```
app/
├── layout.tsx
├── page.tsx
└── @modal/
    ├── default.tsx         # Return null by default
    └── login/
        └── page.tsx        # Show modal at /login
```

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <html>
      <body>
        {children}
        {modal}
      </body>
    </html>
  )
}
```

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null
}
```

```tsx
// app/@modal/login/page.tsx
export default function LoginModal() {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg">
        <h2>Login</h2>
        {/* Login form */}
      </div>
    </div>
  )
}
```

## Default Files

When navigating, Next.js needs to know what to render in slots that don't match the current route. Use `default.js`:

```
app/
├── layout.tsx
├── @team/
│   ├── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   └── default.tsx         # Fallback for @team
└── @analytics/
    ├── page.tsx
    └── default.tsx         # Fallback for @analytics
```

```tsx
// app/@team/default.tsx
export default function TeamDefault() {
  return null
}
```

## Examples

### Split View Application

```
app/
├── layout.tsx
├── @left/
│   └── page.tsx
└── @right/
    └── page.tsx
```

```tsx
// app/layout.tsx
export default function Layout({
  left,
  right,
}: {
  left: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <div className="w-1/2 border-r">{left}</div>
      <div className="w-1/2">{right}</div>
    </div>
  )
}
```

### Multi-Panel Dashboard

```
app/
├── dashboard/
│   ├── layout.tsx
│   ├── @stats/
│   │   └── page.tsx
│   ├── @charts/
│   │   └── page.tsx
│   ├── @activity/
│   │   └── page.tsx
│   └── @users/
│       └── page.tsx
```

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  stats,
  charts,
  activity,
  users,
}: {
  stats: React.ReactNode
  charts: React.ReactNode
  activity: React.ReactNode
  users: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>{stats}</div>
      <div>{activity}</div>
      <div className="col-span-2">{charts}</div>
      <div className="col-span-2">{users}</div>
    </div>
  )
}
```

### Tab-like Interface

```
app/
├── profile/
│   ├── layout.tsx
│   ├── @tabs/
│   │   ├── default.tsx
│   │   ├── posts/
│   │   │   └── page.tsx
│   │   ├── followers/
│   │   │   └── page.tsx
│   │   └── following/
│   │       └── page.tsx
│   └── page.tsx
```

```tsx
// app/profile/layout.tsx
export default function ProfileLayout({
  children,
  tabs,
}: {
  children: React.ReactNode
  tabs: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-4">{children}</div>
      <div>{tabs}</div>
    </div>
  )
}
```

### Independent Loading States

```tsx
// app/dashboard/@analytics/loading.tsx
export default function AnalyticsLoading() {
  return <div>Loading analytics...</div>
}
```

```tsx
// app/dashboard/@revenue/loading.tsx
export default function RevenueLoading() {
  return <div>Loading revenue...</div>
}
```

Each slot can have its own loading state!

### Independent Error Boundaries

```tsx
// app/dashboard/@analytics/error.tsx
'use client'

export default function AnalyticsError() {
  return <div>Failed to load analytics</div>
}
```

```tsx
// app/dashboard/@revenue/error.tsx
'use client'

export default function RevenueError() {
  return <div>Failed to load revenue</div>
}
```

Each slot can handle errors independently!

### Nested Parallel Routes

```
app/
├── dashboard/
│   ├── layout.tsx
│   ├── @analytics/
│   │   ├── layout.tsx
│   │   ├── @chart/
│   │   │   └── page.tsx
│   │   └── @table/
│   │       └── page.tsx
│   └── @activity/
│       └── page.tsx
```

### Conditional Slots Based on User

```tsx
// app/layout.tsx
import { getUser } from '@/lib/auth'

export default async function Layout({
  children,
  admin,
  user,
}: {
  children: React.ReactNode
  admin: React.ReactNode
  user: React.ReactNode
}) {
  const currentUser = await getUser()

  return (
    <div>
      {children}
      {currentUser.isAdmin ? admin : user}
    </div>
  )
}
```

### Photo Modal Pattern

```
app/
├── layout.tsx
├── @modal/
│   ├── default.tsx
│   └── (..)photo/
│       └── [id]/
│           └── page.tsx
└── photo/
    └── [id]/
        └── page.tsx
```

```tsx
// app/layout.tsx
export default function Layout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
```

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null
}
```

```tsx
// app/@modal/(..)photo/[id]/page.tsx
import { Modal } from '@/components/modal'

export default function PhotoModal({
  params,
}: {
  params: { id: string }
}) {
  return (
    <Modal>
      <img src={`/photos/${params.id}.jpg`} alt="Photo" />
    </Modal>
  )
}
```

## Route Groups with Parallel Routes

```
app/
├── (shop)/
│   ├── layout.tsx
│   ├── @modal/
│   │   └── default.tsx
│   └── products/
│       └── page.tsx
└── (marketing)/
    └── page.tsx
```

## Active State Recovery

When doing a hard navigation, Next.js cannot recover the active state of slots. Use `default.js` to define fallback content.

**Soft navigation:** State is preserved
**Hard navigation:** `default.js` is rendered

## TypeScript

```tsx
type LayoutProps = {
  children: React.ReactNode
  analytics: React.ReactNode
  team: React.ReactNode
}

export default function Layout({ children, analytics, team }: LayoutProps) {
  return (
    <div>
      {children}
      {analytics}
      {team}
    </div>
  )
}
```

## Version History

- **v13.0.0**: Parallel Routes introduced with App Router
- **v13.4.0**: App Router stable

## Good to Know

- Slots are defined with `@folder` naming convention
- Slots are passed as props to the layout
- `children` is an implicit slot
- Each slot can have its own `loading.tsx` and `error.tsx`
- Use `default.tsx` to handle unmatched routes in slots
- Slots are NOT route segments (don't affect URL)
- Can be conditionally rendered based on auth, feature flags, etc.
- Perfect for dashboards, split views, and modals
- Combine with intercepting routes for modal patterns
- Each slot can fetch data independently
- Enables independent error and loading states
- Can be nested for complex layouts
