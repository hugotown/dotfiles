# cacheTag - Tag-Based Cache Invalidation

The `cacheTag` API enables precise cache invalidation in Next.js App Router by allowing you to tag cached content and selectively invalidate it using `revalidateTag`.

## Overview

Cache tags provide a powerful way to organize and invalidate cached content. Instead of invalidating entire caches or specific paths, you can tag related data and invalidate by tag, giving you fine-grained control over cache freshness.

## Basic Usage

### Tagging Cached Content

```typescript
import { cacheTag } from 'next/cache'

'use cache'

export async function getProducts() {
  cacheTag('products')

  const res = await fetch('https://api.example.com/products')
  return res.json()
}
```

### Invalidating Tagged Cache

```typescript
import { revalidateTag } from 'next/cache'

export async function createProduct(data: ProductData) {
  // Save the product
  await saveProduct(data)

  // Invalidate all caches tagged with 'products'
  revalidateTag('products')
}
```

### Multiple Tags

```typescript
import { cacheTag } from 'next/cache'

'use cache'

export async function getProductDetails(id: string) {
  cacheTag('products', `product-${id}`, 'homepage')

  const res = await fetch(`https://api.example.com/products/${id}`)
  return res.json()
}

// Invalidate specific product
revalidateTag(`product-${id}`)

// Or invalidate all products
revalidateTag('products')

// Or invalidate entire homepage
revalidateTag('homepage')
```

## Cache Tag Patterns

### Entity-Based Tagging

```typescript
'use cache'
export async function getUser(userId: string) {
  cacheTag('users', `user-${userId}`)

  const res = await fetch(`/api/users/${userId}`)
  return res.json()
}

'use cache'
export async function getUserPosts(userId: string) {
  cacheTag('posts', `user-${userId}-posts`, `user-${userId}`)

  const res = await fetch(`/api/users/${userId}/posts`)
  return res.json()
}

// Invalidate specific user's data
revalidateTag(`user-${userId}`)

// Or invalidate all users
revalidateTag('users')
```

### Hierarchical Tagging

```typescript
'use cache'
export async function getCategoryProducts(categoryId: string) {
  cacheTag(
    'products',
    `category-${categoryId}`,
    `category-${categoryId}-products`
  )

  const res = await fetch(`/api/categories/${categoryId}/products`)
  return res.json()
}

// Invalidation hierarchy:
revalidateTag('products')                        // All products
revalidateTag(`category-${categoryId}`)         // All category data
revalidateTag(`category-${categoryId}-products`) // Category products only
```

### Feature-Based Tagging

```typescript
'use cache'
export async function getHomePageData() {
  cacheTag('homepage', 'featured-products', 'hero-banner')

  const [products, banner] = await Promise.all([
    fetch('/api/featured-products').then(r => r.json()),
    fetch('/api/hero-banner').then(r => r.json())
  ])

  return { products, banner }
}

// Invalidate by feature
revalidateTag('featured-products')
revalidateTag('hero-banner')
revalidateTag('homepage')
```

### Time-Based Tagging

```typescript
'use cache'
export async function getDailyDeals() {
  const today = new Date().toISOString().split('T')[0]
  cacheTag('deals', `deals-${today}`)

  const res = await fetch('/api/deals')
  return res.json()
}

// Invalidate yesterday's deals
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
revalidateTag(`deals-${yesterday}`)
```

## Advanced Invalidation Strategies

### Cascading Invalidation

```typescript
import { revalidateTag } from 'next/cache'

export async function updateProduct(productId: string, data: ProductData) {
  await saveProduct(productId, data)

  // Cascade invalidation from specific to general
  revalidateTag(`product-${productId}`)     // This product
  revalidateTag('products')                  // All products
  revalidateTag('homepage')                  // Homepage
  revalidateTag('search-results')            // Search results
}
```

### Selective Invalidation

```typescript
export async function updateProductPrice(productId: string, price: number) {
  await saveProductPrice(productId, price)

  // Only invalidate price-related caches
  revalidateTag(`product-${productId}-price`)
  revalidateTag('pricing-data')

  // Don't invalidate product details, reviews, etc.
}

export async function updateProductReview(productId: string, review: Review) {
  await saveReview(productId, review)

  // Only invalidate review-related caches
  revalidateTag(`product-${productId}-reviews`)
  revalidateTag('recent-reviews')
}
```

### Bulk Invalidation

```typescript
export async function bulkUpdateProducts(productIds: string[]) {
  await Promise.all(
    productIds.map(id => updateProduct(id))
  )

  // Invalidate all affected products
  productIds.forEach(id => {
    revalidateTag(`product-${id}`)
  })

  // Also invalidate list views
  revalidateTag('products')
}
```

### Conditional Invalidation

```typescript
export async function updateProductStock(
  productId: string,
  quantity: number
) {
  const previousQuantity = await getProductQuantity(productId)
  await updateQuantity(productId, quantity)

  // Only invalidate if crossing in/out of stock threshold
  const wasInStock = previousQuantity > 0
  const isInStock = quantity > 0

  if (wasInStock !== isInStock) {
    revalidateTag(`product-${productId}`)
    revalidateTag('available-products')
  }
}
```

## Integration with Server Actions

### Server Action Invalidation

```typescript
'use server'

import { revalidateTag } from 'next/cache'

export async function createProductAction(formData: FormData) {
  const product = {
    name: formData.get('name'),
    price: formData.get('price')
  }

  await saveProduct(product)

  // Invalidate after mutation
  revalidateTag('products')
  revalidateTag('homepage')

  return { success: true }
}
```

### Optimistic Updates

```typescript
'use server'

export async function updateProductAction(id: string, data: ProductData) {
  try {
    await updateProduct(id, data)
    revalidateTag(`product-${id}`)
    return { success: true }
  } catch (error) {
    // Don't invalidate on error
    return { success: false, error: error.message }
  }
}
```

## Tag Organization Patterns

### Namespace Pattern

```typescript
// Tag structure: [namespace]:[entity]:[id]
'use cache'
export async function getData() {
  cacheTag(
    'api:products:list',
    'api:products:featured',
    'page:homepage'
  )

  return await fetchData()
}

// Invalidate by namespace
revalidateTag('api:products:list')     // Specific list
revalidateTag('api:products')          // All product APIs (if using prefix matching)
revalidateTag('page:homepage')         // Specific page
```

### Convention-Based Tags

```typescript
interface TagConvention {
  entity: string       // 'product', 'user', 'order'
  id?: string         // specific ID
  relation?: string   // 'comments', 'reviews'
  scope?: string      // 'public', 'admin'
}

function buildTag({ entity, id, relation, scope }: TagConvention): string {
  const parts = [entity]
  if (id) parts.push(id)
  if (relation) parts.push(relation)
  if (scope) parts.push(scope)
  return parts.join('-')
}

'use cache'
export async function getProductReviews(productId: string) {
  const tag = buildTag({
    entity: 'product',
    id: productId,
    relation: 'reviews'
  })

  cacheTag(tag, 'reviews')

  return await fetchReviews(productId)
}

// Invalidate: product-123-reviews
revalidateTag(buildTag({
  entity: 'product',
  id: '123',
  relation: 'reviews'
}))
```

### Domain-Driven Tags

```typescript
// E-commerce domain tags
const TAGS = {
  CATALOG: {
    PRODUCTS: 'catalog:products',
    CATEGORIES: 'catalog:categories',
    BRANDS: 'catalog:brands'
  },
  CUSTOMER: {
    PROFILE: 'customer:profile',
    ORDERS: 'customer:orders',
    WISHLIST: 'customer:wishlist'
  },
  CONTENT: {
    HOMEPAGE: 'content:homepage',
    BLOG: 'content:blog',
    BANNERS: 'content:banners'
  }
} as const

'use cache'
export async function getProducts() {
  cacheTag(TAGS.CATALOG.PRODUCTS)
  return await fetchProducts()
}

// Invalidate using constants
revalidateTag(TAGS.CATALOG.PRODUCTS)
```

## Performance Optimization

### Tag Granularity

```typescript
// ❌ Too granular - many tags
'use cache'
export async function getProduct(id: string) {
  cacheTag(
    'product',
    `product-${id}`,
    `product-${id}-name`,
    `product-${id}-price`,
    `product-${id}-description`,
    `product-${id}-images`
  )
  return await fetchProduct(id)
}

// ✅ Optimal granularity
'use cache'
export async function getProduct(id: string) {
  cacheTag('products', `product-${id}`)
  return await fetchProduct(id)
}

// Use separate functions for different aspects
'use cache'
export async function getProductPricing(id: string) {
  cacheTag('pricing', `product-${id}-pricing`)
  return await fetchPricing(id)
}
```

### Batch Tagging

```typescript
'use cache'
export async function getMultipleProducts(ids: string[]) {
  const tags = ['products', ...ids.map(id => `product-${id}`)]
  tags.forEach(tag => cacheTag(tag))

  return await fetchProducts(ids)
}
```

### Smart Invalidation

```typescript
// Track what actually changed
export async function updateProduct(id: string, changes: Partial<Product>) {
  await saveProduct(id, changes)

  // Only invalidate affected caches
  const tagsToInvalidate = [`product-${id}`]

  if (changes.price) {
    tagsToInvalidate.push('pricing')
  }

  if (changes.stock) {
    tagsToInvalidate.push('availability')
  }

  if (changes.featured) {
    tagsToInvalidate.push('featured-products')
  }

  tagsToInvalidate.forEach(tag => revalidateTag(tag))
}
```

## Common Use Cases

### E-commerce Product Management

```typescript
'use cache'
export async function getProductDetails(id: string) {
  cacheTag('products', `product-${id}`)
  return await fetchProduct(id)
}

export async function updateProductDetails(id: string, data: ProductData) {
  await saveProduct(id, data)

  revalidateTag(`product-${id}`)
  revalidateTag('products')
  revalidateTag('homepage')
  revalidateTag('search-index')
}
```

### Blog/CMS Content

```typescript
'use cache'
export async function getBlogPost(slug: string) {
  cacheTag('blog', `post-${slug}`)
  return await fetchPost(slug)
}

export async function publishPost(slug: string) {
  await publishPostToDB(slug)

  revalidateTag(`post-${slug}`)
  revalidateTag('blog')
  revalidateTag('blog-index')
  revalidateTag('recent-posts')
}
```

### User-Generated Content

```typescript
'use cache'
export async function getComments(postId: string) {
  cacheTag('comments', `post-${postId}-comments`)
  return await fetchComments(postId)
}

export async function addComment(postId: string, comment: Comment) {
  await saveComment(postId, comment)

  revalidateTag(`post-${postId}-comments`)
  revalidateTag('recent-comments')
}
```

### Multi-Tenant Applications

```typescript
'use cache'
export async function getTenantData(tenantId: string) {
  cacheTag('tenants', `tenant-${tenantId}`)
  return await fetchTenantData(tenantId)
}

export async function updateTenantSettings(tenantId: string, settings: Settings) {
  await saveSettings(tenantId, settings)

  // Only invalidate this tenant's cache
  revalidateTag(`tenant-${tenantId}`)
}
```

## Debugging Cache Tags

### Log Tagged Caches

```typescript
'use cache'
export async function debugTaggedCache() {
  const tags = ['products', 'featured', 'homepage']
  console.log('Applying cache tags:', tags)

  tags.forEach(tag => cacheTag(tag))

  return await fetchData()
}
```

### Track Invalidation

```typescript
export async function trackedInvalidation(tag: string) {
  console.log(`[Cache Invalidation] Invalidating tag: ${tag}`)
  console.log(`[Cache Invalidation] Timestamp: ${new Date().toISOString()}`)

  revalidateTag(tag)

  console.log(`[Cache Invalidation] Tag ${tag} invalidated`)
}
```

### Validate Tag Usage

```typescript
const VALID_TAGS = new Set(['products', 'users', 'posts', 'comments'])

function validateTag(tag: string) {
  if (!VALID_TAGS.has(tag) && !tag.match(/^(product|user|post|comment)-\d+$/)) {
    console.warn(`Invalid cache tag used: ${tag}`)
  }
}

export function safeRevalidateTag(tag: string) {
  validateTag(tag)
  revalidateTag(tag)
}
```

## Best Practices

1. **Use consistent naming**: Establish tag naming conventions
2. **Tag hierarchically**: Enable granular and broad invalidation
3. **Don't over-tag**: Each tag adds complexity
4. **Document tag strategy**: Explain tag organization
5. **Centralize tag definitions**: Use constants or enums
6. **Invalidate conservatively**: Only invalidate what changed
7. **Test invalidation**: Verify caches update correctly
8. **Monitor tag usage**: Track invalidation patterns

## Common Pitfalls

### 1. Forgetting to Tag

```typescript
// ❌ Wrong - cached but can't be invalidated
'use cache'
export async function getProducts() {
  return await fetchProducts()
}

// ✅ Correct - tagged for invalidation
'use cache'
export async function getProducts() {
  cacheTag('products')
  return await fetchProducts()
}
```

### 2. Inconsistent Tag Names

```typescript
// ❌ Wrong - inconsistent naming
cacheTag('products')
cacheTag('Products')
cacheTag('PRODUCTS')
revalidateTag('product') // Won't match!

// ✅ Correct - consistent naming
const TAGS = {
  PRODUCTS: 'products'
} as const

cacheTag(TAGS.PRODUCTS)
revalidateTag(TAGS.PRODUCTS)
```

### 3. Over-Invalidation

```typescript
// ❌ Wrong - invalidates too much
export async function updateProductPrice(id: string, price: number) {
  await savePrice(id, price)
  revalidateTag('products') // Invalidates ALL products!
}

// ✅ Correct - targeted invalidation
export async function updateProductPrice(id: string, price: number) {
  await savePrice(id, price)
  revalidateTag(`product-${id}`)
  revalidateTag('pricing')
}
```

## Related

- See `use-cache.md` for basic caching
- See `cache-lifecycle.md` for cache expiration
- See `isr.md` for time-based revalidation
- See `cache-private.md` for user-specific tagging
