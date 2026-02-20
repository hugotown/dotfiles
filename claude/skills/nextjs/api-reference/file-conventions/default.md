# default.js / default.tsx

The `default.js` file is used to render a fallback within Parallel Routes when Next.js cannot recover a slot's active state after a full-page load.

## File Signature

```tsx
// app/@team/default.tsx
export default function Default() {
  return null
}
```

## When It's Used

During soft navigation, Next.js keeps track of each slot's active state. However, for hard navigations (full-page load), Next.js cannot recover the active state. A `default.js` file can be rendered for slots that don't match the current URL.

**Scenario:**

```
app/
├── layout.tsx
├── page.tsx
├── @user/
│   ├── page.tsx
│   └── default.tsx
└── @team/
    ├── settings/
    │   └── page.tsx
    └── default.tsx
```

When navigating directly to `/settings`, the `@team` slot knows to render `settings/page.tsx`, but the `@user` slot needs a fallback because there's no `@user/settings/page.tsx`. The `@user/default.tsx` will be rendered instead.

## Props

The default component does not receive any props.

```tsx
export default function Default() {
  return <div>Default content</div>
}
```

## Examples

### Basic Default Fallback

```tsx
// app/@analytics/default.tsx
export default function Default() {
  return null
}
```

### Default with Message

```tsx
// app/@sidebar/default.tsx
export default function Default() {
  return (
    <aside className="w-64 p-4 bg-gray-50">
      <p className="text-gray-500">No sidebar content available</p>
    </aside>
  )
}
```

### Default Matching Main Content

```tsx
// app/@modal/default.tsx
export default function Default() {
  // Return null to hide the modal by default
  return null
}
```

### Default with Navigation

```tsx
// app/@secondary/default.tsx
import Link from 'next/link'

export default function Default() {
  return (
    <div className="p-4">
      <h3 className="font-semibold mb-2">Secondary Content</h3>
      <p className="text-sm text-gray-600 mb-4">
        No specific content for this page.
      </p>
      <Link href="/dashboard" className="text-blue-500 hover:underline">
        Go to Dashboard
      </Link>
    </div>
  )
}
```

### Parallel Routes with Default

```tsx
// app/layout.tsx
export default function Layout({
  children,
  team,
  analytics,
}: {
  children: React.ReactNode
  team: React.ReactNode
  analytics: React.ReactNode
}) {
  return (
    <div>
      <div>{children}</div>
      <div>{team}</div>
      <div>{analytics}</div>
    </div>
  )
}
```

```tsx
// app/@team/default.tsx
export default function TeamDefault() {
  return <div>Team content not available</div>
}
```

```tsx
// app/@analytics/default.tsx
export default function AnalyticsDefault() {
  return null // Hide analytics by default
}
```

### Default for Modal Pattern

```tsx
// app/@modal/default.tsx
// Modal should be hidden by default
export default function ModalDefault() {
  return null
}
```

```tsx
// app/@modal/login/page.tsx
// Show modal when navigating to /login
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

### Default with Loading State

```tsx
// app/@sidebar/default.tsx
export default function SidebarDefault() {
  return (
    <aside className="w-64 p-4">
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    </aside>
  )
}
```

## Understanding Parallel Routes and Default

Parallel routes allow you to render multiple pages in the same layout simultaneously.

**Directory Structure:**

```
app/
├── layout.tsx
├── page.tsx
├── @audience/
│   ├── page.tsx
│   └── default.tsx
└── @views/
    ├── page.tsx
    └── default.tsx
```

**Layout Implementation:**

```tsx
// app/layout.tsx
export default function Layout({
  children,
  audience,
  views,
}: {
  children: React.ReactNode
  audience: React.ReactNode
  views: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">{children}</div>
      <div>{audience}</div>
      <div>{views}</div>
    </div>
  )
}
```

**Default Files:**

```tsx
// app/@audience/default.tsx
export default function AudienceDefault() {
  return <div>No audience data</div>
}
```

```tsx
// app/@views/default.tsx
export default function ViewsDefault() {
  return <div>No views data</div>
}
```

## Default vs Page

| File | Purpose | When Rendered |
|------|---------|---------------|
| `page.js` | Active content for a route | When URL matches the route |
| `default.js` | Fallback content for a slot | When slot doesn't match the current URL |

## Common Patterns

### 1. Hide Slot by Default

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null
}
```

### 2. Show Placeholder

```tsx
// app/@sidebar/default.tsx
export default function Default() {
  return <div>Select an item to view details</div>
}
```

### 3. Match Main Layout

```tsx
// app/@details/default.tsx
export default function Default() {
  return (
    <div className="p-4 bg-gray-50">
      <p className="text-gray-500">No details available</p>
    </div>
  )
}
```

## Navigation Behavior

**Soft Navigation (Client-side):**
- Next.js tracks active state
- No need for default.js
- Slots maintain their content

**Hard Navigation (Full-page load):**
- Active state is lost
- default.js is used as fallback
- Each slot needs a default or matching page

**Example:**

```
URL: /dashboard/analytics

Soft navigation: ✅ All slots maintain state
Hard navigation (refresh): ❌ Slots need default.js
```

## TypeScript

```tsx
export default function Default(): JSX.Element | null {
  return null
}
```

## Version History

- **v13.0.0**: Parallel Routes and default.js introduced
- **v13.4.0**: App Router stable

## Good to Know

- Only needed for Parallel Routes
- Renders when slot doesn't match current URL
- Can return `null` to hide the slot
- Can be Server or Client Component
- Does not receive any props
- Provides fallback for hard navigations
- Not needed if slot has a matching page for every route
- Helps prevent 404 errors in parallel route slots
- `.js`, `.jsx`, or `.tsx` file extensions can be used
- Commonly returns `null` for modal patterns
