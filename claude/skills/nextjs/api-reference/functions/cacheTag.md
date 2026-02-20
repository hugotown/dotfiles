# cacheTag

The `cacheTag()` function allows you to tag cached content for granular cache invalidation using `revalidateTag()`.

## Function Signature

```typescript
import { cacheTag } from 'next/cache'

function cacheTag(tag: string): void
function cacheTag(...tags: string[]): void
```

## Parameters

### `tag` or `...tags`
- **Type**: `string` or `string[]`
- **Description**: One or more cache tags to associate with the cached content

## Usage Examples

### Basic Tag Usage

```typescript
import { cacheTag } from 'next/cache'

export async function getPosts() {
  'use cache'
  cacheTag('posts')

  return await db.post.findMany()
}
```

### Multiple Tags

```typescript
import { cacheTag } from 'next/cache'

export async function getPost(id: string) {
  'use cache'
  cacheTag('posts', `post-${id}`)

  return await db.post.findUnique({
    where: { id }
  })
}
```

### Hierarchical Tagging

```typescript
import { cacheTag } from 'next/cache'

export async function getProduct(id: string, categoryId: string) {
  'use cache'
  cacheTag(
    'products',              // All products
    `product-${id}`,         // Specific product
    `category-${categoryId}` // Category products
  )

  return await db.product.findUnique({
    where: { id }
  })
}
```

### With unstable_cache

```typescript
import { unstable_cache, cacheTag } from 'next/cache'

const getCachedData = unstable_cache(
  async (id: string) => {
    cacheTag('data', `data-${id}`)
    return await fetchData(id)
  },
  ['data-cache'],
  { tags: ['data'] }
)
```

### In Server Components

```typescript
// app/posts/[id]/page.tsx
import { cacheTag } from 'next/cache'

async function getPost(id: string) {
  'use cache'
  cacheTag('posts', `post-${id}`)

  const res = await fetch(`https://api.example.com/posts/${id}`)
  return res.json()
}

export default async function PostPage({
  params
}: {
  params: { id: string }
}) {
  const post = await getPost(params.id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

### E-commerce Product

```typescript
import { cacheTag } from 'next/cache'

export async function getProduct(productId: string) {
  'use cache'

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { category: true, brand: true }
  })

  cacheTag(
    'products',
    `product-${productId}`,
    `category-${product.categoryId}`,
    `brand-${product.brandId}`
  )

  return product
}
```

### User-Specific Content

```typescript
import { cacheTag } from 'next/cache'

export async function getUserDashboard(userId: string) {
  'use cache'
  cacheTag('dashboards', `user-${userId}`)

  return await db.user.findUnique({
    where: { id: userId },
    include: {
      posts: true,
      comments: true
    }
  })
}
```

### Blog Posts with Author

```typescript
import { cacheTag } from 'next/cache'

export async function getBlogPost(slug: string) {
  'use cache'

  const post = await db.post.findUnique({
    where: { slug },
    include: { author: true }
  })

  cacheTag(
    'posts',
    `post-${post.id}`,
    `author-${post.authorId}`,
    `slug-${slug}`
  )

  return post
}
```

### Related Content Tagging

```typescript
import { cacheTag } from 'next/cache'

export async function getArticleWithRelated(id: string) {
  'use cache'

  const article = await db.article.findUnique({
    where: { id },
    include: { relatedArticles: true }
  })

  const tags = [
    'articles',
    `article-${id}`,
    ...article.relatedArticles.map(a => `article-${a.id}`)
  ]

  cacheTag(...tags)

  return article
}
```

### Collection and Item Tagging

```typescript
import { cacheTag } from 'next/cache'

export async function getPlaylist(id: string) {
  'use cache'

  const playlist = await db.playlist.findUnique({
    where: { id },
    include: { songs: true }
  })

  cacheTag(
    'playlists',           // All playlists
    `playlist-${id}`,      // This playlist
    'songs',               // All songs
    ...playlist.songs.map(s => `song-${s.id}`) // Each song
  )

  return playlist
}
```

### Revalidation Example

```typescript
// Cache with tags
import { cacheTag } from 'next/cache'

export async function getPost(id: string) {
  'use cache'
  cacheTag('posts', `post-${id}`)

  return await db.post.findUnique({ where: { id } })
}

// Revalidate by tag
'use server'

import { revalidateTag } from 'next/cache'

export async function updatePost(id: string, data: any) {
  await db.post.update({ where: { id }, data })

  // Revalidate using the tags
  revalidateTag(`post-${id}`)  // Specific post
  revalidateTag('posts')        // All posts
}
```

### Dynamic Tag Generation

```typescript
import { cacheTag } from 'next/cache'

export async function getFilteredProducts(filters: {
  category?: string
  brand?: string
  priceRange?: string
}) {
  'use cache'

  const tags = ['products']

  if (filters.category) tags.push(`category-${filters.category}`)
  if (filters.brand) tags.push(`brand-${filters.brand}`)
  if (filters.priceRange) tags.push(`price-${filters.priceRange}`)

  cacheTag(...tags)

  return await db.product.findMany({ where: filters })
}
```

### Nested Resource Tagging

```typescript
import { cacheTag } from 'next/cache'

export async function getComment(commentId: string) {
  'use cache'

  const comment = await db.comment.findUnique({
    where: { id: commentId },
    include: {
      post: true,
      author: true
    }
  })

  cacheTag(
    'comments',
    `comment-${commentId}`,
    `post-${comment.postId}`,
    `user-${comment.authorId}`
  )

  return comment
}
```

### Search Results Tagging

```typescript
import { cacheTag } from 'next/cache'

export async function searchPosts(query: string) {
  'use cache'
  cacheTag('posts', `search-${query}`)

  return await db.post.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { content: { contains: query } }
      ]
    }
  })
}
```

## Best Practices

1. **Use Descriptive Tag Names**
   ```typescript
   // ✅ Clear and descriptive
   cacheTag('posts', `post-${id}`, `author-${authorId}`)

   // ❌ Vague
   cacheTag('data', 'item', 'thing')
   ```

2. **Tag at Multiple Levels**
   ```typescript
   // Tag both collection and item
   cacheTag(
     'products',        // Revalidate all products
     `product-${id}`    // Revalidate specific product
   )
   ```

3. **Include Related Resource Tags**
   ```typescript
   cacheTag(
     'posts',
     `post-${post.id}`,
     `author-${post.authorId}`,
     `category-${post.categoryId}`
   )
   ```

4. **Use Consistent Naming Convention**
   ```typescript
   // Establish a pattern
   const TAGS = {
     allProducts: 'products',
     product: (id: string) => `product-${id}`,
     category: (id: string) => `category-${id}`
   }

   cacheTag(
     TAGS.allProducts,
     TAGS.product(productId),
     TAGS.category(categoryId)
   )
   ```

5. **Don't Over-Tag**
   ```typescript
   // ❌ Too many tags can make invalidation complex
   cacheTag('tag1', 'tag2', 'tag3', 'tag4', 'tag5', ...)

   // ✅ Use meaningful, necessary tags
   cacheTag('posts', `post-${id}`)
   ```

6. **Combine with cacheLife**
   ```typescript
   import { cacheTag, cacheLife } from 'next/cache'

   export async function getData() {
     'use cache'
     cacheLife('hours')
     cacheTag('data', 'api-data')

     return await fetchData()
   }
   ```

## Common Tagging Patterns

### CRUD Operations

```typescript
// Collection tag + Item tag
cacheTag('items', `item-${id}`)

// Invalidate on update
revalidateTag(`item-${id}`)
revalidateTag('items')
```

### Nested Resources

```typescript
// Tag hierarchy: collection > item > nested
cacheTag(
  'posts',
  `post-${postId}`,
  'comments',
  `comment-${commentId}`
)
```

### User-Specific Data

```typescript
// User-scoped tags
cacheTag(
  `user-${userId}`,
  `user-${userId}-posts`,
  `user-${userId}-settings`
)
```

### Feature-Based Tags

```typescript
// Group by feature
cacheTag(
  'homepage',
  'featured-products',
  'trending-posts'
)
```

## Tag Naming Conventions

```typescript
// Collections (plural)
'posts'
'products'
'users'

// Individual items
`post-${id}`
`product-${id}`
`user-${id}`

// Relationships
`author-${authorId}`
`category-${categoryId}`
`brand-${brandId}`

// Features
'homepage'
'navigation'
'featured'

// User-specific
`user-${userId}-dashboard`
`user-${userId}-cart`
```

## Notes

- Must be used with `'use cache'` directive
- Tags are case-sensitive
- Use with `revalidateTag()` for invalidation
- Supports multiple tags per cache entry
- Tags enable granular cache control
- Works with `unstable_cache`
- Part of Next.js caching API
- Experimental feature

## Related

- [revalidateTag](./revalidateTag.md) - Invalidate by tag
- [cacheLife](./cacheLife.md) - Set cache duration
- [unstable_cache](./unstable_cache.md) - Cache function results
- [fetch](./fetch.md) - Fetch with cache tags
