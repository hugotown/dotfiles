# Streaming

Streaming allows you to progressively render and send UI to the client as it becomes ready, improving perceived performance and Time to First Byte (TTFB). Instead of waiting for all data to load before showing anything, users see content incrementally.

## How Streaming Works

Streaming breaks the rendering work into chunks and progressively sends them to the client as they're ready.

```
Traditional Rendering:
[Server Processing] ──────────► [Complete HTML] ──► [Browser Render]
     10 seconds                      Instant           Instant

Streaming:
[Chunk 1] ──► [Render] ──┐
[Chunk 2] ──► [Render] ──┤──► Progressive Display
[Chunk 3] ──► [Render] ──┘
  2s each        Instant
```

## React Suspense Boundaries

Streaming is implemented using React's `<Suspense>` component, which defines loading boundaries.

### Basic Suspense Usage

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      <h1>My Page</h1>

      {/* This content streams in when ready */}
      <Suspense fallback={<LoadingSkeleton />}>
        <AsyncContent />
      </Suspense>
    </div>
  )
}

// This component fetches data and streams when ready
async function AsyncContent() {
  const data = await fetchData() // Could take several seconds

  return <div>{data.content}</div>
}

function LoadingSkeleton() {
  return <div className="skeleton">Loading...</div>
}
```

## Multiple Suspense Boundaries

Create multiple boundaries to stream different sections independently.

```tsx
export default function Dashboard() {
  return (
    <div>
      {/* Instantly available */}
      <Header />

      <div className="grid">
        {/* Each section streams independently */}
        <Suspense fallback={<CardSkeleton />}>
          <RevenueCard />
        </Suspense>

        <Suspense fallback={<CardSkeleton />}>
          <UserStatsCard />
        </Suspense>

        <Suspense fallback={<CardSkeleton />}>
          <ActivityCard />
        </Suspense>
      </div>

      <Suspense fallback={<ChartSkeleton />}>
        <AnalyticsChart />
      </Suspense>
    </div>
  )
}

// Each async component fetches its own data
async function RevenueCard() {
  const revenue = await fetchRevenue() // Fast query
  return <Card title="Revenue" value={revenue} />
}

async function UserStatsCard() {
  const stats = await fetchUserStats() // Medium query
  return <Card title="Users" value={stats} />
}

async function ActivityCard() {
  const activity = await fetchActivity() // Slow query
  return <Card title="Activity" value={activity} />
}

async function AnalyticsChart() {
  const data = await fetchAnalytics() // Very slow query
  return <Chart data={data} />
}
```

## Benefits of Streaming

### 1. Improved Time to First Byte (TTFB)
Users see initial content faster.

```tsx
// Traditional - user waits for everything
export default async function Page() {
  // User sees nothing until all data is ready (10 seconds)
  const [posts, comments, users] = await Promise.all([
    fetchPosts(),      // 3 seconds
    fetchComments(),   // 5 seconds
    fetchUsers()       // 2 seconds
  ])

  return <PageContent posts={posts} comments={comments} users={users} />
}

// Streaming - user sees content progressively
export default function Page() {
  return (
    <div>
      {/* Instantly visible */}
      <Header />

      {/* Shows after 2 seconds */}
      <Suspense fallback={<Skeleton />}>
        <UsersList />
      </Suspense>

      {/* Shows after 3 seconds */}
      <Suspense fallback={<Skeleton />}>
        <PostsList />
      </Suspense>

      {/* Shows after 5 seconds */}
      <Suspense fallback={<Skeleton />}>
        <CommentsList />
      </Suspense>
    </div>
  )
}
```

### 2. Better User Experience
Users see progress instead of a blank page.

```tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return (
    <article>
      {/* Quick content - instantly visible */}
      <NavBar />
      <PostHeader slug={params.slug} />

      {/* Main content - loads fast */}
      <Suspense fallback={<SkeletonContent />}>
        <PostContent slug={params.slug} />
      </Suspense>

      {/* Slow content - loads last but doesn't block above */}
      <Suspense fallback={<SkeletonComments />}>
        <CommentsSection slug={params.slug} />
      </Suspense>
    </article>
  )
}
```

### 3. Prioritized Loading
Critical content loads first, less important content streams in later.

```tsx
export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* Critical: Shows immediately */}
      <ProductImages productId={params.id} />

      {/* Important: Streams quickly */}
      <Suspense fallback={<PriceSkeleton />}>
        <ProductPrice productId={params.id} />
      </Suspense>

      {/* Nice to have: Streams when ready */}
      <Suspense fallback={<SpecsSkeleton />}>
        <ProductSpecs productId={params.id} />
      </Suspense>

      {/* Optional: Loads last */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={params.id} />
      </Suspense>

      {/* Optional: Loads last */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations categoryId={params.id} />
      </Suspense>
    </div>
  )
}
```

## Loading States and Skeletons

Good loading states make streaming effective.

### Basic Loading Skeletons

```tsx
export function CardSkeleton() {
  return (
    <div className="card-skeleton">
      <div className="skeleton-title" />
      <div className="skeleton-text" />
      <div className="skeleton-text short" />
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="table-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-cell" />
          <div className="skeleton-cell" />
          <div className="skeleton-cell" />
        </div>
      ))}
    </div>
  )
}

// CSS for skeletons
// .skeleton-title, .skeleton-text, .skeleton-cell {
//   background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
//   background-size: 200% 100%;
//   animation: loading 1.5s infinite;
//   border-radius: 4px;
// }
//
// @keyframes loading {
//   0% { background-position: 200% 0; }
//   100% { background-position: -200% 0; }
// }
```

### Matching Content Structure

Create skeletons that match the actual content layout.

```tsx
export default function Page() {
  return (
    <Suspense fallback={<ProductCardSkeleton />}>
      <ProductCard />
    </Suspense>
  )
}

async function ProductCard() {
  const product = await fetchProduct()

  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h2>{product.name}</h2>
      <p>{product.description}</p>
      <span className="price">${product.price}</span>
    </div>
  )
}

function ProductCardSkeleton() {
  // Matches the ProductCard structure
  return (
    <div className="product-card">
      <div className="skeleton-image" />
      <div className="skeleton-title" />
      <div className="skeleton-text" />
      <div className="skeleton-text" />
      <div className="skeleton-price" />
    </div>
  )
}
```

## Loading.tsx Convention

Next.js provides a special `loading.tsx` file convention for route-level loading states.

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="dashboard-loading">
      <div className="skeleton-header" />
      <div className="grid">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}

// app/dashboard/page.tsx
// This page is automatically wrapped in Suspense with loading.tsx as fallback
export default async function Dashboard() {
  const data = await fetchDashboardData()

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="grid">
        <MetricCard data={data.revenue} />
        <MetricCard data={data.users} />
        <MetricCard data={data.orders} />
      </div>
    </div>
  )
}
```

## Nested Loading States

Combine route-level and component-level loading states.

```tsx
// app/products/loading.tsx - Route-level loading
export default function Loading() {
  return <div>Loading products...</div>
}

// app/products/page.tsx
export default async function ProductsPage() {
  // If this is slow, loading.tsx shows
  const categories = await fetchCategories()

  return (
    <div>
      <h1>Products</h1>
      <CategoryFilter categories={categories} />

      {/* Nested Suspense for product list */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid />
      </Suspense>
    </div>
  )
}

async function ProductGrid() {
  const products = await fetchProducts()

  return (
    <div className="grid">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

## Streaming with Parallel Data Fetching

Fetch multiple data sources in parallel while streaming.

```tsx
export default function Page() {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>

      {/* These load in parallel and stream as they complete */}
      <div className="grid">
        <Suspense fallback={<Skeleton />}>
          <Metric1 />
        </Suspense>

        <Suspense fallback={<Skeleton />}>
          <Metric2 />
        </Suspense>

        <Suspense fallback={<Skeleton />}>
          <Metric3 />
        </Suspense>
      </div>
    </div>
  )
}

// These all fetch in parallel
async function Metric1() {
  const data = await fetchMetric1() // Completes in 2s
  return <Card data={data} />
}

async function Metric2() {
  const data = await fetchMetric2() // Completes in 5s
  return <Card data={data} />
}

async function Metric3() {
  const data = await fetchMetric3() // Completes in 3s
  return <Card data={data} />
}

// Visual timeline:
// 0s: All skeletons show
// 2s: Metric1 appears
// 3s: Metric3 appears
// 5s: Metric2 appears
```

## Error Boundaries with Streaming

Handle errors in streamed content with error boundaries.

```tsx
// error.tsx - Catches errors in the route
'use client'

export default function Error({
  error,
  reset
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}

// Component-level error handling
import { ErrorBoundary } from 'react-error-boundary'

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* If this fails, show fallback */}
      <ErrorBoundary fallback={<ErrorCard />}>
        <Suspense fallback={<CardSkeleton />}>
          <RevenueCard />
        </Suspense>
      </ErrorBoundary>

      {/* Other sections still work */}
      <Suspense fallback={<CardSkeleton />}>
        <UserCard />
      </Suspense>
    </div>
  )
}

function ErrorCard() {
  return <div className="error">Failed to load data</div>
}
```

## Best Practices

### 1. Strategic Suspense Boundaries

Place boundaries where they make sense for user experience.

```tsx
// ✅ Good - logical boundaries
export default function Page() {
  return (
    <div>
      <Header />

      {/* Separate boundary for main content */}
      <Suspense fallback={<MainSkeleton />}>
        <MainContent />
      </Suspense>

      {/* Separate boundary for sidebar */}
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
    </div>
  )
}

// ❌ Too granular - too many loading states
export default function Page() {
  return (
    <div>
      <Suspense fallback={<Spinner />}>
        <Title />
      </Suspense>
      <Suspense fallback={<Spinner />}>
        <Subtitle />
      </Suspense>
      <Suspense fallback={<Spinner />}>
        <Description />
      </Suspense>
      {/* User sees too many loading states */}
    </div>
  )
}
```

### 2. Meaningful Loading States

Show skeletons that match the content structure.

```tsx
// ✅ Good - matches actual content
function ProductListSkeleton() {
  return (
    <div className="product-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="product-card-skeleton">
          <div className="skeleton-image" />
          <div className="skeleton-title" />
          <div className="skeleton-price" />
        </div>
      ))}
    </div>
  )
}

// ❌ Generic - doesn't match layout
function ProductListSkeleton() {
  return <div>Loading...</div>
}
```

### 3. Group Related Content

Keep related data in the same Suspense boundary.

```tsx
// ✅ Good - product info loads together
export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<ProductSkeleton />}>
        <ProductInfo productId={params.id} />
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={params.id} />
      </Suspense>
    </div>
  )
}

async function ProductInfo({ productId }: { productId: string }) {
  const product = await fetchProduct(productId)

  return (
    <div>
      <h1>{product.name}</h1>
      <img src={product.image} alt={product.name} />
      <p>{product.description}</p>
      <span>${product.price}</span>
    </div>
  )
}

// ❌ Too split up - related data in different boundaries
export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<Skeleton />}>
        <ProductTitle productId={params.id} />
      </Suspense>
      <Suspense fallback={<Skeleton />}>
        <ProductImage productId={params.id} />
      </Suspense>
      <Suspense fallback={<Skeleton />}>
        <ProductPrice productId={params.id} />
      </Suspense>
      {/* Each fetches the same product separately - inefficient */}
    </div>
  )
}
```

### 4. Optimize Data Fetching

Fetch data efficiently to maximize streaming benefits.

```tsx
// ✅ Good - parallel fetching with separate boundaries
export default function Dashboard() {
  return (
    <div className="grid">
      {/* All fetch in parallel */}
      <Suspense fallback={<Skeleton />}>
        <RevenueCard />
      </Suspense>

      <Suspense fallback={<Skeleton />}>
        <OrdersCard />
      </Suspense>

      <Suspense fallback={<Skeleton />}>
        <CustomersCard />
      </Suspense>
    </div>
  )
}

// ❌ Sequential - slow fetches block fast ones
export default async function Dashboard() {
  const revenue = await fetchRevenue()    // 2s
  const orders = await fetchOrders()      // 3s
  const customers = await fetchCustomers() // 1s
  // Total: 6s sequential

  return (
    <div className="grid">
      <Card data={revenue} />
      <Card data={orders} />
      <Card data={customers} />
    </div>
  )
}
```

## Performance Implications

### Advantages
- **Faster TTFB**: Users see content sooner
- **Better perceived performance**: Progressive loading feels faster
- **Reduced blocking**: Slow queries don't block fast content
- **Improved engagement**: Users interact with available content while waiting

### Considerations
- **More server requests**: Each Suspense boundary may trigger a separate chunk
- **Complexity**: More code to manage loading states
- **Skeleton maintenance**: Loading states must be kept in sync with content
- **Cumulative Layout Shift (CLS)**: Poorly designed skeletons can cause layout shifts

## When to Use Streaming

✅ **Ideal for:**
- Pages with mixed fast and slow data
- Dashboard with multiple data sources
- Content that can load progressively
- Improving perceived performance
- Long-running queries that shouldn't block fast content

❌ **Not suitable for:**
- Very simple pages with single fast query
- Content that must load atomically
- When showing loading states would be disruptive
- Pages where all data is equally fast

## Summary

Streaming with Suspense boundaries enables:

- **Progressive rendering**: Show content as it becomes ready
- **Better UX**: Users see progress instead of blank pages
- **Improved TTFB**: Initial content arrives faster
- **Flexible loading**: Different sections load independently
- **Error isolation**: Errors in one section don't break others

Use streaming strategically with well-designed loading states to create applications that feel fast and responsive, even when fetching slow data.
