# Incremental Static Regeneration (ISR)

Incremental Static Regeneration (ISR) allows you to create or update static pages after build time, combining the benefits of static generation with dynamic data updates.

## Overview

ISR enables you to:
- Use static generation on a per-page basis
- Update static content without rebuilding the entire site
- Serve stale content while regenerating in the background
- Handle dynamic routes efficiently

## Basic ISR Patterns

### Time-Based Revalidation

```typescript
// app/products/page.tsx
export const revalidate = 3600 // Revalidate every hour

export default async function ProductsPage() {
  const products = await fetch('https://api.example.com/products').then(r => r.json())

  return (
    <div>
      <h1>Products</h1>
      {products.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  )
}
```

### Route Segment Revalidation

```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 60 // Revalidate every 60 seconds

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`)
    .then(r => r.json())

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

### Fetch-Level Revalidation

```typescript
// app/page.tsx
export default async function HomePage() {
  // Different revalidation for different fetches
  const featured = await fetch('https://api.example.com/featured', {
    next: { revalidate: 300 } // 5 minutes
  }).then(r => r.json())

  const news = await fetch('https://api.example.com/news', {
    next: { revalidate: 60 } // 1 minute
  }).then(r => r.json())

  return (
    <div>
      <section>Featured: {featured}</section>
      <section>News: {news}</section>
    </div>
  )
}
```

## On-Demand Revalidation

### revalidatePath

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')

  if (path) {
    revalidatePath(path)
    return Response.json({ revalidated: true, now: Date.now() })
  }

  return Response.json({ revalidated: false, message: 'Missing path' })
}
```

### revalidateTag

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag')

  if (tag) {
    revalidateTag(tag)
    return Response.json({ revalidated: true, now: Date.now() })
  }

  return Response.json({ revalidated: false, message: 'Missing tag' })
}

// Usage in fetches
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { tags: ['products'] }
  })
  return res.json()
}
```

### Server Action Revalidation

```typescript
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

export async function createProduct(formData: FormData) {
  const product = {
    name: formData.get('name'),
    price: formData.get('price')
  }

  await saveProduct(product)

  // Revalidate specific path
  revalidatePath('/products')

  // Or revalidate by tag
  revalidateTag('products')

  return { success: true }
}
```

## Advanced ISR Patterns

### Dynamic Route Generation

```typescript
// app/products/[id]/page.tsx
export const revalidate = 3600

// Generate static params at build time
export async function generateStaticParams() {
  const products = await fetch('https://api.example.com/products')
    .then(r => r.json())

  return products.map(product => ({
    id: product.id.toString()
  }))
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetch(`https://api.example.com/products/${params.id}`)
    .then(r => r.json())

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  )
}
```

### Fallback Handling

```typescript
// app/products/[id]/page.tsx
export const dynamicParams = true // Allow dynamic routes not in generateStaticParams
export const revalidate = 3600

export async function generateStaticParams() {
  // Only generate top 100 products at build
  const topProducts = await fetch('https://api.example.com/products/top?limit=100')
    .then(r => r.json())

  return topProducts.map(product => ({
    id: product.id.toString()
  }))
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  try {
    const product = await fetch(`https://api.example.com/products/${params.id}`)
      .then(r => r.json())

    return (
      <div>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
      </div>
    )
  } catch (error) {
    return <div>Product not found</div>
  }
}
```

### Stale-While-Revalidate Pattern

```typescript
// app/news/page.tsx
export const revalidate = 60 // Background revalidation every 60 seconds

export default async function NewsPage() {
  const news = await fetch('https://api.example.com/news', {
    next: { revalidate: 60 }
  }).then(r => r.json())

  return (
    <div>
      <h1>Latest News</h1>
      {/* Users get instant response with potentially stale data */}
      {/* Page regenerates in background */}
      {news.map(article => (
        <article key={article.id}>
          <h2>{article.title}</h2>
          <p>{article.summary}</p>
        </article>
      ))}
    </div>
  )
}
```

### Multi-Level Caching

```typescript
// app/products/page.tsx
export const revalidate = 3600 // Page-level: 1 hour

export default async function ProductsPage() {
  // Featured products: 5 minutes
  const featured = await fetch('https://api.example.com/featured', {
    next: { revalidate: 300, tags: ['featured'] }
  }).then(r => r.json())

  // All products: 1 hour (matches page revalidate)
  const products = await fetch('https://api.example.com/products', {
    next: { revalidate: 3600, tags: ['products'] }
  }).then(r => r.json())

  // User reviews: 10 minutes
  const reviews = await fetch('https://api.example.com/reviews', {
    next: { revalidate: 600, tags: ['reviews'] }
  }).then(r => r.json())

  return (
    <div>
      <section>{/* Featured products */}</section>
      <section>{/* All products */}</section>
      <section>{/* Reviews */}</section>
    </div>
  )
}
```

## Webhook-Based Revalidation

### Secure Webhook Handler

```typescript
// app/api/revalidate/webhook/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  // Verify webhook signature
  const signature = request.headers.get('x-webhook-signature')
  const secret = process.env.WEBHOOK_SECRET

  if (signature !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Handle different webhook events
  switch (body.event) {
    case 'product.created':
    case 'product.updated':
      revalidateTag('products')
      revalidatePath('/products')
      revalidatePath(`/products/${body.data.id}`)
      break

    case 'product.deleted':
      revalidatePath('/products')
      break

    default:
      return Response.json({ error: 'Unknown event' }, { status: 400 })
  }

  return Response.json({ revalidated: true, timestamp: Date.now() })
}
```

### CMS Integration

```typescript
// app/api/revalidate/cms/route.ts
import { revalidatePath } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { secret, path, type } = await request.json()

  if (secret !== process.env.CMS_REVALIDATE_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 })
  }

  // Revalidate based on content type
  if (type === 'blog-post') {
    revalidatePath('/blog')
    revalidatePath(path) // Specific post path
  } else if (type === 'page') {
    revalidatePath(path)
  }

  return Response.json({ revalidated: true })
}
```

## Performance Optimization

### Smart Revalidation Intervals

```typescript
// Frequently changing data
export const revalidate = 60 // 1 minute

// Moderately changing data
export const revalidate = 3600 // 1 hour

// Rarely changing data
export const revalidate = 86400 // 24 hours

// Almost static data
export const revalidate = 604800 // 1 week
```

### Selective Route Generation

```typescript
// Only generate top products at build
export async function generateStaticParams() {
  const products = await fetch('https://api.example.com/products/popular?limit=50')
    .then(r => r.json())

  return products.map(product => ({
    id: product.id.toString()
  }))
}

// Enable dynamic params for other products
export const dynamicParams = true
```

### Parallel Revalidation

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateMultiplePaths(paths: string[]) {
  // Revalidate multiple paths in parallel
  await Promise.all(
    paths.map(path => revalidatePath(path))
  )

  return { success: true, count: paths.length }
}
```

## Common Use Cases

### Blog/CMS

```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 3600 // Revalidate every hour

export async function generateStaticParams() {
  const posts = await fetch('https://cms.example.com/posts')
    .then(r => r.json())

  return posts.map(post => ({
    slug: post.slug
  }))
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetch(`https://cms.example.com/posts/${params.slug}`, {
    next: { tags: ['blog', `post-${params.slug}`] }
  }).then(r => r.json())

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  )
}

// Revalidate on publish
// app/api/revalidate/route.ts
export async function POST(request: NextRequest) {
  const { slug } = await request.json()

  revalidateTag(`post-${slug}`)
  revalidatePath(`/blog/${slug}`)
  revalidatePath('/blog')

  return Response.json({ revalidated: true })
}
```

### E-commerce Product Catalog

```typescript
// app/products/[id]/page.tsx
export const revalidate = 300 // 5 minutes

export async function generateStaticParams() {
  // Generate top 1000 products at build
  const products = await fetch('https://api.example.com/products/top?limit=1000')
    .then(r => r.json())

  return products.map(product => ({
    id: product.id.toString()
  }))
}

export const dynamicParams = true

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetch(`https://api.example.com/products/${params.id}`, {
    next: { tags: ['products', `product-${params.id}`] }
  }).then(r => r.json())

  return (
    <div>
      <h1>{product.name}</h1>
      <p>${product.price}</p>
      <button>Add to Cart</button>
    </div>
  )
}

// Revalidate on price/stock update
'use server'
export async function updateProductInventory(id: string, stock: number) {
  await updateStock(id, stock)
  revalidateTag(`product-${id}`)
}
```

### Documentation Site

```typescript
// app/docs/[...slug]/page.tsx
export const revalidate = false // Only revalidate on-demand

export async function generateStaticParams() {
  const docs = await fetch('https://api.example.com/docs')
    .then(r => r.json())

  return docs.map(doc => ({
    slug: doc.path.split('/')
  }))
}

export default async function DocPage({ params }: { params: { slug: string[] } }) {
  const path = params.slug.join('/')
  const doc = await fetch(`https://api.example.com/docs/${path}`)
    .then(r => r.json())

  return (
    <article>
      <h1>{doc.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: doc.content }} />
    </article>
  )
}

// Revalidate on doc update
// app/api/revalidate/docs/route.ts
export async function POST(request: NextRequest) {
  const { path } = await request.json()

  revalidatePath(`/docs/${path}`)

  return Response.json({ revalidated: true })
}
```

## Debugging ISR

### Log Revalidation Events

```typescript
// app/api/revalidate/route.ts
export async function POST(request: NextRequest) {
  const { path, tag } = await request.json()

  console.log('[ISR] Revalidation requested')
  console.log('[ISR] Path:', path)
  console.log('[ISR] Tag:', tag)
  console.log('[ISR] Timestamp:', new Date().toISOString())

  if (path) {
    revalidatePath(path)
    console.log('[ISR] Path revalidated:', path)
  }

  if (tag) {
    revalidateTag(tag)
    console.log('[ISR] Tag revalidated:', tag)
  }

  return Response.json({ revalidated: true })
}
```

### Track Page Generation

```typescript
export default async function Page() {
  const generatedAt = new Date().toISOString()

  console.log(`Page generated at: ${generatedAt}`)

  return (
    <div>
      <p>Generated at: {generatedAt}</p>
    </div>
  )
}
```

### Monitor Revalidation Success

```typescript
'use server'

import { revalidatePath } from 'next/cache'

export async function monitoredRevalidation(path: string) {
  const start = Date.now()

  try {
    revalidatePath(path)
    const duration = Date.now() - start

    console.log(`Revalidation successful: ${path} (${duration}ms)`)
    return { success: true, duration }
  } catch (error) {
    console.error(`Revalidation failed: ${path}`, error)
    return { success: false, error: error.message }
  }
}
```

## Best Practices

1. **Set appropriate revalidation intervals**: Match to data volatility
2. **Use on-demand revalidation**: Revalidate immediately after updates
3. **Tag your fetches**: Enable granular cache invalidation
4. **Generate popular routes**: Pre-generate high-traffic pages
5. **Enable dynamic params**: Handle long-tail content
6. **Secure webhook endpoints**: Validate signatures and secrets
7. **Monitor revalidation**: Track success and failures
8. **Test fallback behavior**: Ensure good UX for dynamic routes

## Common Pitfalls

### 1. Not Using Tags

```typescript
// ❌ Wrong - can't invalidate granularly
const data = await fetch('https://api.example.com/data')

// ✅ Correct - tagged for invalidation
const data = await fetch('https://api.example.com/data', {
  next: { tags: ['data'] }
})
```

### 2. Overly Aggressive Revalidation

```typescript
// ❌ Wrong - revalidates too frequently
export const revalidate = 1 // Every second!

// ✅ Correct - appropriate interval
export const revalidate = 60 // Every minute
```

### 3. Forgetting Dynamic Params

```typescript
// ❌ Wrong - dynamic routes fail
export const dynamicParams = false

// ✅ Correct - handle dynamic routes
export const dynamicParams = true
```

## Related

- See `cache-tags.md` for detailed tag management
- See `cache-lifecycle.md` for cache duration control
- See `use-cache.md` for function-level caching
- See Next.js [ISR docs](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating)
