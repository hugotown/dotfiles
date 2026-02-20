# Dynamic Routes in Next.js App Router

Dynamic routes allow you to create routes with variable segments that can match different URL patterns. This is essential for building pages like blog posts, product pages, or user profiles where the content changes based on the URL parameter.

## Overview

Dynamic routes are created by wrapping a folder name in square brackets: `[folderName]`. The value from the URL segment is passed to the page as a parameter.

## Basic Dynamic Route Syntax

### Single Dynamic Segment

Create a dynamic route segment using `[param]`:

```
app/
  blog/
    [slug]/
      page.tsx
```

This matches:
- `/blog/hello-world`
- `/blog/my-first-post`
- `/blog/anything`

**Accessing the parameter:**

```typescript
// app/blog/[slug]/page.tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <h1>Blog Post: {params.slug}</h1>
}
```

### Multiple Dynamic Segments

You can have multiple dynamic segments in a route:

```
app/
  shop/
    [category]/
      [product]/
        page.tsx
```

This matches:
- `/shop/electronics/laptop`
- `/shop/clothing/shirt`

**Accessing multiple parameters:**

```typescript
// app/shop/[category]/[product]/page.tsx
export default function Product({
  params,
}: {
  params: { category: string; product: string }
}) {
  return (
    <div>
      <h1>Product: {params.product}</h1>
      <p>Category: {params.category}</p>
    </div>
  )
}
```

## Catch-All Segments

### Catch-All Routes `[...segment]`

Match multiple route segments using `[...param]`:

```
app/
  docs/
    [...slug]/
      page.tsx
```

This matches:
- `/docs/introduction`
- `/docs/getting-started/installation`
- `/docs/api/reference/hooks/useRouter`

But **does not** match `/docs` (the base route).

**Accessing catch-all parameters:**

```typescript
// app/docs/[...slug]/page.tsx
export default function Docs({ params }: { params: { slug: string[] } }) {
  // For /docs/getting-started/installation
  // params.slug = ['getting-started', 'installation']

  return (
    <div>
      <h1>Documentation</h1>
      <p>Path: {params.slug.join(' / ')}</p>
    </div>
  )
}
```

### Optional Catch-All Routes `[[...segment]]`

Match the base route AND multiple segments using `[[...param]]`:

```
app/
  shop/
    [[...slug]]/
      page.tsx
```

This matches:
- `/shop` (params.slug will be undefined)
- `/shop/electronics`
- `/shop/electronics/laptops`

**Handling optional parameters:**

```typescript
// app/shop/[[...slug]]/page.tsx
export default function Shop({ params }: { params: { slug?: string[] } }) {
  const path = params.slug ? params.slug.join('/') : 'all'

  return (
    <div>
      <h1>Shop</h1>
      <p>Viewing: {path}</p>
    </div>
  )
}
```

## TypeScript Types

### Type-Safe Parameters

```typescript
// app/blog/[slug]/page.tsx
interface PageProps {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function Page({ params, searchParams }: PageProps) {
  return (
    <div>
      <h1>{params.slug}</h1>
      <p>Sort: {searchParams.sort}</p>
    </div>
  )
}
```

### Catch-All Types

```typescript
// app/docs/[...slug]/page.tsx
interface DocsPageProps {
  params: { slug: string[] }
}

// app/shop/[[...slug]]/page.tsx
interface ShopPageProps {
  params: { slug?: string[] }
}
```

## Static Generation with generateStaticParams

For dynamic routes, you can pre-render pages at build time using `generateStaticParams`. This is the App Router equivalent of `getStaticPaths`.

### Basic Usage

```typescript
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  return <h1>Post: {params.slug}</h1>
}
```

### With Multiple Parameters

```typescript
// app/shop/[category]/[product]/page.tsx
export async function generateStaticParams() {
  const products = await getProducts()

  return products.map((product) => ({
    category: product.category,
    product: product.slug,
  }))
}
```

### With Catch-All Routes

```typescript
// app/docs/[...slug]/page.tsx
export async function generateStaticParams() {
  const docs = await getAllDocs()

  return docs.map((doc) => ({
    slug: doc.path.split('/'),
  }))
}
```

### Nested Dynamic Routes

For nested dynamic routes, you can generate parameters hierarchically:

```typescript
// app/blog/[category]/[slug]/page.tsx

// Generate categories first
export async function generateStaticParams() {
  const categories = await getCategories()

  // For each category, generate all posts
  const allParams = []
  for (const category of categories) {
    const posts = await getPostsByCategory(category.slug)
    posts.forEach((post) => {
      allParams.push({
        category: category.slug,
        slug: post.slug,
      })
    })
  }

  return allParams
}
```

## Dynamic Metadata

Generate dynamic metadata for SEO based on route parameters:

```typescript
// app/blog/[slug]/page.tsx
import { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
    },
  }
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  // Page content
}
```

## Use Cases

### Blog or CMS Pages

```typescript
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

async function getPost(slug: string) {
  const post = await db.post.findUnique({
    where: { slug },
  })

  if (!post) notFound()
  return post
}

export async function generateStaticParams() {
  const posts = await db.post.findMany()
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  )
}
```

### User Profiles

```typescript
// app/users/[username]/page.tsx
export default async function UserProfile({
  params,
}: {
  params: { username: string }
}) {
  const user = await getUser(params.username)

  return (
    <div>
      <h1>@{user.username}</h1>
      <p>{user.bio}</p>
    </div>
  )
}
```

### Product Pages

```typescript
// app/products/[id]/page.tsx
export default async function Product({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id)

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>${product.price}</p>
    </div>
  )
}
```

### Documentation Site

```typescript
// app/docs/[...slug]/page.tsx
import { notFound } from 'next/navigation'

async function getDoc(slug: string[]) {
  const path = slug.join('/')
  const doc = await getDocByPath(path)

  if (!doc) notFound()
  return doc
}

export async function generateStaticParams() {
  const docs = await getAllDocs()

  return docs.map((doc) => ({
    slug: doc.path.split('/'),
  }))
}

export default async function DocPage({
  params,
}: {
  params: { slug: string[] }
}) {
  const doc = await getDoc(params.slug)

  return (
    <article>
      <h1>{doc.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: doc.content }} />
    </article>
  )
}
```

## Best Practices

### 1. Validate Parameters

Always validate dynamic parameters to prevent errors:

```typescript
export default async function Page({ params }: { params: { slug: string } }) {
  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(params.slug)) {
    notFound()
  }

  const post = await getPost(params.slug)

  if (!post) {
    notFound()
  }

  return <article>{/* content */}</article>
}
```

### 2. Handle Not Found Cases

Use the `notFound()` function for missing resources:

```typescript
import { notFound } from 'next/navigation'

export default async function Page({ params }: { params: { id: string } }) {
  const item = await getItem(params.id)

  if (!item) {
    notFound()
  }

  return <div>{item.name}</div>
}
```

### 3. Use Type Safety

Define proper TypeScript interfaces:

```typescript
interface PageProps {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function Page({ params, searchParams }: PageProps) {
  // TypeScript will enforce correct types
}
```

### 4. Optimize with Static Generation

Pre-render pages when possible:

```typescript
// Generate at build time
export async function generateStaticParams() {
  return [
    { slug: 'post-1' },
    { slug: 'post-2' },
    { slug: 'post-3' },
  ]
}

// This enables ISR (Incremental Static Regeneration)
export const revalidate = 3600 // Revalidate every hour
```

### 5. Consider Using Search Params for Filters

Use search params for optional filtering instead of creating many dynamic routes:

```typescript
// Prefer: /products?category=electronics
// Over: /products/electronics

export default function Products({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const category = searchParams.category || 'all'
  return <ProductList category={category} />
}
```

### 6. Handle Array Parameters

For catch-all routes, always check if the parameter exists:

```typescript
export default function Page({ params }: { params: { slug?: string[] } }) {
  const slug = params.slug || []

  if (slug.length === 0) {
    // Handle base case
  }

  // Safe to use slug as array
  const path = slug.join('/')
}
```

## Common Pitfalls

### 1. Forgetting Optional Catch-All Syntax

```typescript
// ❌ Won't match /shop
app/shop/[...category]/page.tsx

// ✅ Matches /shop and /shop/electronics
app/shop/[[...category]]/page.tsx
```

### 2. Incorrect Parameter Access

```typescript
// ❌ Wrong
export default function Page({ params }: any) {
  const slug = params[0] // Incorrect for catch-all
}

// ✅ Correct
export default function Page({ params }: { params: { slug: string[] } }) {
  const slug = params.slug // Array for catch-all
}
```

### 3. Missing Type Definitions

```typescript
// ❌ No type safety
export default function Page({ params }) {
  // params is any
}

// ✅ Type-safe
export default function Page({ params }: { params: { id: string } }) {
  // params.id is string
}
```

### 4. Not Handling Missing Data

```typescript
// ❌ Can crash
export default async function Page({ params }: { params: { id: string } }) {
  const item = await getItem(params.id)
  return <h1>{item.name}</h1> // Crashes if item is null
}

// ✅ Safe
export default async function Page({ params }: { params: { id: string } }) {
  const item = await getItem(params.id)
  if (!item) notFound()
  return <h1>{item.name}</h1>
}
```

## Advanced Patterns

### Dynamic Routes with Layouts

```typescript
// app/blog/[slug]/layout.tsx
export default async function BlogLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const post = await getPost(params.slug)

  return (
    <div>
      <aside>
        <h3>Related Posts</h3>
        <RelatedPosts category={post.category} />
      </aside>
      <main>{children}</main>
    </div>
  )
}
```

### Parallel Dynamic Routes

```typescript
// app/blog/[slug]/layout.tsx
export default function Layout({
  children,
  params,
  related,
}: {
  children: React.ReactNode
  params: { slug: string }
  related: React.ReactNode
}) {
  return (
    <div>
      <main>{children}</main>
      <aside>{related}</aside>
    </div>
  )
}

// app/blog/[slug]/@related/page.tsx
export default async function RelatedPosts({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)
  const related = await getRelatedPosts(post.category)

  return (
    <div>
      {related.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

## Summary

Dynamic routes in Next.js App Router provide flexible URL patterns for content-driven applications. Key takeaways:

- Use `[param]` for single dynamic segments
- Use `[...param]` for catch-all routes (doesn't match base)
- Use `[[...param]]` for optional catch-all (matches base too)
- Generate static pages with `generateStaticParams`
- Always validate parameters and handle errors
- Use TypeScript for type safety
- Leverage layouts for shared UI around dynamic content
