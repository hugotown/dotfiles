# generateStaticParams

The `generateStaticParams()` function generates static route parameters at build time for dynamic route segments, enabling Static Site Generation (SSG).

## Function Signature

```typescript
export async function generateStaticParams(): Promise<Params[]>

type Params = {
  [key: string]: string
}
```

## Return Value

Returns an array of objects representing the dynamic segment parameters to pre-render.

## Usage Examples

### Basic Usage

```typescript
// app/posts/[id]/page.tsx
export async function generateStaticParams() {
  const posts = await getPosts()

  return posts.map((post) => ({
    id: post.id
  }))
}

export default function Page({ params }: { params: { id: string } }) {
  return <div>Post {params.id}</div>
}
```

### Multiple Dynamic Segments

```typescript
// app/blog/[category]/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getAllPosts()

  return posts.map((post) => ({
    category: post.category,
    slug: post.slug
  }))
}

export default function Page({
  params
}: {
  params: { category: string; slug: string }
}) {
  return <div>{params.category}/{params.slug}</div>
}
```

### With Database Query

```typescript
// app/products/[id]/page.tsx
export async function generateStaticParams() {
  const products = await db.product.findMany({
    where: { published: true },
    select: { id: true }
  })

  return products.map((product) => ({
    id: product.id
  }))
}

export default async function ProductPage({
  params
}: {
  params: { id: string }
}) {
  const product = await getProduct(params.id)

  return <ProductView product={product} />
}
```

### With External API

```typescript
// app/users/[id]/page.tsx
export async function generateStaticParams() {
  const res = await fetch('https://api.example.com/users')
  const users = await res.json()

  return users.map((user: { id: string }) => ({
    id: user.id
  }))
}

export default function UserPage({ params }: { params: { id: string } }) {
  return <div>User {params.id}</div>
}
```

### Limiting Number of Pages

```typescript
// app/posts/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getPosts()

  // Only generate the top 100 most popular posts
  return posts
    .sort((a, b) => b.views - a.views)
    .slice(0, 100)
    .map((post) => ({
      slug: post.slug
    }))
}
```

### Nested Dynamic Routes

```typescript
// app/[lang]/[category]/[slug]/page.tsx
export async function generateStaticParams() {
  const languages = ['en', 'es', 'fr']
  const posts = await getAllPosts()

  const params: { lang: string; category: string; slug: string }[] = []

  for (const lang of languages) {
    for (const post of posts) {
      params.push({
        lang,
        category: post.category,
        slug: post.slug
      })
    }
  }

  return params
}
```

### With Parent Params

```typescript
// app/blog/[category]/page.tsx
export async function generateStaticParams() {
  const categories = await getCategories()

  return categories.map((category) => ({
    category: category.slug
  }))
}

// app/blog/[category]/[slug]/page.tsx
export async function generateStaticParams({
  params
}: {
  params: { category: string }
}) {
  // Access parent route params
  const posts = await getPostsByCategory(params.category)

  return posts.map((post) => ({
    slug: post.slug
  }))
}
```

### Type-Safe Params

```typescript
type Params = {
  id: string
}

export async function generateStaticParams(): Promise<Params[]> {
  const items = await getItems()

  return items.map((item) => ({
    id: item.id
  }))
}

export default function Page({ params }: { params: Params }) {
  return <div>Item {params.id}</div>
}
```

### With Revalidation

```typescript
// app/posts/[id]/page.tsx

// Generate static pages at build time
export async function generateStaticParams() {
  const posts = await getPosts()

  return posts.map((post) => ({
    id: post.id
  }))
}

// Revalidate every hour
export const revalidate = 3600

export default async function Page({ params }: { params: { id: string } }) {
  const post = await getPost(params.id)
  return <PostView post={post} />
}
```

### E-commerce Product Catalog

```typescript
// app/products/[category]/[id]/page.tsx
export async function generateStaticParams() {
  const products = await db.product.findMany({
    where: { published: true },
    select: { id: true, categoryId: true }
  })

  return products.map((product) => ({
    category: product.categoryId,
    id: product.id
  }))
}
```

### Blog with Pagination

```typescript
// app/blog/page/[page]/page.tsx
export async function generateStaticParams() {
  const totalPosts = await getPostCount()
  const postsPerPage = 10
  const totalPages = Math.ceil(totalPosts / postsPerPage)

  return Array.from({ length: totalPages }, (_, i) => ({
    page: String(i + 1)
  }))
}

export default function BlogPage({ params }: { params: { page: string } }) {
  return <div>Page {params.page}</div>
}
```

### Multi-Language Routes

```typescript
// app/[lang]/posts/[slug]/page.tsx
export async function generateStaticParams() {
  const languages = ['en', 'es', 'fr', 'de']
  const posts = await getPosts()

  const params: { lang: string; slug: string }[] = []

  for (const lang of languages) {
    const localizedPosts = await getLocalizedPosts(lang)

    for (const post of localizedPosts) {
      params.push({
        lang,
        slug: post.slug
      })
    }
  }

  return params
}
```

### Partial Pre-rendering

```typescript
// app/posts/[id]/page.tsx
export async function generateStaticParams() {
  // Only pre-render the 50 most recent posts
  const recentPosts = await getRecentPosts(50)

  return recentPosts.map((post) => ({
    id: post.id
  }))
}

// dynamicParams controls whether to generate on-demand
export const dynamicParams = true // default: true

// Pages not in generateStaticParams will be generated on-demand
```

### Using dynamicParams

```typescript
// app/posts/[id]/page.tsx
export async function generateStaticParams() {
  const posts = await getPosts()

  return posts.map((post) => ({
    id: post.id
  }))
}

// Control dynamic params behavior
export const dynamicParams = false // 404 for non-generated params
// or
export const dynamicParams = true // Generate on-demand (default)
```

### With Error Handling

```typescript
export async function generateStaticParams() {
  try {
    const posts = await getPosts()

    return posts.map((post) => ({
      id: post.id
    }))
  } catch (error) {
    console.error('Failed to generate static params:', error)
    return [] // Return empty array as fallback
  }
}
```

### Filtering Published Content

```typescript
export async function generateStaticParams() {
  const posts = await db.post.findMany({
    where: {
      published: true,
      publishedAt: {
        lte: new Date() // Only published posts
      }
    },
    select: { slug: true }
  })

  return posts.map((post) => ({
    slug: post.slug
  }))
}
```

### Complex Hierarchical Routes

```typescript
// app/docs/[version]/[category]/[page]/page.tsx
export async function generateStaticParams() {
  const versions = ['v1', 'v2', 'v3']
  const categories = await getCategories()

  const params: { version: string; category: string; page: string }[] = []

  for (const version of versions) {
    for (const category of categories) {
      const pages = await getPages(version, category.slug)

      for (const page of pages) {
        params.push({
          version,
          category: category.slug,
          page: page.slug
        })
      }
    }
  }

  return params
}
```

## Best Practices

1. **Return Only Necessary Fields**
   ```typescript
   // ✅ Select only needed fields
   const posts = await db.post.findMany({
     select: { id: true }
   })

   // ❌ Don't fetch unnecessary data
   const posts = await db.post.findMany() // Fetches all fields
   ```

2. **Use dynamicParams Appropriately**
   ```typescript
   // Generate top 100, allow on-demand for others
   export const dynamicParams = true

   export async function generateStaticParams() {
     return getTop100Posts()
   }
   ```

3. **Consider Build Time**
   ```typescript
   // Don't generate thousands of pages if not needed
   export async function generateStaticParams() {
     // Generate only most important pages
     const posts = await getPosts()
     return posts.slice(0, 100).map(p => ({ id: p.id }))
   }
   ```

4. **Type Your Return Value**
   ```typescript
   type Params = {
     category: string
     slug: string
   }

   export async function generateStaticParams(): Promise<Params[]> {
     // TypeScript will ensure correct shape
     return []
   }
   ```

5. **Combine with Revalidation**
   ```typescript
   export const revalidate = 3600 // 1 hour

   export async function generateStaticParams() {
     return getPosts()
   }
   ```

6. **Handle Errors Gracefully**
   ```typescript
   export async function generateStaticParams() {
     try {
       return await getPosts()
     } catch (error) {
       console.error(error)
       return [] // Fallback to empty array
     }
   }
   ```

## Common Patterns

### Blog Posts

```typescript
export async function generateStaticParams() {
  const posts = await db.post.findMany({
    where: { published: true },
    select: { slug: true },
    orderBy: { publishedAt: 'desc' }
  })

  return posts.map((post) => ({
    slug: post.slug
  }))
}
```

### Product Pages

```typescript
export async function generateStaticParams() {
  const products = await db.product.findMany({
    where: { active: true },
    select: { id: true }
  })

  return products.map((product) => ({
    id: product.id
  }))
}
```

### Documentation

```typescript
export async function generateStaticParams() {
  const docs = await getAllDocs()

  return docs.map((doc) => ({
    slug: doc.slug.split('/')
  }))
}
```

## Configuration

### dynamicParams

Controls whether dynamic segments not returned by `generateStaticParams` are generated on-demand or return 404:

```typescript
// app/posts/[id]/page.tsx
export const dynamicParams = true // default - generate on demand
// or
export const dynamicParams = false // return 404
```

## Notes

- Only works in `page.tsx` files
- Runs at build time in production
- Runs on-demand in development
- Cannot be used in layouts
- Combined with `dynamicParams` for hybrid rendering
- Return value must be an array of objects
- Each object represents route parameters
- Use with `export const revalidate` for ISR (Incremental Static Regeneration)
- Parent route params are available in nested routes

## Related

- [generateMetadata](./generateMetadata.md) - Generate page metadata
- [dynamicParams](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamicparams) - Control dynamic params
- [revalidate](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#revalidate) - Revalidation configuration
