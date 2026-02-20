# Cache Components

Cache Components use the `'use cache'` directive to cache component output, enabling efficient mixing of static and dynamic content. This feature allows you to cache expensive computations while keeping parts of your application dynamic.

## The 'use cache' Directive

The `'use cache'` directive marks a component's output for caching, similar to how `'use client'` marks components for client-side execution.

```tsx
'use cache'

async function ExpensiveComponent() {
  // This expensive operation runs once and is cached
  const data = await performExpensiveCalculation()

  return <div>{data}</div>
}
```

## How Cache Components Work

Cache Components render once and store the result, reusing it for subsequent requests.

```
First Request:
1. Component renders
2. Output is cached
3. Result sent to client

Subsequent Requests:
1. Cached output returned immediately
2. No re-rendering needed
3. Much faster response
```

## Basic Usage

### Simple Cached Component

```tsx
'use cache'

async function ProductList() {
  // Expensive database query
  const products = await db.product.findMany({
    include: { category: true, reviews: true }
  })

  return (
    <div className="products">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

### Cache Duration

Control how long content is cached.

```tsx
'use cache'

export const revalidate = 3600 // Cache for 1 hour

async function NewsList() {
  const news = await fetchNews()

  return (
    <div>
      {news.map(article => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  )
}
```

## Mixing Static and Dynamic Content

Cache Components excel at mixing cached and dynamic content in the same page.

### Pattern 1: Cached List with Dynamic Actions

```tsx
// page.tsx
export default function ProductsPage() {
  return (
    <div>
      <h1>Products</h1>

      {/* Cached: Product list */}
      <CachedProductList />

      {/* Dynamic: User-specific cart */}
      <UserCart />
    </div>
  )
}

// cached-product-list.tsx
'use cache'

export async function CachedProductList() {
  const products = await db.product.findMany()

  return (
    <div className="grid">
      {products.map(product => (
        <div key={product.id}>
          <h2>{product.name}</h2>
          <p>${product.price}</p>

          {/* Dynamic: Add to cart button */}
          <AddToCartButton productId={product.id} />
        </div>
      ))}
    </div>
  )
}

// add-to-cart-button.tsx (Client Component)
'use client'

export function AddToCartButton({ productId }: { productId: string }) {
  const handleAdd = async () => {
    await addToCart(productId)
  }

  return <button onClick={handleAdd}>Add to Cart</button>
}
```

### Pattern 2: Cached Content with Dynamic Metadata

```tsx
// page.tsx
export default function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  return (
    <article>
      {/* Cached: Article content */}
      <CachedArticle slug={params.slug} />

      {/* Dynamic: View count updates in real-time */}
      <ViewCount slug={params.slug} />

      {/* Dynamic: User's bookmark status */}
      <BookmarkButton slug={params.slug} />
    </article>
  )
}

// cached-article.tsx
'use cache'

export const revalidate = 600 // 10 minutes

export async function CachedArticle({ slug }: { slug: string }) {
  const article = await db.article.findUnique({
    where: { slug },
    include: { author: true }
  })

  return (
    <div>
      <h1>{article.title}</h1>
      <p>By {article.author.name}</p>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </div>
  )
}
```

### Pattern 3: Nested Caching

Different cache durations for different components.

```tsx
// page.tsx
export default function Dashboard() {
  return (
    <div>
      {/* Cached for 5 minutes */}
      <QuickStats />

      {/* Cached for 1 hour */}
      <MonthlyReport />

      {/* Cached for 24 hours */}
      <HistoricalTrends />

      {/* Not cached - always fresh */}
      <RealTimeActivity />
    </div>
  )
}

// quick-stats.tsx
'use cache'

export const revalidate = 300 // 5 minutes

export async function QuickStats() {
  const stats = await fetchRecentStats()
  return <StatsDisplay stats={stats} />
}

// monthly-report.tsx
'use cache'

export const revalidate = 3600 // 1 hour

export async function MonthlyReport() {
  const report = await generateMonthlyReport()
  return <ReportView report={report} />
}

// historical-trends.tsx
'use cache'

export const revalidate = 86400 // 24 hours

export async function HistoricalTrends() {
  const trends = await calculateHistoricalTrends()
  return <TrendsChart data={trends} />
}

// real-time-activity.tsx (no cache)
export async function RealTimeActivity() {
  const activity = await fetchLiveActivity()
  return <ActivityFeed items={activity} />
}
```

## Cache Keys and Invalidation

### Automatic Cache Keys

Cache keys are automatically generated from component props.

```tsx
'use cache'

// Different props = different cache entries
export async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId)

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  )
}

// These create separate cache entries:
<UserProfile userId="1" /> // Cache key: userId=1
<UserProfile userId="2" /> // Cache key: userId=2
```

### Manual Cache Invalidation

Use `revalidatePath` or `revalidateTag` to invalidate cached content.

```tsx
// actions.ts
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

export async function updateProduct(productId: string, data: any) {
  await db.product.update({
    where: { id: productId },
    data
  })

  // Invalidate specific path
  revalidatePath('/products')

  // Or invalidate by tag
  revalidateTag('products')
}

// cached-component.tsx
'use cache'

export const tags = ['products']

export async function ProductList() {
  const products = await db.product.findMany()
  return <div>{/* ... */}</div>
}
```

## Use Cases

### 1. E-commerce Product Listings

Cache product listings while keeping cart dynamic.

```tsx
'use cache'

export const revalidate = 1800 // 30 minutes
export const tags = ['products']

export async function ProductGrid({ category }: { category: string }) {
  const products = await db.product.findMany({
    where: { category },
    include: { images: true, reviews: true }
  })

  return (
    <div className="grid">
      {products.map(product => (
        <div key={product.id} className="product-card">
          <img src={product.images[0].url} alt={product.name} />
          <h3>{product.name}</h3>
          <p>${product.price}</p>
          <p>⭐ {product.avgRating}/5 ({product.reviewCount} reviews)</p>

          {/* Dynamic: User-specific actions */}
          <ProductActions productId={product.id} />
        </div>
      ))}
    </div>
  )
}
```

### 2. Blog Posts with Dynamic Engagement

Cache article content while keeping engagement features dynamic.

```tsx
'use cache'

export const revalidate = 600 // 10 minutes
export const tags = ['blog-posts']

export async function BlogPostContent({ slug }: { slug: string }) {
  const post = await db.post.findUnique({
    where: { slug },
    include: {
      author: true,
      category: true
    }
  })

  return (
    <article>
      <header>
        <h1>{post.title}</h1>
        <div className="meta">
          <span>By {post.author.name}</span>
          <span>{post.category.name}</span>
          <time>{post.publishedAt.toLocaleDateString()}</time>
        </div>
      </header>

      <div
        className="content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* Dynamic components below */}
    </article>
  )
}

// Usage in page
export default function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  return (
    <div>
      {/* Cached content */}
      <BlogPostContent slug={params.slug} />

      {/* Dynamic engagement */}
      <LikeButton postSlug={params.slug} />
      <ShareButtons postSlug={params.slug} />
      <CommentForm postSlug={params.slug} />
    </div>
  )
}
```

### 3. Dashboard with Mixed Data Freshness

Different cache durations for different data types.

```tsx
// Heavily cached: Historical data
'use cache'

export const revalidate = 86400 // 24 hours

export async function YearlyRevenue() {
  const revenue = await calculateYearlyRevenue()
  return <RevenueChart data={revenue} />
}

// Moderately cached: Daily aggregates
'use cache'

export const revalidate = 3600 // 1 hour

export async function DailyStats() {
  const stats = await aggregateDailyStats()
  return <StatsCards stats={stats} />
}

// Lightly cached: Recent activity
'use cache'

export const revalidate = 60 // 1 minute

export async function RecentOrders() {
  const orders = await fetchRecentOrders()
  return <OrdersList orders={orders} />
}

// Not cached: Real-time data
export async function LiveMetrics() {
  const metrics = await fetchLiveMetrics()
  return <MetricsDisplay metrics={metrics} />
}

// Dashboard page
export default function Dashboard() {
  return (
    <div className="dashboard">
      <div className="grid">
        <LiveMetrics />
        <RecentOrders />
        <DailyStats />
        <YearlyRevenue />
      </div>
    </div>
  )
}
```

### 4. News Portal with Category Caching

Cache news by category with different revalidation periods.

```tsx
'use cache'

export const revalidate = 300 // 5 minutes
export const tags = ['news']

export async function NewsFeed({ category }: { category: string }) {
  const articles = await db.article.findMany({
    where: { category },
    orderBy: { publishedAt: 'desc' },
    take: 20
  })

  return (
    <div>
      {articles.map(article => (
        <div key={article.id}>
          <h2>{article.title}</h2>
          <p>{article.excerpt}</p>
          <time>{article.publishedAt.toLocaleString()}</time>

          {/* Dynamic: User's read status */}
          <ReadIndicator articleId={article.id} />
        </div>
      ))}
    </div>
  )
}

// Update action invalidates cache
'use server'

export async function publishArticle(articleData: any) {
  await db.article.create({ data: articleData })

  // Invalidate news cache
  revalidateTag('news')
}
```

### 5. Documentation Site with Search

Cache documentation pages while keeping search dynamic.

```tsx
'use cache'

export const revalidate = false // Cache indefinitely (until manual revalidation)
export const tags = ['docs']

export async function DocPage({ slug }: { slug: string }) {
  const doc = await db.doc.findUnique({
    where: { slug },
    include: { sections: true }
  })

  return (
    <div className="doc-page">
      <h1>{doc.title}</h1>

      <nav>
        {doc.sections.map(section => (
          <a key={section.id} href={`#${section.slug}`}>
            {section.title}
          </a>
        ))}
      </nav>

      <div className="content">
        {doc.sections.map(section => (
          <section key={section.id} id={section.slug}>
            <h2>{section.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: section.content }} />
          </section>
        ))}
      </div>
    </div>
  )
}

// Usage
export default function Page({
  params
}: {
  params: { slug: string }
}) {
  return (
    <div>
      {/* Dynamic search */}
      <DocSearch />

      {/* Cached content */}
      <DocPage slug={params.slug} />

      {/* Dynamic feedback */}
      <FeedbackForm pageSlug={params.slug} />
    </div>
  )
}
```

## Best Practices

### 1. Cache Expensive Operations

Use cache for computationally expensive or slow operations.

```tsx
'use cache'

export const revalidate = 3600

export async function ComplexReport() {
  // Expensive operations
  const rawData = await db.transaction.findMany()
  const processed = processLargeDataset(rawData) // CPU-intensive
  const aggregated = performComplexAggregations(processed)
  const formatted = formatForDisplay(aggregated)

  return <ReportView data={formatted} />
}
```

### 2. Set Appropriate Revalidation Times

Match cache duration to data update frequency.

```tsx
// Static content: Cache for long periods
'use cache'
export const revalidate = 86400 // 24 hours
export async function AboutPage() { /* ... */ }

// Semi-dynamic: Moderate caching
'use cache'
export const revalidate = 3600 // 1 hour
export async function ProductList() { /* ... */ }

// Frequently changing: Short cache
'use cache'
export const revalidate = 60 // 1 minute
export async function StockPrices() { /* ... */ }

// Real-time: No cache
export async function LiveChat() { /* ... */ }
```

### 3. Use Tags for Grouped Invalidation

Tag related cached components for batch invalidation.

```tsx
'use cache'
export const tags = ['products', 'inventory']
export async function ProductStock() { /* ... */ }

'use cache'
export const tags = ['products', 'pricing']
export async function ProductPrices() { /* ... */ }

// Invalidate all product-related caches
'use server'
export async function updateProducts() {
  await updateDatabase()
  revalidateTag('products') // Invalidates both components
}
```

### 4. Combine with Suspense for Loading States

```tsx
export default function Page() {
  return (
    <div>
      <Suspense fallback={<ReportSkeleton />}>
        <CachedReport />
      </Suspense>
    </div>
  )
}

'use cache'
export const revalidate = 1800

export async function CachedReport() {
  const report = await generateReport()
  return <ReportView report={report} />
}
```

### 5. Keep Client Components Separate

Don't cache Client Components - cache only Server Components.

```tsx
// ✅ Good - cache Server Component only
'use cache'
export async function ProductData({ id }: { id: string }) {
  const product = await fetchProduct(id)

  return (
    <div>
      <h1>{product.name}</h1>
      <p>${product.price}</p>

      {/* Client Component not cached */}
      <AddToCartButton productId={id} />
    </div>
  )
}

// ❌ Bad - trying to cache Client Component
'use client'
'use cache' // This doesn't make sense

export function InteractiveWidget() {
  const [state, setState] = useState()
  return <div>...</div>
}
```

## Performance Implications

### Advantages
- **Reduced server load**: Expensive operations run once
- **Faster response times**: Cached results served immediately
- **Lower database load**: Fewer queries
- **Predictable performance**: Consistent response times

### Considerations
- **Stale data**: Cached content may be outdated
- **Memory usage**: Cached responses consume memory
- **Cache invalidation**: Need strategy for keeping data fresh
- **Complexity**: Managing cache keys and invalidation

## When to Use Cache Components

✅ **Ideal for:**
- Expensive computations or queries
- Semi-static content that doesn't change frequently
- Publicly shared content (same for all users)
- Content that's acceptable to be slightly stale
- High-traffic pages with cacheable content

❌ **Not suitable for:**
- User-specific content (unless cached per user)
- Real-time data requirements
- Rapidly changing content
- Content that must always be fresh
- Interactive components with state

## Comparison with Other Caching Strategies

### Cache Components vs Static Generation
```tsx
// Static Generation: Built at build time
export async function StaticPage() {
  const data = await fetchData()
  return <div>{data}</div>
}

// Cache Components: Built on first request, cached after
'use cache'
export async function CachedPage() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

### Cache Components vs Request Memoization
```tsx
// Request memoization: Cached during single request
export async function Component1() {
  const data = await fetchData() // Fetches
  return <div>{data}</div>
}

export async function Component2() {
  const data = await fetchData() // Reuses from request cache
  return <div>{data}</div>
}

// Cache Components: Cached across requests
'use cache'
export async function CachedComponent() {
  const data = await fetchData() // Cached across many requests
  return <div>{data}</div>
}
```

## Summary

Cache Components provide powerful caching capabilities for Server Components:

- **'use cache' directive**: Mark components for caching
- **Configurable revalidation**: Control cache duration
- **Tag-based invalidation**: Invalidate related caches together
- **Mix static and dynamic**: Cache expensive parts, keep others fresh
- **Optimal performance**: Reduce server load and improve response times

Use Cache Components strategically to balance freshness with performance, creating applications that are both fast and up-to-date.
