# Migrating from Pages Router to App Router

This comprehensive guide walks you through migrating a Next.js application from the Pages Router to the App Router.

## Why Migrate to App Router?

The App Router (introduced in Next.js 13) provides:

- **React Server Components**: Reduce client-side JavaScript
- **Streaming**: Progressive rendering with Suspense
- **Improved Layouts**: Shared UI that doesn't re-render
- **Server Actions**: Mutations without API routes
- **Better Data Fetching**: Async components with native fetch
- **Improved SEO**: Better metadata API
- **Nested Routing**: More flexible routing patterns

## Migration Strategy

You can migrate incrementally:

1. **Incremental Adoption**: Both routers can coexist
2. **Route by Route**: Migrate one page at a time
3. **Test Thoroughly**: Ensure each route works before moving to the next

## Directory Structure Comparison

### Pages Router
```
pages/
├── _app.tsx
├── _document.tsx
├── index.tsx
├── about.tsx
├── blog/
│   ├── index.tsx
│   └── [slug].tsx
└── api/
    └── posts.ts
```

### App Router
```
app/
├── layout.tsx      (_app + _document)
├── page.tsx        (index)
├── about/
│   └── page.tsx
├── blog/
│   ├── page.tsx
│   └── [slug]/
│       └── page.tsx
└── api/
    └── posts/
        └── route.ts
```

## Step-by-Step Migration Guide

### Step 1: Create the App Directory

```bash
mkdir app
```

Both `app/` and `pages/` can coexist during migration. App Router takes precedence.

### Step 2: Create Root Layout

The root layout replaces `_app.tsx` and `_document.tsx`.

**Before (Pages Router - pages/_app.tsx)**:
```typescript
import type { AppProps } from 'next/app'
import '../styles/globals.css'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="app-wrapper">
      <Component {...pageProps} />
    </div>
  )
}
```

**Before (Pages Router - pages/_document.tsx)**:
```typescript
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
```

**After (App Router - app/layout.tsx)**:
```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My App',
  description: 'My application',
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
      <body>
        <div className="app-wrapper">
          {children}
        </div>
      </body>
    </html>
  )
}
```

### Step 3: Migrate Home Page

**Before (pages/index.tsx)**:
```typescript
import Head from 'next/head'
import { GetServerSideProps } from 'next'

interface HomeProps {
  data: any
}

export default function Home({ data }: HomeProps) {
  return (
    <>
      <Head>
        <title>Home</title>
        <meta name="description" content="Home page" />
      </Head>
      <main>
        <h1>Welcome</h1>
        <p>{data.message}</p>
      </main>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  const res = await fetch('https://api.example.com/data')
  const data = await res.json()

  return {
    props: { data },
  }
}
```

**After (app/page.tsx)**:
```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home',
  description: 'Home page',
}

async function getData() {
  const res = await fetch('https://api.example.com/data', {
    // Optional: Configure caching
    next: { revalidate: 3600 }
  })

  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
}

export default async function Home() {
  const data = await getData()

  return (
    <main>
      <h1>Welcome</h1>
      <p>{data.message}</p>
    </main>
  )
}
```

### Step 4: Migrate Static Pages

**Before (pages/about.tsx)**:
```typescript
import Head from 'next/head'

export default function About() {
  return (
    <>
      <Head>
        <title>About</title>
      </Head>
      <div>
        <h1>About Us</h1>
      </div>
    </>
  )
}
```

**After (app/about/page.tsx)**:
```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
}

export default function About() {
  return (
    <div>
      <h1>About Us</h1>
    </div>
  )
}
```

### Step 5: Migrate Dynamic Routes

**Before (pages/blog/[slug].tsx)**:
```typescript
import { GetStaticPaths, GetStaticProps } from 'next'

interface Post {
  slug: string
  title: string
  content: string
}

interface BlogPostProps {
  post: Post
}

export default function BlogPost({ post }: BlogPostProps) {
  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const res = await fetch('https://api.example.com/posts')
  const posts = await res.json()

  const paths = posts.map((post: Post) => ({
    params: { slug: post.slug },
  }))

  return {
    paths,
    fallback: 'blocking',
  }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const res = await fetch(`https://api.example.com/posts/${params?.slug}`)
  const post = await res.json()

  return {
    props: { post },
    revalidate: 60,
  }
}
```

**After (app/blog/[slug]/page.tsx)**:
```typescript
import { notFound } from 'next/navigation'

interface Post {
  slug: string
  title: string
  content: string
}

async function getPost(slug: string): Promise<Post | null> {
  const res = await fetch(`https://api.example.com/posts/${slug}`, {
    next: { revalidate: 60 } // Equivalent to revalidate in getStaticProps
  })

  if (!res.ok) {
    return null
  }

  return res.json()
}

export async function generateStaticParams() {
  const res = await fetch('https://api.example.com/posts')
  const posts = await res.json()

  return posts.map((post: Post) => ({
    slug: post.slug,
  }))
}

export default async function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound()
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

### Step 6: Migrate Layouts

**Before (Pages Router - Custom Layout Pattern)**:
```typescript
// components/DashboardLayout.tsx
import { ReactNode } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard">
      <nav>
        <a href="/dashboard">Home</a>
        <a href="/dashboard/settings">Settings</a>
      </nav>
      <main>{children}</main>
    </div>
  )
}

// pages/dashboard/index.tsx
import DashboardLayout from '../../components/DashboardLayout'

export default function Dashboard() {
  return (
    <DashboardLayout>
      <h1>Dashboard</h1>
    </DashboardLayout>
  )
}

// pages/dashboard/settings.tsx
import DashboardLayout from '../../components/DashboardLayout'

export default function Settings() {
  return (
    <DashboardLayout>
      <h1>Settings</h1>
    </DashboardLayout>
  )
}
```

**After (App Router - Nested Layouts)**:
```
app/
└── dashboard/
    ├── layout.tsx
    ├── page.tsx
    └── settings/
        └── page.tsx
```

**app/dashboard/layout.tsx**:
```typescript
import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard">
      <nav>
        <Link href="/dashboard">Home</Link>
        <Link href="/dashboard/settings">Settings</Link>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

**app/dashboard/page.tsx**:
```typescript
export default function Dashboard() {
  return <h1>Dashboard</h1>
}
```

**app/dashboard/settings/page.tsx**:
```typescript
export default function Settings() {
  return <h1>Settings</h1>
}
```

### Step 7: Migrate Data Fetching Methods

#### getServerSideProps → Server Component

**Before**:
```typescript
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { req, res, params, query } = context

  // Set cache headers
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=59')

  const data = await fetch(`https://api.example.com/data/${params?.id}`)
  const result = await data.json()

  return {
    props: { result },
  }
}
```

**After**:
```typescript
async function getData(id: string) {
  const res = await fetch(`https://api.example.com/data/${id}`, {
    next: { revalidate: 10 } // Cache for 10 seconds
  })

  if (!res.ok) {
    throw new Error('Failed to fetch')
  }

  return res.json()
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const data = await getData(params.id)

  return <div>{/* render data */}</div>
}
```

#### getStaticProps → Server Component with Caching

**Before**:
```typescript
export const getStaticProps: GetStaticProps = async () => {
  const data = await fetchData()

  return {
    props: { data },
    revalidate: 60, // ISR: regenerate every 60 seconds
  }
}
```

**After**:
```typescript
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 } // ISR equivalent
  })

  return res.json()
}

export default async function Page() {
  const data = await getData()

  return <div>{/* render data */}</div>
}
```

#### getStaticPaths → generateStaticParams

**Before**:
```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getAllPosts()

  return {
    paths: posts.map(post => ({
      params: { slug: post.slug }
    })),
    fallback: 'blocking',
  }
}
```

**After**:
```typescript
export async function generateStaticParams() {
  const posts = await getAllPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

// Fallback behavior
export const dynamicParams = true // true = 'blocking', false = 404 for unknown params
```

### Step 8: Migrate Client-Side Features

#### Client Components

Any component using hooks, event handlers, or browser APIs needs 'use client'.

**Before (Pages Router - Automatic client-side)**:
```typescript
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

**After (App Router - Explicit client directive)**:
```typescript
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

#### useRouter Migration

**Before (Pages Router)**:
```typescript
import { useRouter } from 'next/router'

export default function Page() {
  const router = useRouter()
  const { id } = router.query

  const navigate = () => {
    router.push('/other-page')
  }

  return <button onClick={navigate}>Go</button>
}
```

**After (App Router)**:
```typescript
'use client'

import { useRouter, useParams, useSearchParams } from 'next/navigation'

export default function Page() {
  const router = useRouter()
  const params = useParams() // Dynamic route params
  const searchParams = useSearchParams() // Query params

  const id = params.id

  const navigate = () => {
    router.push('/other-page')
  }

  return <button onClick={navigate}>Go</button>
}
```

### Step 9: Migrate API Routes

**Before (pages/api/posts.ts)**:
```typescript
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const posts = await getPosts()
    res.status(200).json(posts)
  } else if (req.method === 'POST') {
    const newPost = await createPost(req.body)
    res.status(201).json(newPost)
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
```

**After (app/api/posts/route.ts)**:
```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const posts = await getPosts()
  return NextResponse.json(posts)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newPost = await createPost(body)
  return NextResponse.json(newPost, { status: 201 })
}
```

#### Dynamic API Routes

**Before (pages/api/posts/[id].ts)**:
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  if (req.method === 'GET') {
    const post = await getPost(id as string)
    res.status(200).json(post)
  }
}
```

**After (app/api/posts/[id]/route.ts)**:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const post = await getPost(params.id)
  return NextResponse.json(post)
}
```

### Step 10: Migrate Metadata

**Before (Pages Router - using Head)**:
```typescript
import Head from 'next/head'

export default function Page() {
  return (
    <>
      <Head>
        <title>My Page</title>
        <meta name="description" content="Page description" />
        <meta property="og:title" content="My Page" />
        <meta property="og:image" content="/og-image.jpg" />
      </Head>
      <div>Content</div>
    </>
  )
}
```

**After (App Router - Metadata API)**:
```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Page',
  description: 'Page description',
  openGraph: {
    title: 'My Page',
    images: ['/og-image.jpg'],
  },
}

export default function Page() {
  return <div>Content</div>
}
```

#### Dynamic Metadata

**Before**:
```typescript
import Head from 'next/head'

export default function Post({ post }) {
  return (
    <>
      <Head>
        <title>{post.title}</title>
        <meta name="description" content={post.excerpt} />
      </Head>
      <article>{post.content}</article>
    </>
  )
}
```

**After**:
```typescript
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default async function Post({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)

  return <article>{post.content}</article>
}
```

### Step 11: Migrate Context Providers

**Before (pages/_app.tsx)**:
```typescript
import { ThemeProvider } from '../contexts/ThemeContext'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  )
}
```

**After (app/layout.tsx with client component)**:

Create `app/providers.tsx`:
```typescript
'use client'

import { ThemeProvider } from '../contexts/ThemeContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  )
}
```

**app/layout.tsx**:
```typescript
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

### Step 12: Migrate Middleware

Middleware works similarly but with some API changes.

**Before (pages/middleware.ts)**:
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add custom header
  response.headers.set('x-custom-header', 'value')

  return response
}

export const config = {
  matcher: '/about/:path*',
}
```

**After (middleware.ts in root)**:
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add custom header
  response.headers.set('x-custom-header', 'value')

  return response
}

export const config = {
  matcher: '/about/:path*',
}
```

### Step 13: Handle Loading and Error States

App Router provides special files for loading and error states.

**app/loading.tsx** (Automatic loading UI):
```typescript
export default function Loading() {
  return (
    <div className="loading-spinner">
      <span>Loading...</span>
    </div>
  )
}
```

**app/error.tsx** (Error boundary):
```typescript
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

**app/not-found.tsx** (Custom 404):
```typescript
export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
    </div>
  )
}
```

## Caching Behavior Changes

### Pages Router Caching
```typescript
// No cache
export const getServerSideProps = async () => { /* ... */ }

// Static with revalidation
export const getStaticProps = async () => {
  return {
    props: { data },
    revalidate: 60
  }
}
```

### App Router Caching
```typescript
// Force dynamic (no cache)
export const dynamic = 'force-dynamic'

// Static with revalidation
fetch('...', { next: { revalidate: 60 } })

// Cache forever
fetch('...', { cache: 'force-cache' })

// Never cache
fetch('...', { cache: 'no-store' })

// Revalidate on-demand
import { revalidatePath, revalidateTag } from 'next/cache'
```

## Route Segment Config

App Router introduces route segment config for fine-grained control:

```typescript
// app/page.tsx
export const dynamic = 'auto' // 'auto' | 'force-dynamic' | 'error' | 'force-static'
export const dynamicParams = true // true | false
export const revalidate = 60 // false | 0 | number
export const fetchCache = 'auto' // 'auto' | 'default-cache' | 'only-cache' | 'force-cache' | 'force-no-store' | 'default-no-store' | 'only-no-store'
export const runtime = 'nodejs' // 'nodejs' | 'edge'
export const preferredRegion = 'auto' // 'auto' | 'global' | 'home' | string | string[]
```

## Testing Your Migration

1. **Test each route individually**:
```bash
npm run dev
# Visit each migrated route
```

2. **Check for console errors**: Look for hydration errors

3. **Verify data fetching**: Ensure data loads correctly

4. **Test client interactions**: Verify forms, buttons, etc.

5. **Check performance**:
```bash
npm run build
npm start
# Use Lighthouse or WebPageTest
```

## Common Migration Patterns

### Pattern 1: Combining Server and Client Components

```typescript
// app/page.tsx (Server Component)
import ClientComponent from './ClientComponent'

async function getData() {
  const res = await fetch('...')
  return res.json()
}

export default async function Page() {
  const data = await getData()

  return (
    <div>
      <h1>Server-rendered title</h1>
      <ClientComponent initialData={data} />
    </div>
  )
}
```

```typescript
// app/ClientComponent.tsx
'use client'

import { useState } from 'react'

export default function ClientComponent({ initialData }) {
  const [data, setData] = useState(initialData)

  return (
    <div>
      {/* Interactive UI */}
    </div>
  )
}
```

### Pattern 2: Streaming with Suspense

```typescript
import { Suspense } from 'react'

async function SlowComponent() {
  const data = await fetchSlowData()
  return <div>{data}</div>
}

export default function Page() {
  return (
    <div>
      <h1>Fast content</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <SlowComponent />
      </Suspense>
    </div>
  )
}
```

### Pattern 3: Server Actions (Replacing API Routes for Mutations)

```typescript
// app/actions.ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  const content = formData.get('content')

  const post = await db.post.create({
    data: { title, content }
  })

  revalidatePath('/blog')
  return post
}
```

```typescript
// app/new-post/page.tsx
import { createPost } from '../actions'

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  )
}
```

## Cleanup After Migration

Once all routes are migrated and tested:

1. **Remove Pages Router files**:
```bash
rm -rf pages/
```

2. **Update configuration**:
Remove any Pages Router-specific config from `next.config.js`

3. **Remove unused dependencies**:
Check for packages that were only needed for Pages Router

4. **Update documentation**:
Update your project's README and documentation

## Additional Resources

- [App Router Documentation](https://nextjs.org/docs/app)
- [Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
