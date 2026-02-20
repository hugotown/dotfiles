# Loading States and Streaming in Next.js App Router

Next.js App Router provides built-in support for loading states and streaming Server-Side Rendering (SSR), enabling you to create instant loading experiences and progressively render UI as data becomes available.

## Overview

The App Router introduces two powerful patterns for improved user experience:

1. **Instant Loading UI** - Automatic loading states with `loading.js`
2. **Streaming SSR** - Progressive rendering with React Suspense

These features work together to show meaningful content quickly while data loads in the background.

## loading.js - Instant Loading States

### Basic Usage

Create a `loading.js` file in any route segment to show a loading UI instantly:

```
app/
  dashboard/
    loading.tsx       # Loading state for /dashboard
    page.tsx
```

**Loading UI:**

```typescript
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
    </div>
  )
}
```

**How it works:**
1. User navigates to `/dashboard`
2. Next.js immediately shows `loading.tsx`
3. While `page.tsx` loads data
4. Once ready, page content replaces loading UI

### Nested Loading States

Loading states can be nested at different route levels:

```
app/
  dashboard/
    loading.tsx       # Shows while dashboard loads
    page.tsx
    analytics/
      loading.tsx     # Shows while analytics loads
      page.tsx
```

**Dashboard Loading:**

```typescript
// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="p-8">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4 animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
```

**Analytics Loading:**

```typescript
// app/dashboard/analytics/loading.tsx
export default function AnalyticsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-64 bg-gray-200 rounded animate-pulse" />
      <div className="h-48 bg-gray-200 rounded animate-pulse" />
    </div>
  )
}
```

### Skeleton Screens

Create realistic loading skeletons:

```typescript
// app/blog/loading.tsx
export default function BlogLoading() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Title skeleton */}
      <div className="h-12 bg-gray-200 rounded w-3/4 mb-4 animate-pulse" />

      {/* Meta info skeleton */}
      <div className="flex gap-4 mb-8">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 rounded animate-pulse"
            style={{ width: `${Math.random() * 30 + 70}%` }}
          />
        ))}
      </div>
    </div>
  )
}
```

### Reusable Loading Components

Create shared loading components:

```typescript
// components/LoadingCard.tsx
export function LoadingCard() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
    </div>
  )
}

// app/products/loading.tsx
import { LoadingCard } from '@/components/LoadingCard'

export default function ProductsLoading() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <LoadingCard key={i} />
      ))}
    </div>
  )
}
```

## Streaming with React Suspense

### What is Streaming?

Streaming allows you to progressively render UI from the server. Instead of waiting for all data before showing anything, you can:

1. Send initial HTML immediately
2. Stream in components as their data loads
3. Show fallback UI (loading states) while waiting

### Basic Suspense Usage

Wrap async components in Suspense boundaries:

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react'

async function Analytics() {
  const data = await fetchAnalytics() // Slow data fetch
  return <div>Analytics: {data.value}</div>
}

async function RecentActivity() {
  const activity = await fetchActivity() // Fast data fetch
  return <div>Activity: {activity.length} items</div>
}

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Shows immediately when data is ready */}
      <Suspense fallback={<div>Loading activity...</div>}>
        <RecentActivity />
      </Suspense>

      {/* Shows when analytics data loads */}
      <Suspense fallback={<div>Loading analytics...</div>}>
        <Analytics />
      </Suspense>
    </div>
  )
}
```

**How it works:**
1. Page shell renders immediately
2. `RecentActivity` shows when its data is ready
3. `Analytics` shows when its data is ready
4. Each section streams independently

### Multiple Suspense Boundaries

Create granular loading states for different sections:

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Revenue card */}
      <Suspense fallback={<CardSkeleton />}>
        <RevenueCard />
      </Suspense>

      {/* Users card */}
      <Suspense fallback={<CardSkeleton />}>
        <UsersCard />
      </Suspense>

      {/* Sales card */}
      <Suspense fallback={<CardSkeleton />}>
        <SalesCard />
      </Suspense>

      {/* Chart - spans full width */}
      <div className="col-span-3">
        <Suspense fallback={<ChartSkeleton />}>
          <AnalyticsChart />
        </Suspense>
      </div>
    </div>
  )
}
```

### Nested Suspense Boundaries

Nest Suspense boundaries for complex layouts:

```typescript
// app/profile/page.tsx
import { Suspense } from 'react'

export default function ProfilePage() {
  return (
    <div>
      {/* Profile header loads quickly */}
      <Suspense fallback={<HeaderSkeleton />}>
        <ProfileHeader />
      </Suspense>

      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div>
          <Suspense fallback={<AboutSkeleton />}>
            <About />
          </Suspense>

          <Suspense fallback={<ActivitySkeleton />}>
            <RecentActivity />
          </Suspense>
        </div>

        {/* Right column */}
        <div>
          <Suspense fallback={<PhotosSkeleton />}>
            <Photos />
          </Suspense>

          <Suspense fallback={<FriendsSkeleton />}>
            <Friends />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
```

## Combining loading.js and Suspense

Use `loading.js` for route-level loading and Suspense for component-level loading:

```typescript
// app/dashboard/loading.tsx - Route level
export default function Loading() {
  return <DashboardSkeleton />
}

// app/dashboard/page.tsx - Component level
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <div>
      {/* This content shows immediately */}
      <Header />

      {/* These sections stream in as ready */}
      <Suspense fallback={<MetricsSkeleton />}>
        <Metrics />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <Chart />
      </Suspense>
    </div>
  )
}
```

## Streaming Patterns

### Priority Loading

Load critical content first, defer non-critical content:

```typescript
export default function Page() {
  return (
    <div>
      {/* Critical: Load immediately (no Suspense) */}
      <CriticalContent />

      {/* Important: High priority fallback */}
      <Suspense fallback={<ImportantSkeleton />}>
        <ImportantContent />
      </Suspense>

      {/* Optional: Simple fallback */}
      <Suspense fallback={<div>Loading...</div>}>
        <OptionalContent />
      </Suspense>
    </div>
  )
}
```

### Parallel Data Fetching

Fetch data in parallel and stream independently:

```typescript
async function UserInfo({ userId }: { userId: string }) {
  const user = await getUser(userId)
  return <div>{user.name}</div>
}

async function UserPosts({ userId }: { userId: string }) {
  const posts = await getPosts(userId)
  return <div>{posts.length} posts</div>
}

async function UserFollowers({ userId }: { userId: string }) {
  const followers = await getFollowers(userId)
  return <div>{followers.length} followers</div>
}

export default function UserProfile({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* All fetch in parallel, stream in as ready */}
      <Suspense fallback={<Skeleton />}>
        <UserInfo userId={params.id} />
      </Suspense>

      <Suspense fallback={<Skeleton />}>
        <UserPosts userId={params.id} />
      </Suspense>

      <Suspense fallback={<Skeleton />}>
        <UserFollowers userId={params.id} />
      </Suspense>
    </div>
  )
}
```

### Sequential Data Fetching

Load data sequentially when dependencies exist:

```typescript
async function User({ userId }: { userId: string }) {
  const user = await getUser(userId)

  return (
    <div>
      <h1>{user.name}</h1>

      {/* Only fetch posts after user loads */}
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={user.id} category={user.defaultCategory} />
      </Suspense>
    </div>
  )
}

export default function UserPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<UserSkeleton />}>
      <User userId={params.id} />
    </Suspense>
  )
}
```

### Waterfall Prevention

Avoid data waterfalls by fetching in parallel:

```typescript
// ❌ Bad: Sequential waterfall
async function BlogPost({ slug }: { slug: string }) {
  const post = await getPost(slug) // Wait 1
  const author = await getAuthor(post.authorId) // Wait 2
  const comments = await getComments(post.id) // Wait 3
  return <div>...</div>
}

// ✅ Good: Parallel fetching
async function BlogPost({ slug }: { slug: string }) {
  // All fetch in parallel
  const [post, author, comments] = await Promise.all([
    getPost(slug),
    getAuthor(authorId),
    getComments(postId),
  ])
  return <div>...</div>
}

// ✅ Better: Stream sections independently
function BlogPost({ slug }: { slug: string }) {
  return (
    <div>
      <Suspense fallback={<PostSkeleton />}>
        <PostContent slug={slug} />
      </Suspense>

      <Suspense fallback={<AuthorSkeleton />}>
        <AuthorInfo slug={slug} />
      </Suspense>

      <Suspense fallback={<CommentsSkeleton />}>
        <Comments slug={slug} />
      </Suspense>
    </div>
  )
}
```

## Advanced Streaming

### Streaming with Error Boundaries

Combine Suspense with error boundaries:

```typescript
import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Page() {
  return (
    <ErrorBoundary fallback={<div>Error loading data</div>}>
      <Suspense fallback={<Loading />}>
        <DataComponent />
      </Suspense>
    </ErrorBoundary>
  )
}
```

### Streaming Large Lists

Stream large lists progressively:

```typescript
// app/products/page.tsx
import { Suspense } from 'react'

async function ProductBatch({ start, end }: { start: number; end: number }) {
  const products = await getProducts(start, end)

  return (
    <>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </>
  )
}

export default function ProductsPage() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Stream in batches of 20 products */}
      <Suspense fallback={<ProductsSkeleton count={20} />}>
        <ProductBatch start={0} end={20} />
      </Suspense>

      <Suspense fallback={<ProductsSkeleton count={20} />}>
        <ProductBatch start={20} end={40} />
      </Suspense>

      <Suspense fallback={<ProductsSkeleton count={20} />}>
        <ProductBatch start={40} end={60} />
      </Suspense>
    </div>
  )
}
```

### Client-Side Streaming

Use Suspense with client-side data fetching:

```typescript
'use client'

import { Suspense } from 'react'
import useSWR from 'swr'

function UserData() {
  const { data } = useSWR('/api/user', fetcher, { suspense: true })
  return <div>{data.name}</div>
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading user...</div>}>
      <UserData />
    </Suspense>
  )
}
```

## Best Practices

### 1. Use Meaningful Loading States

Create skeletons that match your content:

```typescript
// ✅ Good: Matches actual content structure
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-12 bg-gray-200 rounded w-3/4" />
      <div className="h-64 bg-gray-200 rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  )
}

// ❌ Bad: Generic spinner
export default function Loading() {
  return <div className="spinner" />
}
```

### 2. Place Suspense Boundaries Strategically

```typescript
// ✅ Good: Multiple small boundaries
<div>
  <Suspense fallback={<HeaderSkeleton />}>
    <Header />
  </Suspense>
  <Suspense fallback={<ContentSkeleton />}>
    <Content />
  </Suspense>
</div>

// ❌ Bad: One large boundary
<Suspense fallback={<PageSkeleton />}>
  <div>
    <Header />
    <Content />
  </div>
</Suspense>
```

### 3. Fetch Data Where You Need It

```typescript
// ✅ Good: Fetch in component
async function Comments({ postId }: { postId: string }) {
  const comments = await getComments(postId)
  return <CommentList comments={comments} />
}

// ❌ Bad: Fetch in parent and pass down
async function Page() {
  const comments = await getComments()
  return <Comments comments={comments} />
}
```

### 4. Handle Empty States

```typescript
async function Products() {
  const products = await getProducts()

  if (products.length === 0) {
    return <EmptyState message="No products found" />
  }

  return <ProductGrid products={products} />
}

export default function Page() {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <Products />
    </Suspense>
  )
}
```

### 5. Accessibility Considerations

```typescript
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading content">
      <div className="animate-pulse">
        {/* Skeleton UI */}
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  )
}
```

## Common Pitfalls

### 1. Too Few Suspense Boundaries

```
❌ Bad: Entire page waits for slowest component
<Suspense fallback={<PageLoading />}>
  <FastComponent />
  <SlowComponent />
</Suspense>

✅ Good: Independent loading
<Suspense fallback={<FastLoading />}>
  <FastComponent />
</Suspense>
<Suspense fallback={<SlowLoading />}>
  <SlowComponent />
</Suspense>
```

### 2. Blocking on Shared Data

```typescript
// ❌ Bad: Both components wait for both fetches
async function Page() {
  const [user, posts] = await Promise.all([getUser(), getPosts()])
  return (
    <>
      <UserInfo user={user} />
      <PostList posts={posts} />
    </>
  )
}

// ✅ Good: Independent streaming
function Page() {
  return (
    <>
      <Suspense fallback={<UserSkeleton />}>
        <UserInfo />
      </Suspense>
      <Suspense fallback={<PostsSkeleton />}>
        <PostList />
      </Suspense>
    </>
  )
}
```

### 3. Missing loading.js in Layouts

```
❌ Missing loading state
app/
  dashboard/
    layout.tsx
    page.tsx
  # No loading.tsx

✅ With loading state
app/
  dashboard/
    layout.tsx
    loading.tsx    # Shows while page loads
    page.tsx
```

## Performance Tips

### 1. Preload Critical Data

```typescript
import { preload } from 'react-dom'

export default function Page() {
  // Preload critical data
  preload('/api/user', { as: 'fetch' })

  return (
    <Suspense fallback={<Loading />}>
      <UserComponent />
    </Suspense>
  )
}
```

### 2. Cache Aggressively

```typescript
// Cache user data for 1 hour
async function getUser() {
  const res = await fetch('/api/user', {
    next: { revalidate: 3600 },
  })
  return res.json()
}
```

### 3. Use Loading Priorities

```typescript
// Critical content (no Suspense)
<CriticalHeader />

// High priority (eager loading)
<Suspense fallback={<HighPrioritySkeleton />}>
  <ImportantContent />
</Suspense>

// Low priority (lazy loading)
<Suspense fallback={null}>
  <OptionalWidget />
</Suspense>
```

## Summary

Loading states and streaming in Next.js App Router enable excellent UX:

- **loading.js**: Automatic loading UI for route segments
- **Suspense**: Granular loading states for components
- **Streaming**: Progressive rendering of server components
- **Skeletons**: Meaningful placeholders matching content
- **Best Practices**: Multiple boundaries, fetch where needed, handle errors
- **Benefits**: Faster perceived performance, better UX, progressive enhancement

Combine `loading.js` for route-level loading and Suspense for component-level streaming to create responsive, fast-feeling applications.
