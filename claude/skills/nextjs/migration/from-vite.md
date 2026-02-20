# Migrating from Vite to Next.js

This guide provides a comprehensive process for migrating a Vite React application to Next.js.

## Prerequisites

- Existing Vite React application
- Node.js 18.17 or later
- Understanding of React and Vite

## Key Differences Between Vite and Next.js

| Feature | Vite | Next.js |
|---------|------|---------|
| **Primary Focus** | Fast dev server, build tool | Full-stack React framework |
| **Routing** | Requires React Router | File-based routing built-in |
| **SSR** | Requires manual setup | Built-in SSR and SSG |
| **API Routes** | Requires separate backend | Built-in API routes |
| **Build Tool** | Vite (Rollup) | Turbopack/Webpack |
| **Hot Reload** | HMR | Fast Refresh |
| **Config** | vite.config.js | next.config.js |

## Migration Steps

### Step 1: Install Next.js

```bash
# Install Next.js dependencies
npm install next@latest react@latest react-dom@latest

# Or with pnpm (if using pnpm with Vite)
pnpm add next react react-dom
```

### Step 2: Update package.json

**Before (Vite)**:
```json
{
  "name": "vite-app",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

**After (Next.js)**:
```json
{
  "name": "nextjs-app",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  }
}
```

### Step 3: Create Next.js Configuration

Create `next.config.js` or `next.config.ts`:

**next.config.ts**:
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // If you were using environment variables
  env: {
    // Custom env vars
  },
}

export default nextConfig
```

### Step 4: Restructure Project Directory

**Before (Vite structure)**:
```
vite-app/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   ├── pages/
│   └── assets/
├── public/
├── index.html
└── vite.config.ts
```

**After (Next.js structure)**:
```
nextjs-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── components/
├── public/
└── next.config.ts
```

### Step 5: Convert Entry Point

**Before (Vite - src/main.tsx)**:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**After (Next.js - app/layout.tsx)**:
```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My App',
  description: 'Migrated from Vite',
}

export default function RootLayout({
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

**app/page.tsx**:
```typescript
export default function Home() {
  return (
    <main>
      <h1>Welcome to Next.js</h1>
    </main>
  )
}
```

### Step 6: Convert Vite Plugins to Next.js Equivalents

#### React Plugin

**Vite**:
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**Next.js**: React support is built-in, no plugin needed.

#### Path Aliases

**Vite (vite.config.ts)**:
```typescript
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
    },
  },
})
```

**Next.js (tsconfig.json or jsconfig.json)**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@components/*": ["./app/components/*"]
    }
  }
}
```

#### Environment Variables

**Vite (.env)**:
```bash
VITE_API_URL=https://api.example.com
VITE_API_KEY=your-key
```

**Vite usage**:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

**Next.js (.env.local)**:
```bash
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_API_KEY=your-key
```

**Next.js usage**:
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

### Step 7: Convert Routing

#### Basic Routes

**Vite with React Router**:
```typescript
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Blog from './pages/Blog'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Next.js (File-based routing)**:
```
app/
├── page.tsx          (/)
├── about/
│   └── page.tsx      (/about)
└── blog/
    └── page.tsx      (/blog)
```

#### Dynamic Routes

**Vite with React Router**:
```typescript
<Route path="/blog/:slug" element={<BlogPost />} />

// In BlogPost component
import { useParams } from 'react-router-dom'

function BlogPost() {
  const { slug } = useParams()
  return <h1>Post: {slug}</h1>
}
```

**Next.js**:

Create `app/blog/[slug]/page.tsx`:
```typescript
export default function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  return <h1>Post: {params.slug}</h1>
}
```

#### Nested Routes

**Vite**:
```typescript
<Route path="/dashboard" element={<DashboardLayout />}>
  <Route index element={<DashboardHome />} />
  <Route path="settings" element={<Settings />} />
  <Route path="profile" element={<Profile />} />
</Route>
```

**Next.js**:
```
app/
└── dashboard/
    ├── layout.tsx    (DashboardLayout)
    ├── page.tsx      (DashboardHome)
    ├── settings/
    │   └── page.tsx
    └── profile/
        └── page.tsx
```

**app/dashboard/layout.tsx**:
```typescript
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard">
      <nav>{/* Dashboard nav */}</nav>
      <main>{children}</main>
    </div>
  )
}
```

#### Navigation

**Vite (React Router)**:
```typescript
import { Link, useNavigate } from 'react-router-dom'

function Navigation() {
  const navigate = useNavigate()

  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      <button onClick={() => navigate('/contact')}>
        Contact
      </button>
    </nav>
  )
}
```

**Next.js**:
```typescript
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function Navigation() {
  const router = useRouter()

  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <button onClick={() => router.push('/contact')}>
        Contact
      </button>
    </nav>
  )
}
```

### Step 8: Convert Static Assets

**Vite**: Assets can be imported directly or placed in `public/`

```typescript
// Importing asset
import logo from './assets/logo.png'

function Logo() {
  return <img src={logo} alt="Logo" />
}

// Public folder
<img src="/favicon.ico" alt="Icon" />
```

**Next.js**: Use next/image for optimization

```typescript
import Image from 'next/image'
import logo from './assets/logo.png'

export function Logo() {
  return (
    <Image
      src={logo}
      alt="Logo"
      width={200}
      height={100}
      placeholder="blur" // Automatic blur placeholder
    />
  )
}

// For public folder assets
<Image
  src="/favicon.ico"
  alt="Icon"
  width={32}
  height={32}
/>
```

### Step 9: Convert CSS and Styling

#### Global CSS

**Vite (src/main.tsx)**:
```typescript
import './index.css'
```

**Next.js (app/layout.tsx)**:
```typescript
import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

#### CSS Modules

Works the same in both:

```typescript
import styles from './Component.module.css'

export function Component() {
  return <div className={styles.container}>Content</div>
}
```

#### Tailwind CSS

**Vite (tailwind.config.js)**:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Next.js (tailwind.config.ts)**:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

#### CSS-in-JS (styled-components)

**Vite**: Works out of the box

**Next.js**: Requires registry setup (see from-cra.md for detailed setup)

### Step 10: Convert Data Fetching

#### Client-Side Fetching

**Vite**:
```typescript
import { useState, useEffect } from 'react'

function Posts() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('https://api.example.com/posts')
      .then(res => res.json())
      .then(data => {
        setPosts(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading...</div>

  return <div>{/* render posts */}</div>
}
```

**Next.js (Client Component)**:
```typescript
'use client'

import { useState, useEffect } from 'react'

export default function Posts() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('https://api.example.com/posts')
      .then(res => res.json())
      .then(data => {
        setPosts(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading...</div>

  return <div>{/* render posts */}</div>
}
```

#### Server-Side Fetching (New Capability)

**Next.js Server Component**:
```typescript
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 } // Cache for 1 hour
  })
  return res.json()
}

export default async function Posts() {
  const posts = await getPosts()

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>{post.title}</article>
      ))}
    </div>
  )
}
```

### Step 11: Convert API Routes

**Vite**: Requires separate backend server

```typescript
// Typical setup: separate Express server
// server.js
import express from 'express'

const app = express()

app.get('/api/posts', async (req, res) => {
  const posts = await getPosts()
  res.json(posts)
})

app.listen(3001)
```

**Next.js**: Built-in API routes

Create `app/api/posts/route.ts`:
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const posts = await getPosts()
  return NextResponse.json(posts)
}

export async function POST(request: Request) {
  const body = await request.json()
  const newPost = await createPost(body)
  return NextResponse.json(newPost, { status: 201 })
}
```

### Step 12: Convert HTML Template

**Vite (index.html)**:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Next.js (app/layout.tsx with metadata)**:
```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Next.js App',
  description: 'Migrated from Vite',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Next.js automatically injects metadata */}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Step 13: Convert Build Configuration

#### Output Directory

**Vite (vite.config.ts)**:
```typescript
export default defineConfig({
  build: {
    outDir: 'dist',
  },
})
```

**Next.js (next.config.ts)**:
```typescript
const nextConfig = {
  distDir: '.next', // Default, usually not changed
}
```

#### Public Base Path

**Vite**:
```typescript
export default defineConfig({
  base: '/my-app/',
})
```

**Next.js**:
```typescript
const nextConfig = {
  basePath: '/my-app',
}
```

#### Port Configuration

**Vite**:
```typescript
export default defineConfig({
  server: {
    port: 3000,
  },
})
```

**Next.js**: Use environment variable or CLI flag
```bash
# .env
PORT=3000

# Or in package.json
"dev": "next dev -p 3000"
```

### Step 14: Handle Vite-Specific Features

#### Import.meta.glob

**Vite**:
```typescript
const modules = import.meta.glob('./components/*.tsx')
```

**Next.js**: Use dynamic imports or Node.js fs for server components
```typescript
// Client Component
'use client'

const LazyComponent = dynamic(() => import('./Component'))

// Server Component
import fs from 'fs'
import path from 'path'

const files = fs.readdirSync(path.join(process.cwd(), 'components'))
```

#### Fast Refresh vs HMR

Both support hot reloading, but Next.js uses Fast Refresh which preserves component state better. No configuration needed.

### Step 15: Remove Vite Dependencies

```bash
# Remove Vite
npm uninstall vite @vitejs/plugin-react

# Remove React Router if migrated to file-based routing
npm uninstall react-router-dom

# Remove Vite-specific files
rm vite.config.ts
rm index.html

# Remove old source directory if fully migrated
rm -rf src/
```

## Common Migration Issues

### Issue 1: Import.meta Not Available

**Problem**: Code using `import.meta.env` breaks

**Solution**: Replace with `process.env`
```typescript
// Before (Vite)
const apiUrl = import.meta.env.VITE_API_URL

// After (Next.js)
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

### Issue 2: SVG Imports

**Vite**: SVGs can be imported as React components with plugin

**Next.js**: Use SVGR or import as URL

Install SVGR:
```bash
npm install @svgr/webpack
```

Configure in `next.config.js`:
```javascript
module.exports = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })
    return config
  },
}
```

Usage:
```typescript
import Logo from './logo.svg'

export default function Header() {
  return <Logo />
}
```

### Issue 3: Top-Level Await

**Vite**: Supports top-level await in modules

**Next.js**: Use async Server Components instead
```typescript
// Server Component
export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

### Issue 4: Client-Side Only Code

**Problem**: Code assumes it always runs in browser

**Solution**: Use 'use client' or check for window
```typescript
'use client'

export default function Component() {
  // Safe to use browser APIs
  const width = window.innerWidth
}
```

## Performance Benefits After Migration

1. **Automatic Code Splitting**: Per-route automatic splitting
2. **Server Components**: Reduce client bundle size
3. **Image Optimization**: Automatic with next/image
4. **Font Optimization**: With next/font
5. **Static Generation**: Build pages at build time
6. **Incremental Static Regeneration**: Update static pages without rebuild
7. **API Routes**: No separate backend server needed

## Testing the Migration

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Check bundle size
npm run build
# Look for .next/analyze output
```

## Next Steps

1. Convert client components to server components where possible
2. Implement ISR for frequently updated content
3. Add metadata for better SEO
4. Use Server Actions for form submissions
5. Implement streaming with Suspense
6. Add Route Handlers for API endpoints
7. Consider using Partial Prerendering (PPR) when stable

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Vite to Next.js Comparison](https://nextjs.org/docs/architecture/nextjs-compiler)
- [Server Components Guide](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
