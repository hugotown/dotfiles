# revalidateTag

The `revalidateTag()` function allows you to purge cached data on-demand for a specific cache tag, enabling granular cache invalidation across multiple requests.

## Function Signature

```typescript
import { revalidateTag } from 'next/cache'

function revalidateTag(tag: string): void
```

## Parameters

### `tag`
- **Type**: `string`
- **Description**: The cache tag to revalidate. All fetch requests and cached functions with this tag will be revalidated.

## Return Value

Returns `void`.

## Usage Examples

### Basic Tag Revalidation

```typescript
// First, tag your fetch requests
const res = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] }
})

// Then revalidate using the tag
'use server'

import { revalidateTag } from 'next/cache'

export async function createPost(data: any) {
  await db.post.create({ data })

  // Revalidate all requests tagged with 'posts'
  revalidateTag('posts')
}
```

### Multiple Tags for Granular Control

```typescript
// Tag with both collection and item
const res = await fetch(`https://api.example.com/posts/${id}`, {
  next: {
    tags: ['posts', `post-${id}`]
  }
})

// Revalidate specific post
'use server'

export async function updatePost(id: string, data: any) {
  await db.post.update({ where: { id }, data })

  revalidateTag(`post-${id}`)  // Revalidate specific post
  revalidateTag('posts')        // Revalidate posts list
}
```

### In Server Actions

```typescript
// app/actions.ts
'use server'

import { revalidateTag } from 'next/cache'

export async function createProduct(formData: FormData) {
  const product = await db.product.create({
    data: {
      name: formData.get('name'),
      price: formData.get('price')
    }
  })

  // Revalidate all product-related requests
  revalidateTag('products')

  return product
}

export async function updateProduct(id: string, data: any) {
  await db.product.update({ where: { id }, data })

  // Revalidate specific product and list
  revalidateTag(`product-${id}`)
  revalidateTag('products')
}

export async function deleteProduct(id: string) {
  await db.product.delete({ where: { id } })

  revalidateTag('products')
}
```

### With Data Fetching

```typescript
// app/products/page.tsx
export default async function ProductsPage() {
  const res = await fetch('https://api.example.com/products', {
    next: {
      tags: ['products'],
      revalidate: 3600  // Revalidate after 1 hour OR when tag is invalidated
    }
  })

  const products = await res.json()

  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

// app/products/[id]/page.tsx
export default async function ProductPage({
  params
}: {
  params: { id: string }
}) {
  const res = await fetch(`https://api.example.com/products/${params.id}`, {
    next: {
      tags: ['products', `product-${params.id}`]
    }
  })

  const product = await res.json()

  return <ProductDetail product={product} />
}
```

### Route Handler with Tag Revalidation

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag')
  const secret = request.nextUrl.searchParams.get('secret')

  // Verify secret
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!tag) {
    return Response.json({ error: 'Tag required' }, { status: 400 })
  }

  revalidateTag(tag)

  return Response.json({
    revalidated: true,
    tag,
    now: Date.now()
  })
}

// Usage: POST /api/revalidate?tag=posts&secret=xxx
```

### Webhook Integration

```typescript
// app/api/webhook/cms/route.ts
import { revalidateTag } from 'next/cache'

export async function POST(request: Request) {
  const { event, data } = await request.json()

  switch (event) {
    case 'post.created':
    case 'post.updated':
    case 'post.deleted':
      revalidateTag('posts')
      if (data.id) {
        revalidateTag(`post-${data.id}`)
      }
      break

    case 'category.updated':
      revalidateTag('categories')
      revalidateTag(`category-${data.id}`)
      break

    case 'product.published':
      revalidateTag('products')
      revalidateTag(`product-${data.id}`)
      break
  }

  return Response.json({ received: true })
}
```

### E-commerce Inventory Update

```typescript
'use server'

import { revalidateTag } from 'next/cache'

export async function updateInventory(productId: string, quantity: number) {
  await db.product.update({
    where: { id: productId },
    data: { inventory: quantity }
  })

  // Revalidate product page
  revalidateTag(`product-${productId}`)

  // Revalidate products list
  revalidateTag('products')

  // Revalidate cart (if product is in cart)
  revalidateTag('cart')
}
```

### Multi-level Tagging Strategy

```typescript
// Fetch with hierarchical tags
async function getPost(id: string) {
  const res = await fetch(`https://api.example.com/posts/${id}`, {
    next: {
      tags: [
        'content',              // All content
        'posts',                // All posts
        `post-${id}`,          // Specific post
        `author-${authorId}`   // Author's posts
      ]
    }
  })

  return res.json()
}

// Revalidate at different levels
'use server'

export async function revalidateContent() {
  revalidateTag('content')  // Revalidate ALL content
}

export async function revalidatePosts() {
  revalidateTag('posts')  // Revalidate all posts
}

export async function revalidatePost(id: string) {
  revalidateTag(`post-${id}`)  // Revalidate specific post
}

export async function revalidateAuthorPosts(authorId: string) {
  revalidateTag(`author-${authorId}`)  // Revalidate author's posts
}
```

### With unstable_cache

```typescript
import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'

// Cache function with tags
const getCachedPosts = unstable_cache(
  async () => {
    return await db.post.findMany()
  },
  ['posts-data'],
  {
    tags: ['posts'],
    revalidate: 3600
  }
)

// Revalidate the cached function
'use server'

export async function createPost(data: any) {
  await db.post.create({ data })

  // This will revalidate the unstable_cache above
  revalidateTag('posts')
}
```

### Category-Based Revalidation

```typescript
// Tag products by category
async function getProduct(id: string) {
  const product = await db.product.findUnique({ where: { id } })

  const res = await fetch(`https://api.example.com/product/${id}`, {
    next: {
      tags: [
        'products',
        `product-${id}`,
        `category-${product.categoryId}`
      ]
    }
  })

  return res.json()
}

// Revalidate all products in a category
'use server'

export async function updateCategory(categoryId: string, data: any) {
  await db.category.update({ where: { id: categoryId }, data })

  // Revalidate all products in this category
  revalidateTag(`category-${categoryId}`)
}
```

### User-Specific Cache Tags

```typescript
// Tag user-specific data
async function getUserDashboard(userId: string) {
  const res = await fetch(`https://api.example.com/dashboard/${userId}`, {
    next: {
      tags: [`user-${userId}`, 'dashboard']
    }
  })

  return res.json()
}

// Revalidate user's data
'use server'

export async function updateUserSettings(userId: string, settings: any) {
  await db.user.update({ where: { id: userId }, data: settings })

  // Revalidate all user-specific caches
  revalidateTag(`user-${userId}`)
}
```

### Revalidate Multiple Tags

```typescript
'use server'

import { revalidateTag } from 'next/cache'

export async function publishArticle(id: string) {
  await db.article.update({
    where: { id },
    data: { published: true }
  })

  // Revalidate multiple related tags
  revalidateTag('articles')
  revalidateTag(`article-${id}`)
  revalidateTag('homepage')
  revalidateTag('sitemap')
}
```

### Conditional Tag Revalidation

```typescript
'use server'

import { revalidateTag } from 'next/cache'

export async function updatePost(
  id: string,
  data: any,
  options?: { revalidateList?: boolean }
) {
  await db.post.update({ where: { id }, data })

  // Always revalidate the specific post
  revalidateTag(`post-${id}`)

  // Optionally revalidate the list
  if (options?.revalidateList) {
    revalidateTag('posts')
  }
}
```

## Best Practices

1. **Use Descriptive Tag Names**
   ```typescript
   // ✅ Clear and descriptive
   tags: ['products', `product-${id}`, `category-${categoryId}`]

   // ❌ Vague or confusing
   tags: ['data', 'item', 'stuff']
   ```

2. **Create a Tagging Strategy**
   ```typescript
   // Define consistent tag patterns
   const TAGS = {
     allProducts: 'products',
     product: (id: string) => `product-${id}`,
     category: (id: string) => `category-${id}`,
     user: (id: string) => `user-${id}`
   }

   // Use consistently
   fetch(url, { next: { tags: [TAGS.allProducts, TAGS.product(id)] } })
   revalidateTag(TAGS.product(id))
   ```

3. **Tag at Multiple Levels**
   ```typescript
   // Tag both collection and item for flexible revalidation
   fetch(url, {
     next: {
       tags: [
         'posts',        // Revalidate all posts
         `post-${id}`   // Revalidate specific post
       ]
     }
   })
   ```

4. **Combine with Time-Based Revalidation**
   ```typescript
   fetch(url, {
     next: {
       tags: ['products'],
       revalidate: 3600  // Revalidate after 1 hour OR when tag is invalidated
     }
   })
   ```

5. **Don't Over-Revalidate**
   ```typescript
   // ❌ Revalidating everything on every change
   export async function updateAnything() {
     revalidateTag('all-data')  // Too broad
   }

   // ✅ Revalidate only what changed
   export async function updateProduct(id: string) {
     revalidateTag(`product-${id}`)  // Specific
     revalidateTag('products')        // Related list
   }
   ```

6. **Use in Server Actions and Route Handlers Only**
   ```typescript
   // ✅ Server Action
   'use server'
   export async function update() {
     revalidateTag('data')
   }

   // ✅ Route Handler
   export async function POST() {
     revalidateTag('data')
     return Response.json({ ok: true })
   }

   // ❌ Server Component
   export default async function Page() {
     revalidateTag('data')  // Won't work!
   }
   ```

## Common Patterns

### CRUD with Tags

```typescript
'use server'

import { revalidateTag } from 'next/cache'

const TAGS = {
  items: 'items',
  item: (id: string) => `item-${id}`
}

export async function createItem(data: any) {
  await db.item.create({ data })
  revalidateTag(TAGS.items)
}

export async function updateItem(id: string, data: any) {
  await db.item.update({ where: { id }, data })
  revalidateTag(TAGS.item(id))
  revalidateTag(TAGS.items)
}

export async function deleteItem(id: string) {
  await db.item.delete({ where: { id } })
  revalidateTag(TAGS.items)
}
```

### CMS Integration

```typescript
'use server'

import { revalidateTag } from 'next/cache'

export async function onContentUpdate(type: string, id: string) {
  switch (type) {
    case 'post':
      revalidateTag('posts')
      revalidateTag(`post-${id}`)
      break
    case 'page':
      revalidateTag('pages')
      revalidateTag(`page-${id}`)
      break
    case 'global':
      revalidateTag('global-settings')
      break
  }
}
```

### Related Content Revalidation

```typescript
'use server'

import { revalidateTag } from 'next/cache'

export async function updateArticle(id: string, data: any) {
  const article = await db.article.update({ where: { id }, data })

  // Revalidate the article
  revalidateTag(`article-${id}`)

  // Revalidate author's articles
  revalidateTag(`author-${article.authorId}`)

  // Revalidate category
  revalidateTag(`category-${article.categoryId}`)

  // Revalidate related articles
  article.relatedIds.forEach((relatedId: string) => {
    revalidateTag(`article-${relatedId}`)
  })
}
```

## Tag Naming Conventions

```typescript
// Collection tags (plural)
'products'
'posts'
'users'

// Individual item tags
`product-${id}`
`post-${id}`
`user-${id}`

// Relationship tags
`category-${categoryId}`
`author-${authorId}`
`tag-${tagId}`

// Feature tags
'homepage'
'navigation'
'footer'
'sitemap'

// User-specific tags
`user-${userId}-dashboard`
`user-${userId}-settings`
```

## Notes

- Only works in Server Actions and Route Handlers
- Cannot be used in Server Components
- Revalidates all fetch requests with the matching tag
- Also revalidates `unstable_cache` functions with the tag
- Does not return a value
- Tags are case-sensitive
- More granular than `revalidatePath()`
- Allows revalidating related data across different routes

## Related

- [revalidatePath](./revalidatePath.md) - Revalidate by path
- [fetch](./fetch.md) - Fetch with cache tags
- [unstable_cache](./unstable_cache.md) - Cache functions with tags
- [cacheTag](./cacheTag.md) - Add tags to cache entries
