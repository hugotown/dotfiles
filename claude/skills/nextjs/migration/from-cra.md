# Migrating from Create React App to Next.js

This guide provides a comprehensive, step-by-step process for migrating a Create React App (CRA) application to Next.js.

## Prerequisites

- Existing CRA application
- Node.js 18.17 or later
- Understanding of React fundamentals

## Migration Overview

The migration can be done incrementally:

1. **Setup Phase**: Install Next.js and configure
2. **Routing Phase**: Convert React Router to Next.js routing
3. **Assets Phase**: Move public assets and update imports
4. **Dependencies Phase**: Update and configure dependencies
5. **Testing Phase**: Verify functionality and performance

## Step 1: Install Next.js

```bash
# Install Next.js dependencies
npm install next@latest react@latest react-dom@latest

# Or with yarn
yarn add next react react-dom
```

## Step 2: Update package.json Scripts

### Before (CRA):
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

### After (Next.js):
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

## Step 3: Create Next.js Configuration

Create `next.config.js` in your project root:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // If using CSS modules from CRA
  webpack: (config) => {
    return config;
  },
}

module.exports = nextConfig
```

For TypeScript, create `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
```

## Step 4: Create Directory Structure

```bash
# Create Next.js directories
mkdir -p app
mkdir -p public
```

Next.js uses the App Router by default. Your structure should look like:

```
my-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── public/
│   └── (static assets)
├── next.config.js
└── package.json
```

## Step 5: Create Root Layout

Create `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My App',
  description: 'Migrated from Create React App',
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

## Step 6: Convert App.js/tsx to page.tsx

### Before (CRA - src/App.tsx):
```typescript
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to My App</h1>
      </header>
    </div>
  );
}

export default App;
```

### After (Next.js - app/page.tsx):
```typescript
export default function Home() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to My App</h1>
      </header>
    </div>
  )
}
```

## Step 7: Convert React Router to Next.js Routing

### Before (CRA with React Router):
```typescript
// App.tsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### After (Next.js - File-based Routing):

```
app/
├── layout.tsx (with navigation)
├── page.tsx (Home)
├── about/
│   └── page.tsx
└── contact/
    └── page.tsx
```

**app/layout.tsx** with navigation:
```typescript
import Link from 'next/link'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
```

**app/about/page.tsx**:
```typescript
export default function About() {
  return <h1>About Page</h1>
}
```

## Step 8: Convert Dynamic Routes

### Before (React Router):
```typescript
<Route path="/blog/:slug" element={<BlogPost />} />

// In BlogPost component
import { useParams } from 'react-router-dom';

function BlogPost() {
  const { slug } = useParams();
  // ...
}
```

### After (Next.js):

Create `app/blog/[slug]/page.tsx`:
```typescript
export default function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params

  return <h1>Blog Post: {slug}</h1>
}
```

## Step 9: Move Public Assets

Move files from `public/` in CRA to `public/` in Next.js:

```bash
# CRA structure
public/
├── index.html
├── favicon.ico
├── logo192.png
└── manifest.json

# Next.js structure (remove index.html, keep others)
public/
├── favicon.ico
├── logo192.png
└── manifest.json
```

### Update Asset References

**Before (CRA)**:
```html
<!-- In public/index.html -->
<link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
```

**After (Next.js - in app/layout.tsx)**:
```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
  description: 'My App Description',
  icons: {
    icon: '/favicon.ico',
  },
}
```

## Step 10: Convert Environment Variables

### Before (CRA):
```bash
# .env
REACT_APP_API_URL=https://api.example.com
REACT_APP_API_KEY=your-key
```

```typescript
const apiUrl = process.env.REACT_APP_API_URL;
```

### After (Next.js):
```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_API_KEY=your-key

# Server-side only (no NEXT_PUBLIC_ prefix)
API_SECRET=secret-key
```

```typescript
// Client-side
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Server-side (in Server Components or API routes)
const apiSecret = process.env.API_SECRET;
```

## Step 11: Handle CSS and Styling

### CSS Modules (works in both):
```typescript
// styles.module.css remains the same
import styles from './styles.module.css'

export default function Component() {
  return <div className={styles.container}>Content</div>
}
```

### Global CSS:
Move global CSS to `app/globals.css` and import in `app/layout.tsx`:

```typescript
import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### CSS-in-JS (styled-components, emotion):
For styled-components, create `lib/registry.tsx`:

```typescript
'use client'

import React, { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { ServerStyleSheet, StyleSheetManager } from 'styled-components'

export default function StyledComponentsRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet())

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleElement()
    styledComponentsStyleSheet.instance.clearTag()
    return <>{styles}</>
  })

  if (typeof window !== 'undefined') return <>{children}</>

  return (
    <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
      {children}
    </StyleSheetManager>
  )
}
```

Then wrap in `app/layout.tsx`:

```typescript
import StyledComponentsRegistry from './lib/registry'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <body>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  )
}
```

## Step 12: Convert Data Fetching

### Before (CRA with useEffect):
```typescript
import { useState, useEffect } from 'react';

function Posts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://api.example.com/posts')
      .then(res => res.json())
      .then(data => {
        setPosts(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

### After (Next.js Server Component):
```typescript
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    // Optional: Configure caching
    next: { revalidate: 3600 } // Revalidate every hour
  })

  if (!res.ok) {
    throw new Error('Failed to fetch posts')
  }

  return res.json()
}

export default async function Posts() {
  const posts = await getPosts()

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}
```

### For Client-Side Data Fetching:
```typescript
'use client'

import { useState, useEffect } from 'react'

export default function ClientPosts() {
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

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}
```

## Step 13: Handle Images

### Before (CRA):
```typescript
import logo from './logo.png';

function Header() {
  return <img src={logo} alt="Logo" />;
}
```

### After (Next.js):
```typescript
import Image from 'next/image'
import logo from './logo.png'

function Header() {
  return (
    <Image
      src={logo}
      alt="Logo"
      width={500}
      height={300}
      // Optional optimizations
      placeholder="blur"
      priority // For above-fold images
    />
  )
}
```

For external images, configure in `next.config.js`:

```javascript
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
        port: '',
        pathname: '/images/**',
      },
    ],
  },
}
```

## Step 14: Update Meta Tags and SEO

### Before (CRA - public/index.html):
```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="My app description" />
  <title>My App</title>
</head>
```

### After (Next.js - app/layout.tsx):
```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
  description: 'My app description',
  viewport: 'width=device-width, initial-scale=1',
}
```

For dynamic metadata per page:

```typescript
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  return {
    title: `Blog Post: ${params.slug}`,
    description: `Read about ${params.slug}`,
  }
}
```

## Step 15: Clean Up and Remove CRA Dependencies

```bash
# Remove CRA dependencies
npm uninstall react-scripts

# Remove CRA files
rm -rf src/index.js src/index.tsx
rm public/index.html

# Remove CRA-specific files
rm -rf build/
```

## Common Issues and Solutions

### Issue 1: "document is not defined"

**Problem**: Code tries to access browser APIs on the server.

**Solution**: Use 'use client' directive or check for window:

```typescript
'use client'

export default function Component() {
  // Now runs only on client
  const width = window.innerWidth
}
```

Or:

```typescript
export default function Component() {
  const width = typeof window !== 'undefined' ? window.innerWidth : 0
}
```

### Issue 2: React Context Not Working

**Problem**: Context providers need 'use client'.

**Solution**:

```typescript
'use client'

import { createContext, useContext } from 'react'

const MyContext = createContext(null)

export function MyProvider({ children }) {
  return (
    <MyContext.Provider value={/* ... */}>
      {children}
    </MyContext.Provider>
  )
}
```

### Issue 3: CSS Import Order

**Problem**: Styles not applying correctly.

**Solution**: Import global CSS only in `app/layout.tsx`, component CSS in components.

### Issue 4: Absolute Imports

**Before (CRA - jsconfig.json)**:
```json
{
  "compilerOptions": {
    "baseUrl": "src"
  }
}
```

**After (Next.js - tsconfig.json)**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Then import as:
```typescript
import Component from '@/app/components/Component'
```

## Testing Your Migration

1. **Start the development server**:
```bash
npm run dev
```

2. **Test all routes**: Navigate through your application

3. **Check console**: Look for hydration errors or warnings

4. **Test data fetching**: Verify API calls work correctly

5. **Test forms and interactions**: Ensure client-side functionality works

6. **Build and test production**:
```bash
npm run build
npm start
```

## Performance Improvements After Migration

Next.js provides several automatic optimizations:

1. **Automatic Code Splitting**: Each route is automatically code-split
2. **Image Optimization**: Using next/image component
3. **Font Optimization**: Using next/font
4. **Server Components**: Reduce client-side JavaScript
5. **Streaming**: Progressive rendering with React Suspense

## Next Steps

After migration:

1. Consider using Server Components for better performance
2. Implement Incremental Static Regeneration (ISR) for static content
3. Use Route Handlers for API endpoints
4. Optimize images with next/image
5. Add metadata for better SEO
6. Consider implementing Parallel Routes or Intercepting Routes for advanced UI patterns

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js Examples](https://github.com/vercel/next.js/tree/canary/examples)
- [App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
