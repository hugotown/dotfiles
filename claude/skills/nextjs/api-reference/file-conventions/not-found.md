# not-found.js / not-found.tsx

The not-found file is used to render UI when the `notFound()` function is thrown within a route segment. It also serves custom 404 UI when a route doesn't exist.

## File Signature

```tsx
// app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
    </div>
  )
}
```

## Props

The not-found component does not accept any props.

```tsx
export default function NotFound() {
  // No props
  return <div>404 - Not Found</div>
}
```

## How It Works

The not-found UI can be triggered in two ways:

### 1. Programmatically with `notFound()`

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

async function getPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`)
  if (!res.ok) return null
  return res.json()
}

export default async function PostPage({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound() // Triggers not-found.tsx
  }

  return <article>{post.title}</article>
}
```

### 2. Automatically for Unmatched Routes

When a URL doesn't match any defined route, Next.js automatically shows the not-found UI.

## Examples

### Basic Not Found Page

```tsx
// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
      <Link href="/">Return Home</Link>
    </div>
  )
}
```

### Styled Not Found

```tsx
// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-600 mb-4">
        Page Not Found
      </h2>
      <p className="text-gray-500 mb-8">
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Go Back Home
      </Link>
    </div>
  )
}
```

### Not Found with Search

```tsx
// app/not-found.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NotFound() {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search) {
      router.push(`/search?q=${encodeURIComponent(search)}`)
    }
  }

  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-8xl font-bold text-gray-300 mb-4">404</h1>
      <h2 className="text-3xl font-bold mb-4">Oops! Page not found</h2>
      <p className="text-gray-600 mb-8">
        The page you are looking for might have been removed or is temporarily unavailable.
      </p>

      <form onSubmit={handleSearch} className="mb-8">
        <input
          type="text"
          placeholder="Search our site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border rounded-l-lg w-64"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600"
        >
          Search
        </button>
      </form>

      <div className="flex gap-4 justify-center">
        <Link href="/" className="px-6 py-3 bg-gray-800 text-white rounded-lg">
          Go Home
        </Link>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-300 rounded-lg"
        >
          Go Back
        </button>
      </div>
    </div>
  )
}
```

### Segment-Specific Not Found

```tsx
// app/blog/not-found.tsx
import Link from 'next/link'

export default function BlogNotFound() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">Blog Post Not Found</h1>
      <p className="text-gray-600 mb-8">
        Sorry, we couldn't find the blog post you're looking for.
      </p>
      <div className="flex gap-4">
        <Link
          href="/blog"
          className="px-6 py-3 bg-blue-500 text-white rounded-lg"
        >
          View All Posts
        </Link>
        <Link
          href="/"
          className="px-6 py-3 border border-gray-300 rounded-lg"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
```

### Not Found with Suggestions

```tsx
// app/products/not-found.tsx
import Link from 'next/link'

const popularProducts = [
  { id: 1, name: 'Product A', href: '/products/a' },
  { id: 2, name: 'Product B', href: '/products/b' },
  { id: 3, name: 'Product C', href: '/products/c' },
]

export default function ProductNotFound() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">Product Not Found</h1>
      <p className="text-gray-600 mb-8">
        The product you're looking for doesn't exist or has been removed.
      </p>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Popular Products</h2>
        <div className="grid grid-cols-3 gap-4">
          {popularProducts.map((product) => (
            <Link
              key={product.id}
              href={product.href}
              className="p-4 border rounded-lg hover:border-blue-500"
            >
              {product.name}
            </Link>
          ))}
        </div>
      </div>

      <Link
        href="/products"
        className="px-6 py-3 bg-blue-500 text-white rounded-lg inline-block"
      >
        Browse All Products
      </Link>
    </div>
  )
}
```

### Not Found with Image

```tsx
// app/not-found.tsx
import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <Image
        src="/404-illustration.svg"
        alt="404 Not Found"
        width={400}
        height={300}
        className="mb-8"
      />
      <h1 className="text-4xl font-bold mb-2">Page Not Found</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        We couldn't find the page you're looking for. It might have been moved or deleted.
      </p>
      <Link
        href="/"
        className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
      >
        Back to Home
      </Link>
    </div>
  )
}
```

## Nested Not Found Pages

Not-found files create nested 404 handling:

```
app/
├── not-found.tsx          # Global 404
└── blog/
    ├── not-found.tsx      # Blog-specific 404
    └── [slug]/
        └── page.tsx
```

When `notFound()` is called in `app/blog/[slug]/page.tsx`, it will use `app/blog/not-found.tsx`.

## Using notFound() Function

```tsx
// app/users/[id]/page.tsx
import { notFound } from 'next/navigation'

async function getUser(id: string) {
  const res = await fetch(`https://api.example.com/users/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default async function UserPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getUser(params.id)

  if (!user) {
    notFound()
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}
```

## Root Not Found

The root `app/not-found.tsx` handles all unmatched routes at the application level:

```tsx
// app/not-found.tsx
export default function RootNotFound() {
  return (
    <html>
      <body>
        <h1>404 - Page Not Found</h1>
      </body>
    </html>
  )
}
```

**Note:** Root not-found should include `<html>` and `<body>` tags since it replaces the root layout.

## TypeScript

```tsx
import Link from 'next/link'

export default function NotFound(): JSX.Element {
  return (
    <div>
      <h2>Not Found</h2>
      <Link href="/">Return Home</Link>
    </div>
  )
}
```

## Metadata

You can set metadata in not-found pages:

```tsx
// app/not-found.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for does not exist.',
}

export default function NotFound() {
  return <div>Not Found</div>
}
```

## Version History

- **v13.0.0**: App Router introduced with not-found.js convention
- **v13.4.0**: App Router stable

## Good to Know

- Can be Server or Client Components
- Does not receive any props
- Returns 404 HTTP status code
- Use `notFound()` from `next/navigation` to trigger
- Automatically shown for unmatched routes
- Nested not-found files create segment-specific 404 pages
- Root not-found.tsx should include `<html>` and `<body>` tags
- `.js`, `.jsx`, or `.tsx` file extensions can be used
- Rendered when `notFound()` is called or route doesn't exist
- More specific than error.tsx (only for 404s)
