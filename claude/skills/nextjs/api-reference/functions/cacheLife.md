# cacheLife

The `cacheLife()` function allows you to set custom cache lifetimes for different cache profiles in your Next.js application.

## Function Signature

```typescript
import { cacheLife } from 'next/cache'

function cacheLife(profile: CacheLifeProfile): void

type CacheLifeProfile =
  | 'default'
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'max'
```

## Predefined Profiles

Next.js provides several predefined cache life profiles:

```typescript
{
  default: { stale: 900, revalidate: 3600, expire: 86400 },      // 15m, 1h, 1d
  seconds: { stale: 1, revalidate: 10, expire: 60 },              // 1s, 10s, 1m
  minutes: { stale: 60, revalidate: 600, expire: 3600 },          // 1m, 10m, 1h
  hours: { stale: 3600, revalidate: 7200, expire: 86400 },        // 1h, 2h, 1d
  days: { stale: 86400, revalidate: 172800, expire: 604800 },     // 1d, 2d, 7d
  weeks: { stale: 604800, revalidate: 1209600, expire: 2592000 }, // 7d, 14d, 30d
  max: { stale: Infinity, revalidate: Infinity, expire: Infinity }
}
```

## Cache Life Terms

- **stale**: Duration in seconds before the cache is considered stale
- **revalidate**: Duration in seconds before background revalidation
- **expire**: Duration in seconds before the cache entry is deleted

## Usage Examples

### Basic Usage

```typescript
import { cacheLife } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheLife('hours')

  const products = await db.product.findMany()
  return products
}
```

### Using with unstable_cache

```typescript
import { unstable_cache, cacheLife } from 'next/cache'

const getCachedPosts = unstable_cache(
  async () => {
    cacheLife('days')
    return await db.post.findMany()
  },
  ['posts'],
  { tags: ['posts'] }
)
```

### Different Profiles for Different Data

```typescript
import { cacheLife } from 'next/cache'

// Fast-changing data
export async function getStockPrices() {
  'use cache'
  cacheLife('seconds')

  return await fetchStockPrices()
}

// Moderate-changing data
export async function getBlogPosts() {
  'use cache'
  cacheLife('hours')

  return await db.post.findMany()
}

// Slow-changing data
export async function getStaticPages() {
  'use cache'
  cacheLife('weeks')

  return await db.page.findMany()
}

// Never-changing data
export async function getLegalDocuments() {
  'use cache'
  cacheLife('max')

  return await db.legal.findMany()
}
```

### Custom Cache Profile

```typescript
import { unstable_cacheLife as cacheLife } from 'next/cache'

// Define custom profile
export async function getData() {
  'use cache'

  cacheLife({
    stale: 300,      // 5 minutes stale
    revalidate: 600, // 10 minutes revalidate
    expire: 3600     // 1 hour expire
  })

  return await fetchData()
}
```

### In Server Components

```typescript
// app/products/page.tsx
import { cacheLife } from 'next/cache'

async function getProducts() {
  'use cache'
  cacheLife('hours')

  const res = await fetch('https://api.example.com/products')
  return res.json()
}

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

### Real-time Data

```typescript
import { cacheLife } from 'next/cache'

export async function getLiveScores() {
  'use cache'
  cacheLife('seconds')  // Cache for just seconds

  return await fetchLiveScores()
}
```

### Static Content

```typescript
import { cacheLife } from 'next/cache'

export async function getAboutPage() {
  'use cache'
  cacheLife('max')  // Cache forever

  return await db.page.findUnique({ where: { slug: 'about' } })
}
```

### Conditional Caching

```typescript
import { cacheLife } from 'next/cache'

export async function getContent(type: string) {
  'use cache'

  // Different cache durations based on content type
  switch (type) {
    case 'news':
      cacheLife('minutes')
      break
    case 'blog':
      cacheLife('hours')
      break
    case 'docs':
      cacheLife('days')
      break
    default:
      cacheLife('default')
  }

  return await fetchContent(type)
}
```

### E-commerce Inventory

```typescript
import { cacheLife } from 'next/cache'

export async function getProductInventory(productId: string) {
  'use cache'
  cacheLife('seconds')  // Frequently changing

  return await db.inventory.findUnique({
    where: { productId }
  })
}

export async function getProductDetails(productId: string) {
  'use cache'
  cacheLife('hours')  // Less frequently changing

  return await db.product.findUnique({
    where: { id: productId }
  })
}
```

### API Integration

```typescript
import { cacheLife } from 'next/cache'

export async function getWeatherData(city: string) {
  'use cache'
  cacheLife('minutes')  // Weather updates frequently

  const res = await fetch(
    `https://api.weather.com/data/${city}`
  )
  return res.json()
}
```

### User-Specific Data

```typescript
import { cacheLife } from 'next/cache'

export async function getUserDashboard(userId: string) {
  'use cache'
  cacheLife({
    stale: 60,       // 1 minute stale
    revalidate: 300, // 5 minutes revalidate
    expire: 900      // 15 minutes expire
  })

  return await db.user.findUnique({
    where: { id: userId },
    include: { posts: true, comments: true }
  })
}
```

## Best Practices

1. **Choose Appropriate Profile**
   ```typescript
   // ✅ Match cache duration to data volatility
   cacheLife('seconds')  // Real-time data
   cacheLife('minutes')  // Frequently updated
   cacheLife('hours')    // Moderately updated
   cacheLife('days')     // Rarely updated
   cacheLife('weeks')    // Very stable
   cacheLife('max')      // Static content
   ```

2. **Use with 'use cache' Directive**
   ```typescript
   export async function getData() {
     'use cache'  // Required
     cacheLife('hours')

     return await fetchData()
   }
   ```

3. **Consider Data Freshness Requirements**
   ```typescript
   // Critical real-time data
   export async function getStockPrice() {
     'use cache'
     cacheLife('seconds')
     return await fetchPrice()
   }

   // Less critical data
   export async function getCompanyInfo() {
     'use cache'
     cacheLife('days')
     return await fetchInfo()
   }
   ```

4. **Custom Profiles for Specific Needs**
   ```typescript
   // Fine-tuned caching
   cacheLife({
     stale: 120,      // 2 minutes
     revalidate: 300, // 5 minutes
     expire: 600      // 10 minutes
   })
   ```

5. **Combine with Cache Tags**
   ```typescript
   import { unstable_cache, cacheLife } from 'next/cache'

   const getData = unstable_cache(
     async () => {
       cacheLife('hours')
       return await fetchData()
     },
     ['data-key'],
     { tags: ['data'] }
   )
   ```

## Profile Comparison

| Profile   | Stale    | Revalidate | Expire    | Use Case                |
|-----------|----------|------------|-----------|-------------------------|
| seconds   | 1s       | 10s        | 1m        | Real-time data          |
| minutes   | 1m       | 10m        | 1h        | Frequently updated      |
| hours     | 1h       | 2h         | 1d        | Moderately updated      |
| days      | 1d       | 2d         | 7d        | Rarely updated          |
| weeks     | 7d       | 14d        | 30d       | Very stable data        |
| max       | ∞        | ∞          | ∞         | Static content          |
| default   | 15m      | 1h         | 1d        | General purpose         |

## Common Patterns

### API Data Caching

```typescript
import { cacheLife } from 'next/cache'

export async function getExternalData() {
  'use cache'
  cacheLife('hours')

  const res = await fetch('https://api.example.com/data')
  return res.json()
}
```

### Database Query Caching

```typescript
import { cacheLife } from 'next/cache'

export async function getUsers() {
  'use cache'
  cacheLife('minutes')

  return await db.user.findMany()
}
```

### Mixed Cache Strategies

```typescript
// Frequently changing
export async function getActiveUsers() {
  'use cache'
  cacheLife('seconds')
  return await db.user.count({ where: { online: true } })
}

// Moderately changing
export async function getPosts() {
  'use cache'
  cacheLife('hours')
  return await db.post.findMany()
}

// Rarely changing
export async function getCategories() {
  'use cache'
  cacheLife('days')
  return await db.category.findMany()
}
```

## Notes

- Must be used with `'use cache'` directive
- Provides predefined cache duration profiles
- Can define custom cache durations
- Works with `unstable_cache`
- Cache durations are in seconds
- Stale-While-Revalidate (SWR) pattern
- Part of the Next.js caching API
- Experimental feature

## Related

- [unstable_cache](./unstable_cache.md) - Cache function results
- [cacheTag](./cacheTag.md) - Tag cached content
- [revalidateTag](./revalidateTag.md) - Revalidate by tag
- [fetch](./fetch.md) - Fetch with caching
