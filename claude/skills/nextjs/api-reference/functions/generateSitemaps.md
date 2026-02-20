# generateSitemaps

The `generateSitemaps()` function generates multiple sitemaps for your application, useful for large sites that exceed the 50,000 URL sitemap limit.

## Function Signature

```typescript
export async function generateSitemaps(): Promise<{ id: string | number }[]>
```

## Return Value

Returns an array of objects with an `id` field that uniquely identifies each sitemap.

## Usage with sitemap.ts

This function works in conjunction with `sitemap.ts` to generate multiple sitemap files.

## File Structure

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export async function generateSitemaps() {
  // Generate list of sitemap IDs
  return [
    { id: 0 },
    { id: 1 },
    { id: 2 }
  ]
}

export default async function sitemap({
  id
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  // Generate URLs for this sitemap based on id
  const start = id * 50000
  const end = start + 50000
  const posts = await getPosts(start, end)

  return posts.map((post) => ({
    url: `https://example.com/posts/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8
  }))
}
```

## Usage Examples

### Basic Multi-Sitemap Setup

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export async function generateSitemaps() {
  const totalPosts = await getPostCount()
  const sitemapsNeeded = Math.ceil(totalPosts / 50000)

  return Array.from({ length: sitemapsNeeded }, (_, i) => ({
    id: i
  }))
}

export default async function sitemap({
  id
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  const start = id * 50000
  const end = start + 50000
  const posts = await getPosts(start, end)

  return posts.map((post) => ({
    url: `https://example.com/posts/${post.slug}`,
    lastModified: post.updatedAt
  }))
}
```

### Category-Based Sitemaps

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export async function generateSitemaps() {
  const categories = await getCategories()

  return categories.map((category) => ({
    id: category.slug
  }))
}

export default async function sitemap({
  id
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  const posts = await getPostsByCategory(id)

  return posts.map((post) => ({
    url: `https://example.com/${id}/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'daily',
    priority: 0.7
  }))
}
```

### E-commerce Product Sitemaps

```typescript
// app/product-sitemap.ts
import { MetadataRoute } from 'next'

export async function generateSitemaps() {
  const productCount = await db.product.count({
    where: { published: true }
  })

  const sitemapCount = Math.ceil(productCount / 50000)

  return Array.from({ length: sitemapCount }, (_, i) => ({
    id: i
  }))
}

export default async function sitemap({
  id
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  const products = await db.product.findMany({
    where: { published: true },
    skip: id * 50000,
    take: 50000,
    select: {
      slug: true,
      updatedAt: true,
      category: true
    }
  })

  return products.map((product) => ({
    url: `https://shop.com/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8
  }))
}
```

### Multi-Language Sitemaps

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

const languages = ['en', 'es', 'fr', 'de']

export async function generateSitemaps() {
  return languages.map((lang) => ({
    id: lang
  }))
}

export default async function sitemap({
  id
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  const posts = await getPostsByLanguage(id)

  return posts.map((post) => ({
    url: `https://example.com/${id}/${post.slug}`,
    lastModified: post.updatedAt,
    alternates: {
      languages: Object.fromEntries(
        languages.map((lang) => [
          lang,
          `https://example.com/${lang}/${post.slug}`
        ])
      )
    }
  }))
}
```

### Content Type Sitemaps

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

const contentTypes = ['posts', 'pages', 'products', 'categories']

export async function generateSitemaps() {
  return contentTypes.map((type) => ({
    id: type
  }))
}

export default async function sitemap({
  id
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case 'posts':
      const posts = await getPosts()
      return posts.map((post) => ({
        url: `https://example.com/posts/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8
      }))

    case 'pages':
      const pages = await getPages()
      return pages.map((page) => ({
        url: `https://example.com/${page.slug}`,
        lastModified: page.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.6
      }))

    case 'products':
      const products = await getProducts()
      return products.map((product) => ({
        url: `https://example.com/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'daily',
        priority: 0.9
      }))

    case 'categories':
      const categories = await getCategories()
      return categories.map((category) => ({
        url: `https://example.com/categories/${category.slug}`,
        lastModified: category.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7
      }))

    default:
      return []
  }
}
```

### With Pagination

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

const ITEMS_PER_SITEMAP = 10000

export async function generateSitemaps() {
  const total = await db.article.count()
  const count = Math.ceil(total / ITEMS_PER_SITEMAP)

  return Array.from({ length: count }, (_, i) => ({ id: i }))
}

export default async function sitemap({
  id
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  const articles = await db.article.findMany({
    skip: id * ITEMS_PER_SITEMAP,
    take: ITEMS_PER_SITEMAP,
    where: { published: true },
    select: { slug: true, updatedAt: true }
  })

  return articles.map((article) => ({
    url: `https://blog.com/${article.slug}`,
    lastModified: article.updatedAt
  }))
}
```

### News Sitemap

```typescript
// app/news-sitemap.ts
import { MetadataRoute } from 'next'

export async function generateSitemaps() {
  // Separate by date ranges
  const today = new Date()
  const ranges = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    ranges.push({
      id: date.toISOString().split('T')[0] // YYYY-MM-DD
    })
  }

  return ranges
}

export default async function sitemap({
  id
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  const date = new Date(id)
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + 1)

  const articles = await db.article.findMany({
    where: {
      publishedAt: {
        gte: date,
        lt: nextDate
      }
    }
  })

  return articles.map((article) => ({
    url: `https://news.com/${article.slug}`,
    lastModified: article.publishedAt,
    changeFrequency: 'hourly',
    priority: 1.0
  }))
}
```

### Geographic Sitemaps

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

const regions = ['us', 'eu', 'asia', 'latam']

export async function generateSitemaps() {
  return regions.map((region) => ({
    id: region
  }))
}

export default async function sitemap({
  id
}: {
  id: string
}): Promise<MetadataRoute.Sitemap> {
  const locations = await getLocationsByRegion(id)

  return locations.map((location) => ({
    url: `https://example.com/${id}/${location.slug}`,
    lastModified: location.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7
  }))
}
```

## Sitemap Metadata Type

```typescript
type MetadataRoute.Sitemap = Array<{
  url: string
  lastModified?: string | Date
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
  priority?: number  // 0.0 to 1.0
  alternates?: {
    languages?: Record<string, string>
  }
}>
```

## Best Practices

1. **Stay Under URL Limit**
   ```typescript
   // Keep each sitemap under 50,000 URLs
   const URLS_PER_SITEMAP = 50000

   export async function generateSitemaps() {
     const total = await getCount()
     const count = Math.ceil(total / URLS_PER_SITEMAP)
     return Array.from({ length: count }, (_, i) => ({ id: i }))
   }
   ```

2. **Use Meaningful IDs**
   ```typescript
   // ✅ Descriptive IDs
   return [
     { id: 'blog' },
     { id: 'products' },
     { id: 'pages' }
   ]

   // ❌ Non-descriptive
   return [
     { id: 0 },
     { id: 1 },
     { id: 2 }
   ]
   ```

3. **Set Appropriate Priorities**
   ```typescript
   return posts.map((post) => ({
     url: `https://example.com/${post.slug}`,
     priority: post.featured ? 1.0 : 0.7
   }))
   ```

4. **Include Last Modified Dates**
   ```typescript
   return items.map((item) => ({
     url: `https://example.com/${item.slug}`,
     lastModified: item.updatedAt  // Important for SEO
   }))
   ```

5. **Handle Errors**
   ```typescript
   export async function generateSitemaps() {
     try {
       const count = await getCount()
       return Array.from({ length: count }, (_, i) => ({ id: i }))
     } catch (error) {
       console.error('Sitemap generation error:', error)
       return [{ id: 0 }]  // Fallback
     }
   }
   ```

## URL Generation

The generated sitemaps will be available at:
- `/sitemap/[id].xml`

For example:
- `/sitemap/0.xml`
- `/sitemap/1.xml`
- `/sitemap/blog.xml`
- `/sitemap/products.xml`

## Notes

- Used for sites with more than 50,000 URLs
- Works with `sitemap.ts` file
- Generates multiple sitemap files
- Each sitemap can contain up to 50,000 URLs
- IDs can be strings or numbers
- Sitemaps are generated at build time
- URLs are automatically added to robots.txt

## Related

- [Sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) - Single sitemap configuration
- [robots.txt](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots) - Robots file
- [generateStaticParams](./generateStaticParams.md) - Generate static params
