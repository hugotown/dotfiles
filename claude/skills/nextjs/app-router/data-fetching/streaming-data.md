# Streaming and Progressive Loading

Streaming allows you to progressively render and send UI from the server to the client, improving perceived performance and user experience.

## Basic Streaming with Suspense

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      {/* This renders immediately */}
      <h1>My Dashboard</h1>

      {/* This streams in when ready */}
      <Suspense fallback={<LoadingSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  )
}

async function DashboardData() {
  const data = await fetchDashboardData()
  return <DataDisplay data={data} />
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mt-2"></div>
    </div>
  )
}
```

## Loading.tsx File Convention

Next.js automatically wraps pages in Suspense when you create a `loading.tsx` file:

```tsx
// app/posts/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
      <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
    </div>
  )
}
```

```tsx
// app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts')
  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()
  return <PostsList posts={posts} />
}
```

## Multiple Suspense Boundaries

Stream different parts of the page independently:

```tsx
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Suspense fallback={<UsersSkeleton />}>
        <Users />
      </Suspense>

      <Suspense fallback={<PostsSkeleton />}>
        <Posts />
      </Suspense>

      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
    </div>
  )
}

// Each component fetches independently and streams when ready
async function Users() {
  const users = await fetchUsers() // 500ms
  return <UsersList users={users} />
}

async function Posts() {
  const posts = await fetchPosts() // 1000ms
  return <PostsList posts={posts} />
}

async function Stats() {
  const stats = await fetchStats() // 2000ms
  return <StatsDisplay stats={stats} />
}
```

## Nested Suspense Boundaries

Create hierarchical loading states:

```tsx
import { Suspense } from 'react'

export default function ProfilePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfile userId={params.id}>
        <Suspense fallback={<PostsLoading />}>
          <UserPosts userId={params.id} />
        </Suspense>

        <Suspense fallback={<FollowersLoading />}>
          <UserFollowers userId={params.id} />
        </Suspense>
      </UserProfile>
    </Suspense>
  )
}

async function UserProfile({ userId, children }: {
  userId: string
  children: React.ReactNode
}) {
  const user = await fetchUser(userId)

  return (
    <div>
      <UserHeader user={user} />
      <div className="grid grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

async function UserPosts({ userId }: { userId: string }) {
  const posts = await fetchUserPosts(userId)
  return <PostsList posts={posts} />
}

async function UserFollowers({ userId }: { userId: string }) {
  const followers = await fetchFollowers(userId)
  return <FollowersList followers={followers} />
}
```

## Skeleton Components

Create realistic loading skeletons:

```tsx
// components/skeletons.tsx
export function PostSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      <div className="flex space-x-2">
        <div className="h-8 bg-gray-200 rounded w-16"></div>
        <div className="h-8 bg-gray-200 rounded w-16"></div>
      </div>
    </div>
  )
}

export function PostListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2 space-y-4">
        <PostListSkeleton />
      </div>
      <aside className="space-y-4">
        <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </aside>
    </div>
  )
}
```

## Streaming with Error Boundaries

Combine streaming with error handling:

```tsx
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

export default function Page() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <Suspense fallback={<Loading />}>
        <DataComponent />
      </Suspense>
    </ErrorBoundary>
  )
}

function ErrorFallback() {
  return (
    <div className="text-red-500">
      <h2>Something went wrong</h2>
      <button onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  )
}
```

Using Next.js error.tsx:

```tsx
// app/posts/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Failed to load posts</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## Streaming Route Handlers

Stream data from Route Handlers:

```tsx
// app/api/stream/route.ts
export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send data in chunks
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 100))
        const data = `data: ${JSON.stringify({ count: i })}\n\n`
        controller.enqueue(encoder.encode(data))
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

Client-side consumption:

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function StreamingClient() {
  const [data, setData] = useState([])

  useEffect(() => {
    const eventSource = new EventSource('/api/stream')

    eventSource.onmessage = (event) => {
      const newData = JSON.parse(event.data)
      setData(prev => [...prev, newData])
    }

    return () => eventSource.close()
  }, [])

  return (
    <div>
      {data.map((item, i) => (
        <div key={i}>{item.count}</div>
      ))}
    </div>
  )
}
```

## Progressive Enhancement

Show progressively more detailed content:

```tsx
import { Suspense } from 'react'

export default function ArticlePage({ params }: { params: { id: string } }) {
  return (
    <article>
      {/* Show article immediately */}
      <Suspense fallback={<ArticleSkeleton />}>
        <ArticleContent id={params.id} />
      </Suspense>

      {/* Show comments when ready */}
      <Suspense fallback={<CommentsLoading />}>
        <Comments articleId={params.id} />
      </Suspense>

      {/* Show recommendations when ready */}
      <Suspense fallback={<RecommendationsLoading />}>
        <Recommendations articleId={params.id} />
      </Suspense>
    </article>
  )
}

async function ArticleContent({ id }: { id: string }) {
  const article = await fetchArticle(id)
  return (
    <div>
      <h1>{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </div>
  )
}

async function Comments({ articleId }: { articleId: string }) {
  const comments = await fetchComments(articleId)
  return <CommentsList comments={comments} />
}

async function Recommendations({ articleId }: { articleId: string }) {
  const recommendations = await fetchRecommendations(articleId)
  return <ArticleGrid articles={recommendations} />
}
```

## Streaming with Dynamic Data

Stream real-time updates:

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function RealtimeDashboard() {
  return (
    <div>
      <h1>Live Dashboard</h1>

      <Suspense fallback={<MetricsSkeleton />}>
        <LiveMetrics />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity />
      </Suspense>
    </div>
  )
}

async function LiveMetrics() {
  const metrics = await fetchCurrentMetrics()
  return <MetricsDisplay metrics={metrics} />
}

async function RecentActivity() {
  const activity = await fetchRecentActivity()
  return <ActivityFeed activity={activity} />
}
```

## Preloading with Suspense

Start fetching early without blocking:

```tsx
import { Suspense } from 'react'

// Preload function starts fetch immediately
function preloadUser(id: string) {
  void fetchUser(id)
}

export default function Page({ params }: { params: { id: string } }) {
  // Start preloading immediately
  preloadUser(params.id)

  return (
    <Suspense fallback={<Loading />}>
      <UserProfile userId={params.id} />
    </Suspense>
  )
}

const userCache = new Map()

async function fetchUser(id: string) {
  if (!userCache.has(id)) {
    userCache.set(id, fetch(`/api/users/${id}`).then(r => r.json()))
  }
  return userCache.get(id)
}

async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId)
  return <UserCard user={user} />
}
```

## Conditional Streaming

Only stream when necessary:

```tsx
import { Suspense } from 'react'

export default function Page({ searchParams }: {
  searchParams: { fast?: string }
}) {
  const useFastMode = searchParams.fast === 'true'

  if (useFastMode) {
    // Don't stream, just show cached data
    return <CachedData />
  }

  return (
    <Suspense fallback={<Loading />}>
      <FreshData />
    </Suspense>
  )
}

async function FreshData() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store'
  }).then(r => r.json())

  return <DataDisplay data={data} />
}

function CachedData() {
  // This uses cached data, no await needed
  return <DataDisplay data={getCachedData()} />
}
```

## Best Practices

1. **Use Suspense boundaries strategically** - Don't wrap everything
2. **Show realistic skeletons** - Match the actual content layout
3. **Prioritize critical content** - Stream non-essential parts later
4. **Combine with error boundaries** - Handle failures gracefully
5. **Test loading states** - Ensure skeletons look good
6. **Avoid layout shifts** - Skeleton should match content dimensions
7. **Use loading.tsx for page-level loading** - Simpler than manual Suspense
8. **Stream independent data** - Don't create unnecessary waterfalls
9. **Consider SEO** - Important content should render quickly
10. **Monitor performance** - Track Time to First Byte and streaming metrics

## Performance Considerations

### Good Streaming Strategy

```tsx
// Critical content renders immediately
// Secondary content streams in
export default function Page() {
  return (
    <div>
      <header>
        <Logo />
        <Navigation />
      </header>

      <main>
        {/* Hero renders immediately */}
        <Hero />

        {/* Product list streams when ready */}
        <Suspense fallback={<ProductsSkeleton />}>
          <ProductList />
        </Suspense>

        {/* Reviews stream independently */}
        <Suspense fallback={<ReviewsSkeleton />}>
          <Reviews />
        </Suspense>
      </main>

      <footer>
        <Footer />
      </footer>
    </div>
  )
}
```

### Avoid Over-Streaming

```tsx
// BAD: Too many suspense boundaries
export default function OverStreamedPage() {
  return (
    <div>
      <Suspense fallback={<div>Loading title...</div>}>
        <Title />
      </Suspense>
      <Suspense fallback={<div>Loading subtitle...</div>}>
        <Subtitle />
      </Suspense>
      <Suspense fallback={<div>Loading content...</div>}>
        <Content />
      </Suspense>
    </div>
  )
}

// GOOD: Group related content
export default function WellStreamedPage() {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <Header />
    </Suspense>
  )
}

async function Header() {
  const data = await fetchHeaderData()
  return (
    <div>
      <Title data={data.title} />
      <Subtitle data={data.subtitle} />
      <Content data={data.content} />
    </div>
  )
}
```

## Common Patterns

### Dashboard with Multiple Widgets

```tsx
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Suspense fallback={<WidgetSkeleton />}>
        <SalesWidget />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton />}>
        <UsersWidget />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton />}>
        <RevenueWidget />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton />}>
        <ConversionWidget />
      </Suspense>
    </div>
  )
}
```

### Content with Sidebar

```tsx
import { Suspense } from 'react'

export default function BlogPost({ params }: { params: { slug: string } }) {
  return (
    <div className="grid grid-cols-3 gap-8">
      <article className="col-span-2">
        <Suspense fallback={<ArticleSkeleton />}>
          <Article slug={params.slug} />
        </Suspense>
      </article>

      <aside>
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      </aside>
    </div>
  )
}
```
