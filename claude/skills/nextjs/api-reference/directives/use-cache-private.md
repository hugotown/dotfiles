# use cache private

The `'use cache private'` directive enables per-user caching, allowing you to cache personalized content that varies by user while maintaining the performance benefits of caching.

## Syntax

```typescript
'use cache private'
```

Must be placed at the **top** of a function or component file, before any imports.

## Use Cases

### 1. Per-User Dashboard Data

Cache personalized dashboard data for each user separately.

```typescript
// app/lib/dashboard.ts
'use cache private'

interface DashboardData {
  stats: {
    totalOrders: number
    revenue: number
    activeSubscriptions: number
  }
  recentActivity: Activity[]
}

export async function getUserDashboard(userId: string): Promise<DashboardData> {
  const [stats, activity] = await Promise.all([
    db.order.aggregate({
      where: { userId },
      _count: true,
      _sum: { total: true }
    }),
    db.activity.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: 'desc' }
    })
  ])

  return {
    stats: {
      totalOrders: stats._count,
      revenue: stats._sum.total || 0,
      activeSubscriptions: await getActiveSubscriptions(userId)
    },
    recentActivity: activity
  }
}
```

### 2. Personalized Recommendations

Cache recommendation algorithms per user.

```typescript
'use cache private'

interface Recommendation {
  productId: string
  score: number
  reason: string
}

export async function getRecommendations(
  userId: string,
  category?: string
): Promise<Recommendation[]> {
  const userPreferences = await getUserPreferences(userId)
  const purchaseHistory = await getUserPurchases(userId)
  const browsingHistory = await getUserBrowsingHistory(userId)

  // Expensive ML computation
  const recommendations = await runRecommendationEngine({
    preferences: userPreferences,
    purchases: purchaseHistory,
    browsing: browsingHistory,
    category
  })

  return recommendations
}
```

### 3. User-Specific Settings Component

Cache rendered components with user-specific data.

```typescript
// app/components/UserSettings.tsx
'use cache private'

interface UserSettingsProps {
  userId: string
}

export async function UserSettings({ userId }: UserSettingsProps) {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    include: {
      preferences: true,
      notifications: true,
      privacy: true
    }
  })

  return (
    <div className="settings-panel">
      <h2>Your Settings</h2>
      <section>
        <h3>Preferences</h3>
        <ul>
          <li>Theme: {settings.preferences.theme}</li>
          <li>Language: {settings.preferences.language}</li>
          <li>Timezone: {settings.preferences.timezone}</li>
        </ul>
      </section>
      <section>
        <h3>Notifications</h3>
        <ul>
          <li>Email: {settings.notifications.email ? 'Enabled' : 'Disabled'}</li>
          <li>Push: {settings.notifications.push ? 'Enabled' : 'Disabled'}</li>
        </ul>
      </section>
    </div>
  )
}
```

### 4. Personalized Content Feed

```typescript
'use cache private'

interface FeedItem {
  id: string
  title: string
  content: string
  relevanceScore: number
  createdAt: Date
}

export async function getPersonalizedFeed(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<FeedItem[]> {
  const userInterests = await getUserInterests(userId)
  const userConnections = await getUserConnections(userId)

  const feed = await db.post.findMany({
    where: {
      OR: [
        { authorId: { in: userConnections } },
        { tags: { some: { id: { in: userInterests } } } }
      ]
    },
    take: limit,
    skip: (page - 1) * limit,
    orderBy: { createdAt: 'desc' }
  })

  // Calculate relevance scores
  return feed.map(post => ({
    ...post,
    relevanceScore: calculateRelevance(post, userInterests)
  }))
}
```

## Best Practices

### 1. Combine with User Authentication

```typescript
'use cache private'

import { auth } from '@/lib/auth'

export async function getUserProfile() {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const profile = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      posts: { take: 5, orderBy: { createdAt: 'desc' } },
      followers: { take: 10 },
      following: { take: 10 }
    }
  })

  return profile
}
```

### 2. Cache Expensive Personalization Logic

```typescript
'use cache private'

export async function getPersonalizedPricing(userId: string, productId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { loyaltyProgram: true, discounts: true }
  })

  const basePrice = await getProductPrice(productId)

  // Complex pricing calculation
  const discount = calculateLoyaltyDiscount(user.loyaltyProgram)
  const specialOffers = await getApplicableOffers(user.discounts, productId)

  return {
    basePrice,
    discount,
    specialOffers,
    finalPrice: applyDiscounts(basePrice, discount, specialOffers)
  }
}
```

### 3. Handle Preferences and Filters

```typescript
'use cache private'

interface SearchParams {
  query: string
  filters?: {
    category?: string
    priceRange?: [number, number]
    sortBy?: 'relevance' | 'price' | 'date'
  }
}

export async function getPersonalizedSearchResults(
  userId: string,
  params: SearchParams
) {
  const userPreferences = await getUserSearchPreferences(userId)
  const searchHistory = await getRecentSearches(userId)

  // Personalized search with user context
  const results = await searchEngine.query({
    ...params,
    userContext: {
      preferences: userPreferences,
      history: searchHistory
    }
  })

  return results
}
```

### 4. Runtime Prefetching

Prefetch personalized data during user interactions.

```typescript
'use cache private'

export async function prefetchUserData(userId: string) {
  // This will populate the cache for subsequent requests
  const [dashboard, recommendations, notifications] = await Promise.all([
    getUserDashboard(userId),
    getRecommendations(userId),
    getNotifications(userId)
  ])

  return { dashboard, recommendations, notifications }
}

// In a Server Component or Route Handler
export async function UserLayout({ userId }: { userId: string }) {
  // Prefetch in parallel with rendering
  prefetchUserData(userId).catch(console.error)

  return (
    <div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData userId={userId} />
      </Suspense>
    </div>
  )
}
```

## Cache Key Behavior

Cache keys include the user identifier plus function parameters:

```typescript
'use cache private'

export async function getUserNotifications(
  userId: string,
  unreadOnly: boolean = false
) {
  // Cache key: 'getUserNotifications-user123-true'
  const notifications = await db.notification.findMany({
    where: {
      userId,
      ...(unreadOnly && { read: false })
    },
    orderBy: { createdAt: 'desc' }
  })

  return notifications
}

// Each combination creates a separate cache entry per user
await getUserNotifications('user-123', true)  // Cache: user-123-true
await getUserNotifications('user-123', false) // Cache: user-123-false
await getUserNotifications('user-456', true)  // Cache: user-456-true
```

## Common Pitfalls to Avoid

### 1. Don't Cache Mutations

```typescript
// Bad - mutations should never be cached
'use cache private'
export async function updateUserProfile(userId: string, data: ProfileData) {
  return await db.user.update({
    where: { id: userId },
    data
  })
}

// Good - use 'use server' for mutations instead
'use server'
export async function updateUserProfile(userId: string, data: ProfileData) {
  return await db.user.update({
    where: { id: userId },
    data
  })
}
```

### 2. Be Careful with Stale Data

```typescript
// Bad - user might see outdated data after updating
'use cache private'
export async function getUserCart(userId: string) {
  return await db.cart.findUnique({
    where: { userId },
    include: { items: true }
  })
}

// Good - set appropriate revalidation or use on-demand revalidation
'use cache private'
export async function getUserCart(userId: string) {
  return await db.cart.findUnique({
    where: { userId },
    include: { items: true }
  })
}

// In your mutation handler
'use server'
export async function addToCart(userId: string, productId: string) {
  const result = await db.cart.update({
    where: { userId },
    data: { items: { create: { productId } } }
  })

  // Revalidate the cache
  revalidateTag(`user-cart-${userId}`)

  return result
}
```

### 3. Avoid Exposing Sensitive Data

```typescript
// Bad - caching complete user object with sensitive data
'use cache private'
export async function getUserData(userId: string) {
  return await db.user.findUnique({
    where: { id: userId },
    include: {
      password: true, // Never cache or expose passwords
      apiKeys: true,  // Sensitive
      paymentMethods: true // Sensitive
    }
  })
}

// Good - cache only necessary, safe data
'use cache private'
export async function getUserProfile(userId: string) {
  return await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      bio: true
    }
  })
}
```

### 4. Memory Considerations

```typescript
// Bad - caching large datasets per user
'use cache private'
export async function getAllUserOrders(userId: string) {
  // Could be thousands of orders
  return await db.order.findMany({
    where: { userId },
    include: { items: true, shipping: true }
  })
}

// Good - use pagination and cache pages
'use cache private'
export async function getUserOrders(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  return await db.order.findMany({
    where: { userId },
    take: limit,
    skip: (page - 1) * limit,
    orderBy: { createdAt: 'desc' }
  })
}
```

## Performance Considerations

- **Cache Isolation**: Each user has a separate cache, preventing data leakage
- **Memory Usage**: Monitor cache size with many users
- **Revalidation**: Set appropriate TTLs for user-specific data
- **Prefetching**: Use strategic prefetching to warm caches

## TypeScript Support

```typescript
'use cache private'

interface UserAnalytics {
  pageViews: number
  sessionDuration: number
  conversionRate: number
  topPages: Array<{ path: string; views: number }>
}

export async function getUserAnalytics(
  userId: string,
  dateRange?: { start: Date; end: Date }
): Promise<UserAnalytics> {
  const analytics = await analyticsEngine.query({
    userId,
    startDate: dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: dateRange?.end || new Date()
  })

  return analytics
}
```

## Related Directives

- [use cache](./use-cache.md) - Standard caching without user isolation
- [use cache remote](./use-cache-remote.md) - Edge caching with dynamic contexts
- [use server](./use-server.md) - Server Actions for mutations
