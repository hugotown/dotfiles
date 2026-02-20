# Client Components

Client Components are components that render in the browser, enabling interactivity, state management, and access to browser APIs. They are marked with the `'use client'` directive at the top of the file.

## The 'use client' Directive

To create a Client Component, add `'use client'` at the top of your file.

```tsx
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

### Important Notes

- `'use client'` must be at the very top of the file, before any imports
- It only needs to be declared once per file
- All modules imported by a Client Component become part of the client bundle
- The directive defines a boundary between Server and Client Component code

## Key Capabilities

### 1. React Hooks
Client Components can use all React hooks.

```tsx
'use client'

import { useState, useEffect, useContext, useReducer } from 'react'

export default function InteractiveComponent() {
  const [state, setState] = useState('initial')
  const context = useContext(MyContext)

  useEffect(() => {
    // Side effects, subscriptions, etc.
    const subscription = subscribeToData((data) => {
      setState(data)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <div>{state}</div>
}
```

### 2. Event Handlers
Attach event handlers to respond to user interactions.

```tsx
'use client'

export default function Form() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Handle input changes
  }

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} />
      <button type="submit">Submit</button>
    </form>
  )
}
```

### 3. Browser APIs
Access browser-only APIs like localStorage, window, navigator, etc.

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<string>()

  useEffect(() => {
    // Access localStorage
    const savedTheme = localStorage.getItem('theme') || 'light'
    setTheme(savedTheme)

    // Access window
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return <button onClick={toggleTheme}>Theme: {theme}</button>
}
```

### 4. State Management
Manage component and application state.

```tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

// Create context for global state
const CartContext = createContext<{
  items: any[]
  addItem: (item: any) => void
  removeItem: (id: string) => void
} | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<any[]>([])

  const addItem = (item: any) => {
    setItems(prev => [...prev, item])
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  return (
    <CartContext.Provider value={{ items, addItem, removeItem }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
```

### 5. Custom Hooks
Create and use custom hooks for reusable logic.

```tsx
'use client'

import { useState, useEffect } from 'react'

// Custom hook
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

// Using the custom hook
export default function ResponsiveComponent() {
  const { width } = useWindowSize()

  return (
    <div>
      {width < 768 ? <MobileView /> : <DesktopView />}
    </div>
  )
}
```

## When to Use Client Components

✅ **Use Client Components for:**

- **Interactivity**: Buttons, forms, interactive widgets
- **Event handlers**: onClick, onChange, onSubmit, etc.
- **State management**: useState, useReducer, context
- **Lifecycle effects**: useEffect, subscriptions, timers
- **Browser APIs**: localStorage, geolocation, clipboard
- **Custom hooks**: Reusable stateful logic
- **Third-party interactive libraries**: Charts, maps, rich text editors
- **Real-time features**: WebSockets, polling, live updates

❌ **Avoid Client Components for:**

- Static content that doesn't need interactivity
- Data fetching from backend services
- SEO-critical content that should be rendered on server
- Heavy computations that could run on server
- Accessing backend resources or databases

## Data Fetching in Client Components

While you can fetch data in Client Components, it's generally better to fetch in Server Components and pass data as props.

### ❌ Less Optimal: Fetching in Client Component

```tsx
'use client'

import { useState, useEffect } from 'react'

export default function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data)
        setLoading(false)
      })
  }, [userId])

  if (loading) return <div>Loading...</div>

  return <div>{user?.name}</div>
}
```

### ✅ Better: Fetch in Server Component, Pass to Client Component

```tsx
// app/users/[id]/page.tsx (Server Component)
import { UserProfile } from './user-profile'

export default async function Page({ params }: { params: { id: string } }) {
  const user = await fetchUser(params.id)

  return <UserProfile user={user} />
}

// user-profile.tsx (Client Component)
'use client'

export function UserProfile({ user }: { user: User }) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div>
      <h1>{user.name}</h1>
      <button onClick={() => setIsEditing(true)}>Edit</button>
      {isEditing && <EditForm user={user} />}
    </div>
  )
}
```

### When Client-Side Fetching Makes Sense

Client-side fetching is appropriate for:

```tsx
'use client'

import { useState } from 'react'

export default function SearchBox() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  // Client-side search as user types
  const handleSearch = async (value: string) => {
    setQuery(value)

    if (value.length > 2) {
      const res = await fetch(`/api/search?q=${value}`)
      const data = await res.json()
      setResults(data)
    }
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search..."
      />
      <SearchResults results={results} />
    </div>
  )
}
```

## Performance Implications

### Bundle Size Impact
All imports in a Client Component are included in the JavaScript bundle.

```tsx
'use client'

// ❌ These large libraries ship to the client
import _ from 'lodash' // ~70KB
import moment from 'moment' // ~300KB

export default function Component() {
  const formatted = moment().format('YYYY-MM-DD')
  const sorted = _.sortBy(data, 'name')

  return <div>{formatted}</div>
}
```

**Solution**: Use tree-shakable imports or lighter alternatives.

```tsx
'use client'

// ✅ Better - tree-shakable imports
import { sortBy } from 'lodash-es'
import { format } from 'date-fns' // Much smaller than moment

export default function Component() {
  const formatted = format(new Date(), 'yyyy-MM-dd')
  const sorted = sortBy(data, 'name')

  return <div>{formatted}</div>
}
```

### Hydration
Client Components require hydration - React must run on the client to make the component interactive.

```tsx
'use client'

export default function HeavyComponent() {
  // All this code must be sent to and executed by the browser
  const [state, setState] = useState(initialState)

  useEffect(() => {
    // Complex initialization
    const data = performExpensiveCalculation()
    setState(data)
  }, [])

  return <div>{state}</div>
}
```

**Optimization**: Move heavy computations to Server Components.

```tsx
// Server Component
export default async function Page() {
  // Expensive calculation happens on server
  const data = performExpensiveCalculation()

  // Only pass result to Client Component
  return <LightweightDisplay data={data} />
}

// Client Component - receives computed data
'use client'

export function LightweightDisplay({ data }: { data: any }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div>
      <button onClick={() => setIsExpanded(!isExpanded)}>
        Toggle
      </button>
      {isExpanded && <div>{data}</div>}
    </div>
  )
}
```

## Best Practices

### 1. Keep Client Components Small and Focused

```tsx
// ❌ Avoid - entire page is a Client Component
'use client'

export default function ProductPage({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)

  return (
    <div>
      <Header />
      <ProductImage src={product.image} />
      <ProductDetails product={product} />
      <Reviews reviews={product.reviews} />
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <AddToCartButton quantity={quantity} />
      <RelatedProducts products={product.related} />
      <Footer />
    </div>
  )
}

// ✅ Better - only interactive parts are Client Components
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetchProduct(params.id)

  return (
    <div>
      <Header />
      <ProductImage src={product.image} />
      <ProductDetails product={product} />
      <Reviews reviews={product.reviews} />
      {/* Only this component is client-side */}
      <QuantitySelector productId={product.id} />
      <RelatedProducts products={product.related} />
      <Footer />
    </div>
  )
}
```

### 2. Push 'use client' Down the Tree

Place the `'use client'` directive as deep as possible in your component tree.

```tsx
// ❌ Avoid - entire layout is client-side
'use client'

export default function Layout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')

  return (
    <div className={theme}>
      <Header />
      <Sidebar />
      {children}
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
      <Footer />
    </div>
  )
}

// ✅ Better - only theme toggle is client-side
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Header />
      <Sidebar />
      {children}
      <ThemeToggle />
      <Footer />
    </div>
  )
}

// theme-toggle.tsx
'use client'

export function ThemeToggle() {
  const [theme, setTheme] = useState('light')

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </button>
  )
}
```

### 3. Use Server Actions for Mutations

Instead of client-side API calls, use Server Actions.

```tsx
'use client'

import { useState } from 'react'
import { updateProfile } from './actions' // Server Action

export function ProfileForm({ user }: { user: User }) {
  const [name, setName] = useState(user.name)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Call Server Action instead of fetch
    await updateProfile({ name })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit">Save</button>
    </form>
  )
}
```

### 4. Minimize Client-Side Dependencies

```tsx
'use client'

// ❌ Avoid - importing entire library
import _ from 'lodash'

export function Component({ items }: { items: any[] }) {
  const sorted = _.sortBy(items, 'name')
  return <div>{sorted.map(item => <div key={item.id}>{item.name}</div>)}</div>
}

// ✅ Better - use native methods or specific imports
export function Component({ items }: { items: any[] }) {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
  return <div>{sorted.map(item => <div key={item.id}>{item.name}</div>)}</div>
}
```

### 5. Optimize Re-renders

```tsx
'use client'

import { memo, useCallback, useMemo } from 'react'

// Memoize expensive components
export const ExpensiveList = memo(function ExpensiveList({
  items
}: {
  items: any[]
}) {
  return (
    <ul>
      {items.map(item => <li key={item.id}>{item.name}</li>)}
    </ul>
  )
})

export function Parent() {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])

  // Memoize callback to prevent unnecessary re-renders
  const handleAddItem = useCallback((item: any) => {
    setItems(prev => [...prev, item])
  }, [])

  // Memoize expensive computations
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
      {/* ExpensiveList won't re-render when count changes */}
      <ExpensiveList items={sortedItems} />
      <AddItemForm onAdd={handleAddItem} />
    </div>
  )
}
```

## Common Patterns

### Form Handling
```tsx
'use client'

import { useState } from 'react'
import { createPost } from './actions'

export function CreatePostForm() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await createPost({ title, content })
      setTitle('')
      setContent('')
    } catch (error) {
      console.error('Failed to create post', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        disabled={isSubmitting}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content"
        disabled={isSubmitting}
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  )
}
```

### Modal Dialog
```tsx
'use client'

import { useState, useEffect } from 'react'

export function Modal({
  isOpen,
  onClose,
  children
}: {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
```

### Infinite Scroll
```tsx
'use client'

import { useState, useEffect, useRef } from 'react'

export function InfiniteList({
  initialItems
}: {
  initialItems: any[]
}) {
  const [items, setItems] = useState(initialItems)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const observerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore()
        }
      },
      { threshold: 1.0 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, page])

  const loadMore = async () => {
    const nextPage = page + 1
    const newItems = await fetchItems(nextPage)

    if (newItems.length === 0) {
      setHasMore(false)
    } else {
      setItems(prev => [...prev, ...newItems])
      setPage(nextPage)
    }
  }

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
      {hasMore && <div ref={observerRef}>Loading...</div>}
    </div>
  )
}
```

## Summary

Client Components enable interactivity and dynamic behavior in Next.js applications. Key principles:

- **Use sparingly**: Only when you need interactivity, state, or browser APIs
- **Keep small**: Push `'use client'` as deep as possible in the component tree
- **Optimize bundles**: Be mindful of what dependencies you import
- **Prefer Server Actions**: For mutations instead of client-side API calls
- **Pass data as props**: Fetch in Server Components, pass to Client Components

By following these patterns, you'll build interactive applications that remain performant and maintainable.
