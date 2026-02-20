# Server and Client Components

Understand the difference between Server and Client Components in Next.js App Router and when to use each.

## Overview

Next.js App Router introduces a new paradigm with Server Components as the default.

**Server Components:**
- Run on the server
- Can access backend resources directly
- Keep sensitive data secure
- Reduce client-side JavaScript
- No interactive features (useState, useEffect, etc.)

**Client Components:**
- Run in the browser
- Enable interactivity and event listeners
- Use React hooks (useState, useEffect, etc.)
- Access browser-only APIs
- Increase JavaScript bundle size

## Server Components (Default)

All components in the `app` directory are Server Components by default.

### Basic Server Component

```javascript
// app/page.js - Server Component by default
export default function Page() {
  return <h1>Server Component</h1>
}
```

### Async Server Component

```javascript
// app/posts/page.js
async function getPosts() {
  const res = await fetch('https://api.example.com/posts')
  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Direct Database Access

```javascript
// app/users/page.js
import { db } from '@/lib/database'

export default async function UsersPage() {
  const users = await db.user.findMany()

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

### Server Component Benefits

```javascript
// app/dashboard/page.js
import { headers } from 'next/headers'

export default async function Dashboard() {
  // Access environment variables (server-only)
  const apiKey = process.env.API_KEY

  // Access request headers
  const headersList = headers()
  const userAgent = headersList.get('user-agent')

  // Direct database query
  const data = await db.query('SELECT * FROM analytics')

  return (
    <div>
      <h1>Dashboard</h1>
      <p>User Agent: {userAgent}</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
```

## Client Components

Mark components with `'use client'` directive to make them Client Components.

### Basic Client Component

```javascript
// components/Counter.js
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  )
}
```

### Client Component with Effects

```javascript
// components/Theme.js
'use client'

import { useEffect, useState } from 'react'

export default function Theme() {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  function toggleTheme() {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <button onClick={toggleTheme}>
      Current: {theme}
    </button>
  )
}
```

### Client Component with Browser APIs

```javascript
// components/WindowSize.js
'use client'

import { useState, useEffect } from 'react'

export default function WindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    function handleResize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return <p>Window size: {size.width} x {size.height}</p>
}
```

## When to Use Server vs Client Components

### Use Server Components for:

- Fetching data
- Accessing backend resources
- Keeping sensitive information secure (API keys, tokens)
- Reducing client-side JavaScript
- SEO-critical content

### Use Client Components for:

- Interactive elements (onClick, onChange)
- State management (useState, useReducer)
- Effects (useEffect)
- Browser-only APIs (localStorage, window)
- Event listeners
- Custom hooks that use React hooks
- Third-party libraries that use browser APIs

## Component Composition Patterns

### Server Component with Client Children

```javascript
// app/page.js (Server Component)
import ClientButton from '@/components/ClientButton'

export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <h1>Server Component</h1>
      <p>Data: {data.value}</p>
      {/* Client Component for interactivity */}
      <ClientButton />
    </div>
  )
}

// components/ClientButton.js
'use client'

export default function ClientButton() {
  return <button onClick={() => alert('Clicked!')}>Click Me</button>
}
```

### Passing Server Component as Children to Client Component

```javascript
// components/ClientWrapper.js
'use client'

export default function ClientWrapper({ children }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && children}
    </div>
  )
}

// app/page.js (Server Component)
import ClientWrapper from '@/components/ClientWrapper'

export default async function Page() {
  const data = await fetchData()

  return (
    <ClientWrapper>
      {/* This remains a Server Component */}
      <ServerComponent data={data} />
    </ClientWrapper>
  )
}
```

### Passing Server Data to Client Components

```javascript
// app/products/page.js (Server)
import ProductList from '@/components/ProductList'

export default async function ProductsPage() {
  const products = await fetchProducts()

  // Pass data as props to Client Component
  return <ProductList products={products} />
}

// components/ProductList.js (Client)
'use client'

import { useState } from 'react'

export default function ProductList({ products }) {
  const [filter, setFilter] = useState('')

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter products..."
      />
      <ul>
        {filtered.map(product => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Mixing Server and Client Components

### Recommended Pattern: Server Wrapper, Client Content

```javascript
// app/dashboard/page.js (Server)
import ClientDashboard from '@/components/ClientDashboard'

export default async function DashboardPage() {
  const [user, stats, notifications] = await Promise.all([
    fetchUser(),
    fetchStats(),
    fetchNotifications(),
  ])

  return (
    <ClientDashboard
      user={user}
      stats={stats}
      notifications={notifications}
    />
  )
}

// components/ClientDashboard.js (Client)
'use client'

import { useState } from 'react'

export default function ClientDashboard({ user, stats, notifications }) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div>
      <nav>
        <button onClick={() => setActiveTab('overview')}>Overview</button>
        <button onClick={() => setActiveTab('stats')}>Stats</button>
      </nav>

      {activeTab === 'overview' && <Overview user={user} />}
      {activeTab === 'stats' && <Stats data={stats} />}
    </div>
  )
}
```

### Anti-Pattern: Client Wrapper Around Server Content

```javascript
// ❌ BAD: Don't do this
'use client'

export default function ClientWrapper() {
  const [isOpen, setIsOpen] = useState(true)

  // This won't work - can't use async/await in Client Components
  const data = await fetchData() // Error!

  return <div>{data}</div>
}

// ✅ GOOD: Do this instead
// Server Component (app/page.js)
export default async function Page() {
  const data = await fetchData()
  return <ClientWrapper data={data} />
}

// Client Component
'use client'
export default function ClientWrapper({ data }) {
  const [isOpen, setIsOpen] = useState(true)
  return <div>{data}</div>
}
```

## Context Providers

Context Providers must be Client Components:

```javascript
// providers/ThemeProvider.js
'use client'

import { createContext, useState, useContext } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// app/layout.js (Server Component)
import { ThemeProvider } from '@/providers/ThemeProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

## Third-Party Libraries

### Client-Only Libraries

```javascript
// components/Map.js
'use client'

import { MapContainer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export default function Map() {
  return (
    <MapContainer center={[51.505, -0.09]} zoom={13}>
      {/* Map content */}
    </MapContainer>
  )
}
```

### Libraries Compatible with Server Components

```javascript
// app/page.js (Server Component)
import { format } from 'date-fns' // Works in Server Components

export default function Page() {
  const formattedDate = format(new Date(), 'MMMM dd, yyyy')

  return <p>Date: {formattedDate}</p>
}
```

## Performance Optimization

### Minimize Client Components

```javascript
// ❌ BAD: Entire component is client-side
'use client'

export default function Page() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h1>Static Title</h1>
      <p>Static content</p>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

// ✅ GOOD: Only interactive part is client-side
// app/page.js (Server)
import Counter from '@/components/Counter'

export default function Page() {
  return (
    <div>
      <h1>Static Title</h1>
      <p>Static content</p>
      <Counter />
    </div>
  )
}

// components/Counter.js (Client)
'use client'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

## Best Practices

1. **Use Server Components by default** - Only use Client Components when needed
2. **Move Client Components down the tree** - Keep as much as possible on the server
3. **Pass data from Server to Client** - Don't fetch in Client Components unnecessarily
4. **Compose Server and Client** - Use children prop to pass Server Components to Client
5. **Extract interactive elements** - Create small Client Components for interactivity
6. **Use Context wisely** - Providers must be Client Components
7. **Optimize bundle size** - Minimize client-side JavaScript

## Common Pitfalls

1. **Using 'use client' too early** - Marking parent components as client unnecessarily
2. **Fetching data in Client Components** - Should fetch in Server Components when possible
3. **Not serializing props** - Can't pass functions or class instances to Client Components
4. **Importing server-only code in Client** - Keep server-only imports separate
5. **Over-using Client Components** - Increases bundle size and reduces performance
6. **Forgetting 'use client'** - Using hooks without the directive
7. **Async Client Components** - Can't use async/await in Client Components

## Decision Tree

```
Need interactivity (onClick, onChange, etc.)?
├─ Yes → Client Component
└─ No
    └─ Need React hooks (useState, useEffect)?
        ├─ Yes → Client Component
        └─ No
            └─ Need browser APIs (window, localStorage)?
                ├─ Yes → Client Component
                └─ No → Server Component (default)
```

## Checklist

- [ ] Use Server Components by default
- [ ] Add 'use client' only when necessary
- [ ] Fetch data in Server Components
- [ ] Pass server data to Client Components as props
- [ ] Keep Client Components small and focused
- [ ] Use composition to mix Server and Client
- [ ] Understand serialization limitations
- [ ] Optimize for minimal client JavaScript
