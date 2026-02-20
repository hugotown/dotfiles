# template.js / template.tsx

A template file is similar to a layout but creates a new instance for each child on navigation. Unlike layouts that persist across routes, templates create a fresh instance on each navigation.

## File Signature

```tsx
// app/template.tsx
export default function Template({
  children
}: {
  children: React.ReactNode
}) {
  return <div>{children}</div>
}
```

## Props

Templates receive the same props as layouts.

### children (Required)

The content to be rendered inside the template.

```tsx
export default function Template({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="template-wrapper">
      {children}
    </div>
  )
}
```

### params (Optional)

The dynamic route parameters from the root segment down to that template.

```tsx
// app/blog/[category]/template.tsx
export default function CategoryTemplate({
  children,
  params
}: {
  children: React.ReactNode
  params: { category: string }
}) {
  return (
    <div data-category={params.category}>
      {children}
    </div>
  )
}
```

## Template vs Layout

| Feature | Layout | Template |
|---------|--------|----------|
| Preserves state across navigation | Yes | No |
| Re-renders on navigation | No | Yes |
| Re-mounts DOM | No | Yes |
| Use case | Persistent UI (nav, sidebar) | Fresh state per route |

**When to use Template:**
- Need to reset state on navigation
- Want CSS/JS animations on route changes
- Need to re-sync effects on navigation
- Want fresh component instances per route

**When to use Layout:**
- Want to preserve state across routes
- Avoid unnecessary re-renders
- Keep UI persistent (navigation, sidebars)

## Examples

### Basic Template

```tsx
// app/template.tsx
export default function Template({
  children,
}: {
  children: React.ReactNode
}) {
  return <div>{children}</div>
}
```

### Template with Animation

```tsx
// app/template.tsx
'use client'

import { motion } from 'framer-motion'

export default function Template({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
```

### Template with Analytics

```tsx
// app/template.tsx
'use client'

import { useEffect } from 'react'
import { trackPageView } from '@/lib/analytics'

export default function Template({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // This will run on every navigation
    trackPageView()
  }, [])

  return <div>{children}</div>
}
```

### Template Resetting State

```tsx
// app/blog/template.tsx
'use client'

import { useState, useEffect } from 'react'

export default function BlogTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    // Reset scroll state on each navigation
    setScrolled(false)

    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={scrolled ? 'scrolled' : ''}>
      {children}
    </div>
  )
}
```

### Template with Dynamic Params

```tsx
// app/[locale]/template.tsx
export default function LocaleTemplate({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  return (
    <div lang={params.locale} dir={params.locale === 'ar' ? 'rtl' : 'ltr'}>
      {children}
    </div>
  )
}
```

### Template for Page Transitions

```tsx
// app/template.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

export default function Template({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

## Rendering Order

When both layout and template exist, the rendering hierarchy is:

```tsx
<Layout>
  <Template>
    <Page />
  </Template>
</Layout>
```

Example directory structure:

```
app/
├── layout.tsx
├── template.tsx
└── dashboard/
    ├── layout.tsx
    ├── template.tsx
    └── page.tsx
```

Renders as:

```tsx
<RootLayout>
  <RootTemplate>
    <DashboardLayout>
      <DashboardTemplate>
        <DashboardPage />
      </DashboardTemplate>
    </DashboardLayout>
  </RootTemplate>
</RootLayout>
```

## TypeScript

```tsx
type TemplateProps = {
  children: React.ReactNode
  params?: { [key: string]: string }
}

export default function Template({ children, params }: TemplateProps) {
  return <div>{children}</div>
}
```

## Version History

- **v13.0.0**: App Router introduced with template.js convention
- **v13.4.0**: App Router stable

## Good to Know

- Templates create a new instance on navigation
- Templates are useful for enter/exit animations
- Templates can be Client Components for animations
- Both layout and template can exist in the same directory
- Templates re-mount DOM elements on navigation
- Templates are rendered inside layouts
- `.js`, `.jsx`, or `.tsx` file extensions can be used
- Use templates sparingly - layouts are more performant for persistent UI
