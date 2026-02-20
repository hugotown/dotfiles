# use client

The `'use client'` directive marks a component tree as Client Components, enabling browser-side interactivity, event handlers, and access to browser APIs. By default, all components in Next.js are Server Components.

## Syntax

```typescript
'use client'
```

Must be placed at the **top** of a component file, before any imports.

## Use Cases

### 1. Interactive Components with Event Handlers

Components that need onClick, onChange, or other event handlers.

```typescript
// app/components/Counter.tsx
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(count - 1)}>
        Decrement
      </button>
    </div>
  )
}
```

### 2. Browser API Access

Components that use browser-only APIs like localStorage, window, or navigator.

```typescript
'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Access localStorage (browser-only API)
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark'
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
```

### 3. React Hooks Usage

Components using useState, useEffect, useContext, or custom hooks.

```typescript
'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function AnalyticsTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Track page views
    const url = pathname + searchParams.toString()

    // Send analytics event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: url
      })
    }
  }, [pathname, searchParams])

  return null // Analytics component doesn't render anything
}
```

### 4. Form with Client-Side Validation

```typescript
'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'

export function ContactForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid'
    }

    if (!message || message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Submit form data
    await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({ email, message })
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>

      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your message"
        />
        {errors.message && <span className="error">{errors.message}</span>}
      </div>

      <button type="submit">Send</button>
    </form>
  )
}
```

### 5. Third-Party Component Libraries

Wrapping libraries that require client-side rendering.

```typescript
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

// Dynamic import for heavy chart library
const Chart = dynamic(() => import('react-chartjs-2').then(mod => mod.Line), {
  ssr: false,
  loading: () => <p>Loading chart...</p>
})

interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
  }>
}

export function AnalyticsChart({ data }: { data: ChartData }) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d')

  return (
    <div>
      <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
      </select>

      <Chart data={data} options={{ responsive: true }} />
    </div>
  )
}
```

## Component Boundaries

### Server and Client Component Composition

```typescript
// app/page.tsx (Server Component - no directive)
import { ClientComponent } from './ClientComponent'

async function ServerComponent() {
  const data = await fetchData() // Server-side data fetching

  return (
    <div>
      <h1>Server Component</h1>
      <p>Data fetched on server: {data.title}</p>

      {/* Client Component nested in Server Component */}
      <ClientComponent initialData={data} />
    </div>
  )
}

export default ServerComponent
```

```typescript
// app/ClientComponent.tsx
'use client'

import { useState } from 'react'

export function ClientComponent({ initialData }: { initialData: any }) {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h2>Client Component</h2>
      <p>Initial: {initialData.title}</p>
      <button onClick={() => setCount(count + 1)}>
        Clicks: {count}
      </button>
    </div>
  )
}
```

### Passing Server Components as Children

```typescript
// ClientWrapper.tsx
'use client'

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="interactive-wrapper">
      {children}
    </div>
  )
}

// page.tsx (Server Component)
async function Page() {
  const data = await fetchData()

  return (
    <ClientWrapper>
      {/* This remains a Server Component */}
      <ServerDataDisplay data={data} />
    </ClientWrapper>
  )
}
```

## Best Practices

### 1. Keep Client Components Small and Focused

```typescript
// Good - small, focused client component
'use client'

export function LikeButton({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false)

  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? '❤️' : '🤍'}
    </button>
  )
}

// Use in Server Component
async function BlogPost({ id }: { id: string }) {
  const post = await getPost(id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      <LikeButton postId={id} /> {/* Only this is a Client Component */}
    </article>
  )
}
```

### 2. Move Client Boundary Down

```typescript
// Bad - entire page is a Client Component
'use client'

export default function Page() {
  const [filter, setFilter] = useState('')

  return (
    <div>
      <Header /> {/* Doesn't need to be client */}
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ProductList filter={filter} />
    </div>
  )
}

// Good - only interactive parts are Client Components
// page.tsx (Server Component)
export default function Page() {
  return (
    <div>
      <Header /> {/* Server Component */}
      <ProductSearch /> {/* Client Component */}
    </div>
  )
}

// ProductSearch.tsx
'use client'

export function ProductSearch() {
  const [filter, setFilter] = useState('')

  return (
    <>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ProductList filter={filter} />
    </>
  )
}
```

### 3. Serialize Props Properly

```typescript
// Bad - passing non-serializable props
<ClientComponent
  callback={() => console.log('hello')} // Functions can't be serialized
  date={new Date()} // Dates need special handling
/>

// Good - pass serializable data
<ClientComponent
  timestamp={new Date().toISOString()} // String is serializable
  onAction="log" // Pass identifier, implement logic in client
/>
```

### 4. Use Server Actions with Client Components

```typescript
// actions.ts
'use server'

export async function submitForm(formData: FormData) {
  const email = formData.get('email')
  await saveToDatabase({ email })
  return { success: true }
}

// ContactForm.tsx
'use client'

import { submitForm } from './actions'
import { useState } from 'react'

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')

  const handleSubmit = async (formData: FormData) => {
    setStatus('loading')
    const result = await submitForm(formData)
    setStatus('success')
  }

  return (
    <form action={handleSubmit}>
      <input name="email" type="email" required />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending...' : 'Submit'}
      </button>
      {status === 'success' && <p>Sent successfully!</p>}
    </form>
  )
}
```

## Common Pitfalls to Avoid

### 1. Don't Import Server Components into Client Components

```typescript
// Bad - can't import Server Components into Client Components
'use client'

import { ServerComponent } from './ServerComponent' // Error!

export function ClientComponent() {
  return <ServerComponent /> // Won't work
}

// Good - pass as children or props
'use client'

export function ClientComponent({
  children
}: {
  children: React.ReactNode
}) {
  return <div>{children}</div>
}

// In parent Server Component
<ClientComponent>
  <ServerComponent />
</ClientComponent>
```

### 2. Avoid Unnecessary Client Components

```typescript
// Bad - doesn't need to be a Client Component
'use client'

export function StaticHeader({ title }: { title: string }) {
  return <h1>{title}</h1> // No interactivity
}

// Good - keep as Server Component
export function StaticHeader({ title }: { title: string }) {
  return <h1>{title}</h1>
}
```

### 3. Handle SSR Mismatches

```typescript
'use client'

import { useEffect, useState } from 'react'

export function ClientOnlyComponent() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null // Avoid hydration mismatch
  }

  return (
    <div>
      Current time: {new Date().toLocaleTimeString()}
    </div>
  )
}
```

### 4. Don't Fetch Data in Client Components (Prefer Server)

```typescript
// Bad - fetching in Client Component
'use client'

export function ProductList() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts)
  }, [])

  // Renders twice, SEO issues, loading states
}

// Good - fetch in Server Component
async function ProductList() {
  const products = await fetchProducts() // Server-side

  return (
    <div>
      {products.map(p => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
```

## Performance Considerations

- **Bundle Size**: Client Components increase JavaScript bundle size
- **Hydration**: Client Components require hydration on the client
- **Interactivity**: Only use when interactivity is needed
- **Streaming**: Server Components can stream, Client Components can't until hydrated

## TypeScript Support

```typescript
'use client'

import { useState } from 'react'

interface Product {
  id: string
  name: string
  price: number
}

interface ProductFilterProps {
  products: Product[]
  onFilterChange?: (filtered: Product[]) => void
}

export function ProductFilter({ products, onFilterChange }: ProductFilterProps) {
  const [search, setSearch] = useState('')

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleChange = (value: string) => {
    setSearch(value)
    onFilterChange?.(filtered)
  }

  return (
    <input
      value={search}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Search products..."
    />
  )
}
```

## Related Directives

- [use server](./use-server.md) - Server Actions for mutations
- [use cache](./use-cache.md) - Caching (used with Server Components)
