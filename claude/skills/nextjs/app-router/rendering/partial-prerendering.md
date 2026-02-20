# Partial Prerendering (PPR)

Partial Prerendering (PPR) is an experimental Next.js feature that combines static and dynamic rendering in a single route. It delivers a static shell instantly while streaming dynamic content as it becomes ready, offering the best of both static and dynamic rendering.

## What is PPR?

PPR allows you to render parts of a route statically at build time while keeping other parts dynamic at request time.

```tsx
// This route uses PPR
export default function Page() {
  return (
    <div>
      {/* Static: Pre-rendered at build time */}
      <Header />
      <Navigation />

      {/* Dynamic: Rendered at request time */}
      <Suspense fallback={<Skeleton />}>
        <DynamicContent />
      </Suspense>

      {/* Static: Pre-rendered at build time */}
      <Footer />
    </div>
  )
}
```

**Result:**
- Static shell (header, nav, footer) sent immediately
- Dynamic content streams in when ready
- Best possible Time to First Byte (TTFB)

## How PPR Works

PPR uses Suspense boundaries to determine what's static and what's dynamic.

```
Build Time:
┌─────────────────────────────┐
│ Static Shell Generated      │
│ - Header                    │
│ - Navigation                │
│ - Layout                    │
│ - Footer                    │
│ - Loading states            │
└─────────────────────────────┘

Request Time:
┌─────────────────────────────┐
│ 1. Send static shell        │ ◄── Instant
│ 2. Render dynamic content   │ ◄── Server processing
│ 3. Stream to client         │ ◄── Progressive
└─────────────────────────────┘
```

## Enabling PPR

PPR is currently experimental. Enable it in your Next.js config.

```javascript
// next.config.js
const nextConfig = {
  experimental: {
    ppr: true
  }
}

module.exports = nextConfig
```

### Incremental Adoption

Enable PPR for specific routes using the segment config option.

```tsx
// app/dashboard/page.tsx
export const experimental_ppr = true

export default function Dashboard() {
  return (
    <div>
      {/* Static shell */}
      <DashboardHeader />

      {/* Dynamic content */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <Analytics />
      </Suspense>
    </div>
  )
}
```

## Static vs Dynamic with PPR

### Static Parts (Pre-rendered)
Anything **outside** Suspense boundaries is static.

```tsx
export const experimental_ppr = true

export default function Page() {
  return (
    <div>
      {/* ✅ Static - pre-rendered at build time */}
      <header>
        <h1>Welcome</h1>
        <Navigation />
      </header>

      <main>
        {/* ✅ Static - fallback is pre-rendered */}
        <Suspense fallback={<Skeleton />}>
          {/* ⚡ Dynamic - rendered at request time */}
          <UserContent />
        </Suspense>
      </main>

      {/* ✅ Static - pre-rendered at build time */}
      <footer>
        <Copyright />
        <Links />
      </footer>
    </div>
  )
}
```

### Dynamic Parts (Request-time)
Anything **inside** Suspense boundaries is dynamic.

```tsx
export const experimental_ppr = true

export default function ProductPage() {
  return (
    <div>
      {/* Static shell */}
      <PageLayout>
        {/* Dynamic: User-specific content */}
        <Suspense fallback={<div>Loading cart...</div>}>
          <CartSummary />
        </Suspense>

        {/* Dynamic: Personalized recommendations */}
        <Suspense fallback={<div>Loading recommendations...</div>}>
          <PersonalizedRecommendations />
        </Suspense>

        {/* Dynamic: Real-time inventory */}
        <Suspense fallback={<div>Checking availability...</div>}>
          <InventoryStatus />
        </Suspense>
      </PageLayout>
    </div>
  )
}
```

## Use Cases

### 1. E-commerce Product Pages

Static shell with dynamic user-specific content.

```tsx
export const experimental_ppr = true

export default function ProductPage({
  params
}: {
  params: { id: string }
}) {
  return (
    <div>
      {/* Static: Product details pre-rendered */}
      <ProductHeader productId={params.id} />
      <ProductImages productId={params.id} />
      <ProductDescription productId={params.id} />

      {/* Dynamic: User's cart state */}
      <Suspense fallback={<ButtonSkeleton />}>
        <AddToCartButton productId={params.id} />
      </Suspense>

      {/* Dynamic: Personalized recommendations */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <PersonalizedProducts userId={params.id} />
      </Suspense>

      {/* Dynamic: Real-time inventory */}
      <Suspense fallback={<InventorySkeleton />}>
        <StockStatus productId={params.id} />
      </Suspense>

      {/* Static: Reviews pre-rendered */}
      <ProductReviews productId={params.id} />
    </div>
  )
}
```

### 2. Blog Posts with Personalization

Static content with dynamic engagement features.

```tsx
export const experimental_ppr = true

export default function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  return (
    <article>
      {/* Static: Post content pre-rendered */}
      <PostHeader slug={params.slug} />
      <PostContent slug={params.slug} />
      <PostMetadata slug={params.slug} />

      {/* Dynamic: User's reading progress */}
      <Suspense fallback={null}>
        <ReadingProgress />
      </Suspense>

      {/* Dynamic: User-specific recommendations */}
      <Suspense fallback={<RelatedSkeleton />}>
        <PersonalizedRelatedPosts />
      </Suspense>

      {/* Dynamic: User's bookmark status */}
      <Suspense fallback={<BookmarkSkeleton />}>
        <BookmarkButton postSlug={params.slug} />
      </Suspense>

      {/* Static: Public comments pre-rendered */}
      <CommentsSection slug={params.slug} />
    </article>
  )
}
```

### 3. Dashboard with Real-time Data

Static layout with dynamic data widgets.

```tsx
export const experimental_ppr = true

export default function Dashboard() {
  return (
    <div className="dashboard">
      {/* Static: Layout and navigation */}
      <DashboardHeader />
      <Sidebar />

      <main className="dashboard-content">
        {/* Each widget loads independently */}
        <div className="grid">
          <Suspense fallback={<MetricCardSkeleton />}>
            <RevenueMetric />
          </Suspense>

          <Suspense fallback={<MetricCardSkeleton />}>
            <UsersMetric />
          </Suspense>

          <Suspense fallback={<MetricCardSkeleton />}>
            <OrdersMetric />
          </Suspense>

          <Suspense fallback={<ChartSkeleton />}>
            <SalesChart />
          </Suspense>

          <Suspense fallback={<TableSkeleton />}>
            <RecentOrders />
          </Suspense>

          <Suspense fallback={<ActivitySkeleton />}>
            <ActivityFeed />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
```

### 4. News Articles with Live Comments

Static article with dynamic social features.

```tsx
export const experimental_ppr = true

export default function Article({
  params
}: {
  params: { id: string }
}) {
  return (
    <div>
      {/* Static: Article content */}
      <ArticleHeader articleId={params.id} />
      <ArticleBody articleId={params.id} />

      {/* Dynamic: Live comment count */}
      <Suspense fallback={<span>Comments</span>}>
        <LiveCommentCount articleId={params.id} />
      </Suspense>

      {/* Dynamic: User's like status */}
      <Suspense fallback={<LikeSkeleton />}>
        <LikeButton articleId={params.id} />
      </Suspense>

      {/* Dynamic: Live comments */}
      <Suspense fallback={<CommentsSkeleton />}>
        <LiveComments articleId={params.id} />
      </Suspense>

      {/* Static: Related articles */}
      <RelatedArticles categoryId={params.id} />
    </div>
  )
}
```

## Benefits of PPR

### 1. Optimal TTFB
Static shell delivers instantly, even before dynamic content is ready.

```tsx
export const experimental_ppr = true

export default function Page() {
  return (
    <div>
      {/* Instant: Pre-rendered at build time */}
      <header>
        <h1>My App</h1>
        <nav>...</nav>
      </header>

      {/* Delayed: Waits for data */}
      <Suspense fallback={<div>Loading...</div>}>
        <DynamicContent />
      </Suspense>
    </div>
  )
}

// Timeline:
// 0ms: Static shell sent to client (header visible)
// 500ms: Dynamic content rendered and streamed
```

### 2. SEO Friendly
Static content is available to search engines immediately.

```tsx
export const experimental_ppr = true

export default function ProductPage({
  params
}: {
  params: { id: string }
}) {
  return (
    <div>
      {/* ✅ SEO: Static, crawlable immediately */}
      <h1>Product Name</h1>
      <meta name="description" content="Product description" />
      <ProductInfo productId={params.id} />

      {/* Not critical for SEO: Dynamic */}
      <Suspense fallback={<Skeleton />}>
        <UserRecommendations />
      </Suspense>
    </div>
  )
}
```

### 3. Reduced Server Load
Static parts are cached and served from CDN.

```tsx
export const experimental_ppr = true

export default function Page() {
  return (
    <div>
      {/* Cached on CDN, minimal server load */}
      <StaticHero />
      <StaticFeatures />

      {/* Server processes only this on each request */}
      <Suspense fallback={<Skeleton />}>
        <PersonalizedContent />
      </Suspense>
    </div>
  )
}
```

### 4. Better Caching Strategy
Combine CDN caching for static parts with request-time rendering for dynamic parts.

```tsx
export const experimental_ppr = true

export default function Page() {
  return (
    <div>
      {/* Cached at edge, shared across users */}
      <GlobalHeader />
      <PublicContent />

      {/* User-specific, not cached */}
      <Suspense fallback={<Skeleton />}>
        <UserProfile />
      </Suspense>

      {/* Cached at edge, shared across users */}
      <GlobalFooter />
    </div>
  )
}
```

## Configuration Best Practices

### 1. Strategic Suspense Placement

Place Suspense boundaries around truly dynamic content only.

```tsx
// ✅ Good - only dynamic content in Suspense
export const experimental_ppr = true

export default function Page() {
  return (
    <div>
      <StaticHeader />
      <StaticContent />

      {/* Only user-specific content is dynamic */}
      <Suspense fallback={<UserSkeleton />}>
        <UserWidget />
      </Suspense>

      <StaticFooter />
    </div>
  )
}

// ❌ Bad - too much in Suspense
export const experimental_ppr = true

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {/* Everything becomes dynamic, losing PPR benefits */}
      <Header />
      <Content />
      <UserWidget />
      <Footer />
    </Suspense>
  )
}
```

### 2. Meaningful Fallbacks

Provide fallbacks that match the content structure.

```tsx
export const experimental_ppr = true

export default function Dashboard() {
  return (
    <div className="grid">
      <Suspense fallback={
        <div className="metric-card skeleton">
          <div className="skeleton-title" />
          <div className="skeleton-value" />
        </div>
      }>
        <MetricCard />
      </Suspense>
    </div>
  )
}
```

### 3. Group Related Dynamic Content

Keep related dynamic data in the same Suspense boundary.

```tsx
export const experimental_ppr = true

export default function ProfilePage() {
  return (
    <div>
      {/* Static layout */}
      <PageHeader />

      {/* Group related user data together */}
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile />
        <UserStats />
        <UserActivity />
      </Suspense>

      {/* Separate boundary for different concern */}
      <Suspense fallback={<FeedSkeleton />}>
        <PersonalizedFeed />
      </Suspense>
    </div>
  )
}
```

## Comparison with Other Approaches

### Traditional SSR (All Dynamic)
```tsx
// Everything rendered at request time
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <Header />
      <Content data={data} />
      <Footer />
    </div>
  )
}

// Performance:
// - TTFB: Slow (waits for all data)
// - Personalization: ✅ Full
// - Caching: ❌ Minimal
```

### Static Generation (All Static)
```tsx
// Everything pre-rendered at build time
export default async function Page() {
  const data = await fetchStaticData()

  return (
    <div>
      <Header />
      <Content data={data} />
      <Footer />
    </div>
  )
}

// Performance:
// - TTFB: ✅ Very fast
// - Personalization: ❌ None
// - Caching: ✅ Maximum
```

### PPR (Hybrid)
```tsx
export const experimental_ppr = true

export default function Page() {
  return (
    <div>
      {/* Static: Cached, instant */}
      <Header />

      {/* Dynamic: Personalized */}
      <Suspense fallback={<Skeleton />}>
        <PersonalizedContent />
      </Suspense>

      {/* Static: Cached, instant */}
      <Footer />
    </div>
  )
}

// Performance:
// - TTFB: ✅ Very fast (static shell)
// - Personalization: ✅ Full (dynamic parts)
// - Caching: ✅ Optimal (hybrid)
```

## Performance Implications

### Advantages
- **Fast TTFB**: Static shell delivers immediately
- **SEO optimized**: Static content available to crawlers
- **Reduced server load**: Static parts cached on CDN
- **Personalization**: Dynamic parts remain user-specific
- **Best of both worlds**: Static speed + dynamic features

### Considerations
- **Experimental**: API may change
- **Complexity**: Managing static vs dynamic boundaries
- **Testing**: Need to verify both static and dynamic behaviors
- **Edge cases**: Some patterns may not work as expected

## When to Use PPR

✅ **Ideal for:**
- E-commerce product pages (static product info, dynamic cart)
- Blog posts (static content, dynamic engagement)
- Marketing pages (static content, dynamic CTAs)
- Dashboards (static layout, dynamic data)
- News articles (static article, dynamic comments)
- Profile pages (static layout, dynamic user data)

❌ **Not suitable for:**
- Fully static sites (use SSG instead)
- Fully dynamic applications (use SSR instead)
- Simple pages without clear static/dynamic split
- Applications not ready for experimental features

## Migration Strategy

### Step 1: Identify Static vs Dynamic
Analyze your page to identify what should be static vs dynamic.

```tsx
// Before: All dynamic
export default async function Page() {
  const user = await getUser()
  const posts = await getPosts()

  return (
    <div>
      <Header />
      <UserWidget user={user} />
      <PostsList posts={posts} />
      <Footer />
    </div>
  )
}
```

### Step 2: Add Suspense Boundaries
Wrap dynamic content in Suspense.

```tsx
// After: PPR-ready
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      {/* Static */}
      <Header />

      {/* Dynamic */}
      <Suspense fallback={<UserSkeleton />}>
        <UserWidget />
      </Suspense>

      {/* Dynamic */}
      <Suspense fallback={<PostsSkeleton />}>
        <PostsList />
      </Suspense>

      {/* Static */}
      <Footer />
    </div>
  )
}

// Extract to async components
async function UserWidget() {
  const user = await getUser()
  return <div>{user.name}</div>
}

async function PostsList() {
  const posts = await getPosts()
  return <div>{posts.map(...)}</div>
}
```

### Step 3: Enable PPR
Add the experimental flag.

```tsx
export const experimental_ppr = true

export default function Page() {
  // Same code as Step 2
}
```

### Step 4: Test and Optimize
Verify static shell loads instantly and dynamic content streams correctly.

## Summary

Partial Prerendering (PPR) offers the best of static and dynamic rendering:

- **Static shell**: Pre-rendered, cached, instant delivery
- **Dynamic holes**: Streamed at request time, fully personalized
- **Optimal performance**: Fast TTFB with personalization
- **SEO friendly**: Static content available to search engines
- **Flexible**: Mix static and dynamic content in single route

PPR is the future of Next.js rendering, providing optimal performance without sacrificing personalization or dynamic features. While experimental, it represents a powerful paradigm for modern web applications.
