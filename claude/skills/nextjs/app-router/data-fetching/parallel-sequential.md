# Parallel and Sequential Data Fetching

Understanding when and how to fetch data in parallel or sequentially is crucial for optimizing your Next.js application's performance.

## Sequential Fetching (Waterfall)

Sequential fetching happens when requests depend on each other and must wait for previous requests to complete.

### When Sequential is Necessary

```tsx
// User data is needed before fetching their posts
async function UserPage({ params }: { params: { id: string } }) {
  // First fetch: Get user
  const user = await fetch(`https://api.example.com/users/${params.id}`)
    .then(r => r.json())

  // Second fetch: Get posts (depends on user data)
  const posts = await fetch(`https://api.example.com/posts?authorId=${user.id}`)
    .then(r => r.json())

  return (
    <div>
      <UserProfile user={user} />
      <PostsList posts={posts} />
    </div>
  )
}
```

### Sequential Waterfall Problem

```tsx
// BAD: Unnecessary waterfall
async function SlowPage() {
  const users = await fetchUsers()     // Wait 1s
  const posts = await fetchPosts()     // Wait 1s
  const comments = await fetchComments() // Wait 1s
  // Total: 3s

  return <Dashboard users={users} posts={posts} comments={comments} />
}
```

## Parallel Fetching

Parallel fetching allows multiple independent requests to happen simultaneously.

### Using Promise.all

```tsx
// GOOD: Parallel fetching
async function FastPage() {
  const [users, posts, comments] = await Promise.all([
    fetchUsers(),     // 1s
    fetchPosts(),     // 1s
    fetchComments(),  // 1s
  ])
  // Total: 1s (all run in parallel)

  return <Dashboard users={users} posts={posts} comments={comments} />
}
```

### Complete Example

```tsx
async function fetchUsers() {
  const res = await fetch('https://api.example.com/users')
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

async function fetchPosts() {
  const res = await fetch('https://api.example.com/posts')
  if (!res.ok) throw new Error('Failed to fetch posts')
  return res.json()
}

async function fetchCategories() {
  const res = await fetch('https://api.example.com/categories')
  if (!res.ok) throw new Error('Failed to fetch categories')
  return res.json()
}

export default async function DashboardPage() {
  // All three fetch in parallel
  const [users, posts, categories] = await Promise.all([
    fetchUsers(),
    fetchPosts(),
    fetchCategories(),
  ])

  return (
    <div>
      <UserSection users={users} />
      <PostSection posts={posts} />
      <CategorySection categories={categories} />
    </div>
  )
}
```

## Parallel with Error Handling

### Promise.allSettled for Graceful Degradation

```tsx
async function DashboardWithFallbacks() {
  const results = await Promise.allSettled([
    fetchUsers(),
    fetchPosts(),
    fetchAnalytics(),
  ])

  const users = results[0].status === 'fulfilled' ? results[0].value : []
  const posts = results[1].status === 'fulfilled' ? results[1].value : []
  const analytics = results[2].status === 'fulfilled' ? results[2].value : null

  return (
    <div>
      <UserSection users={users} />
      <PostSection posts={posts} />
      {analytics && <AnalyticsSection data={analytics} />}
    </div>
  )
}
```

### Try-Catch with Promise.all

```tsx
async function DashboardWithErrorHandling() {
  try {
    const [users, posts, stats] = await Promise.all([
      fetchUsers(),
      fetchPosts(),
      fetchStats(),
    ])

    return <Dashboard users={users} posts={posts} stats={stats} />
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error)
    throw error // Let error boundary handle it
  }
}
```

## Hybrid: Parallel Groups with Sequential Dependencies

```tsx
async function ComplexPage({ params }: { params: { id: string } }) {
  // Step 1: Fetch user data first (required for next steps)
  const user = await fetchUser(params.id)

  // Step 2: Fetch user-dependent data in parallel
  const [posts, followers, following] = await Promise.all([
    fetchUserPosts(user.id),
    fetchFollowers(user.id),
    fetchFollowing(user.id),
  ])

  // Step 3: Fetch analytics based on posts
  const analytics = await fetchPostAnalytics(posts.map(p => p.id))

  return (
    <div>
      <UserProfile user={user} />
      <UserStats followers={followers} following={following} />
      <PostsList posts={posts} analytics={analytics} />
    </div>
  )
}
```

## Preloading Pattern

Initiate fetches early without awaiting them immediately:

```tsx
async function OptimizedPage() {
  // Start all fetches immediately
  const usersPromise = fetchUsers()
  const postsPromise = fetchPosts()
  const categoriesPromise = fetchCategories()

  // Do some synchronous work here if needed
  const config = getStaticConfig()

  // Now await all together
  const [users, posts, categories] = await Promise.all([
    usersPromise,
    postsPromise,
    categoriesPromise,
  ])

  return <Page users={users} posts={posts} categories={categories} config={config} />
}
```

## Component-Level Parallel Fetching

Fetch data at the component level and use Suspense for parallel rendering:

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
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
    </div>
  )
}

// Each component fetches its own data
async function Users() {
  const users = await fetchUsers() // Fetches in parallel with Posts and Stats
  return <UsersList users={users} />
}

async function Posts() {
  const posts = await fetchPosts() // Fetches in parallel with Users and Stats
  return <PostsList posts={posts} />
}

async function Stats() {
  const stats = await fetchStats() // Fetches in parallel with Users and Posts
  return <StatsDisplay stats={stats} />
}
```

## Streaming with Suspense

For better perceived performance, stream components as they load:

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <div>
      {/* Renders immediately */}
      <Header />

      {/* Streams in when ready */}
      <Suspense fallback={<LoadingSpinner />}>
        <SlowComponent />
      </Suspense>

      {/* Renders immediately */}
      <Footer />
    </div>
  )
}

async function SlowComponent() {
  const data = await fetchSlowData()
  return <DataDisplay data={data} />
}
```

## Nested Suspense for Progressive Loading

```tsx
export default function ProfilePage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile userId={params.id}>
          <Suspense fallback={<PostsLoading />}>
            <UserPosts userId={params.id} />
          </Suspense>
          <Suspense fallback={<ActivityLoading />}>
            <UserActivity userId={params.id} />
          </Suspense>
        </UserProfile>
      </Suspense>
    </div>
  )
}

async function UserProfile({ userId, children }: { userId: string, children: React.ReactNode }) {
  const user = await fetchUser(userId)
  return (
    <div>
      <UserHeader user={user} />
      {children}
    </div>
  )
}

async function UserPosts({ userId }: { userId: string }) {
  const posts = await fetchUserPosts(userId)
  return <PostsList posts={posts} />
}

async function UserActivity({ userId }: { userId: string }) {
  const activity = await fetchUserActivity(userId)
  return <ActivityFeed activity={activity} />
}
```

## Performance Comparison

```tsx
// Sequential (Slow) - 3 seconds total
async function Sequential() {
  const users = await fetchUsers()     // 1s
  const posts = await fetchPosts()     // 1s
  const comments = await fetchComments() // 1s
  return <Dashboard users={users} posts={posts} comments={comments} />
}

// Parallel (Fast) - 1 second total
async function Parallel() {
  const [users, posts, comments] = await Promise.all([
    fetchUsers(),     // 1s \
    fetchPosts(),     // 1s  } All run simultaneously
    fetchComments(),  // 1s /
  ])
  return <Dashboard users={users} posts={posts} comments={comments} />
}
```

## Best Practices

1. **Default to parallel** - Use Promise.all when requests are independent
2. **Use sequential only when necessary** - When data depends on previous results
3. **Consider Promise.allSettled** - For non-critical data that shouldn't break the page
4. **Use Suspense boundaries** - For component-level parallel fetching
5. **Preload when possible** - Start fetches early, await later
6. **Avoid over-fetching** - Don't fetch data you don't need
7. **Monitor waterfall** - Use React DevTools and Network tab to identify waterfalls
8. **Type your promises** - Use TypeScript for type-safe parallel fetching
9. **Handle errors appropriately** - Different strategies for critical vs non-critical data
10. **Stream for better UX** - Use Suspense to show content progressively

## Common Patterns

### Parallel with Shared Context

```tsx
async function UserDashboard({ userId }: { userId: string }) {
  // Fetch user first (needed by child components)
  const user = await fetchUser(userId)

  // Then fetch everything else in parallel
  const [posts, followers, settings] = await Promise.all([
    fetchUserPosts(userId),
    fetchUserFollowers(userId),
    fetchUserSettings(userId),
  ])

  return (
    <UserContext.Provider value={user}>
      <UserHeader />
      <PostsSection posts={posts} />
      <FollowersSection followers={followers} />
      <SettingsPanel settings={settings} />
    </UserContext.Provider>
  )
}
```

### Conditional Parallel Fetching

```tsx
async function ConditionalPage({ searchParams }: {
  searchParams: { includeAnalytics?: string }
}) {
  const promises = [
    fetchUsers(),
    fetchPosts(),
  ]

  if (searchParams.includeAnalytics === 'true') {
    promises.push(fetchAnalytics())
  }

  const results = await Promise.all(promises)
  const [users, posts, analytics] = results

  return (
    <div>
      <UserSection users={users} />
      <PostSection posts={posts} />
      {analytics && <AnalyticsSection data={analytics} />}
    </div>
  )
}
```

### Pagination with Parallel Metadata

```tsx
async function PaginatedPage({ searchParams }: {
  searchParams: { page?: string }
}) {
  const page = Number(searchParams.page) || 1

  // Fetch data and total count in parallel
  const [posts, totalCount] = await Promise.all([
    fetchPosts({ page, limit: 10 }),
    fetchPostCount(),
  ])

  const totalPages = Math.ceil(totalCount / 10)

  return (
    <div>
      <PostsList posts={posts} />
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  )
}
```
