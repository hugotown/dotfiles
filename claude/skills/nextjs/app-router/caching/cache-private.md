# use cache: private

The `'use cache: private'` directive enables per-user caching in Next.js App Router, ideal for personalized content while still benefiting from server-side caching.

## Overview

Private caching creates separate cache entries for each user, enabling you to cache personalized content without mixing data between users. This is perfect for user-specific dashboards, preferences, or authenticated content.

## Basic Usage

### User-Specific Data Caching

```typescript
// app/lib/user-data.ts
'use cache: private'

export async function getCurrentUserProfile() {
  const session = await getSession()
  const res = await fetch(`https://api.example.com/users/${session.userId}`)
  return res.json()
}
```

### Personalized Component Caching

```typescript
// app/components/UserDashboard.tsx
'use cache: private'

export default async function UserDashboard() {
  const user = await getCurrentUser()
  const stats = await getUserStats(user.id)

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <div>Your stats: {stats.points} points</div>
    </div>
  )
}
```

### File-Level Private Caching

```typescript
// app/lib/user-preferences.ts
'use cache: private'

export async function getUserPreferences() {
  const user = await getCurrentUser()
  const res = await fetch(`https://api.example.com/preferences/${user.id}`)
  return res.json()
}

export async function getUserNotifications() {
  const user = await getCurrentUser()
  const res = await fetch(`https://api.example.com/notifications/${user.id}`)
  return res.json()
}

// All exports are cached privately per user
```

## Cache Behavior

### Per-User Isolation
- Each user gets their own cache entry
- Cache keys include user identifier automatically
- No data leakage between users
- Cache persists across requests for the same user

### Cache Key Generation
Private cache keys are based on:
- User session/authentication token
- Function arguments
- Request context

```typescript
'use cache: private'

export async function getUserOrders(status: 'pending' | 'completed') {
  const user = await getCurrentUser()
  // Cached separately per user AND per status
  const res = await fetch(`/api/orders?user=${user.id}&status=${status}`)
  return res.json()
}
```

## Advanced Patterns

### Runtime Prefetching for Personalized Content

```typescript
'use cache: private'

export async function getUserDashboardData() {
  const user = await getCurrentUser()

  // Prefetch related user data in parallel
  const [profile, orders, recommendations] = await Promise.all([
    getUserProfile(user.id),
    getUserOrders(user.id),
    getPersonalizedRecommendations(user.id)
  ])

  return { profile, orders, recommendations }
}
```

### Conditional Private Caching

```typescript
import { headers } from 'next/headers'

'use cache: private'

export async function getConditionalUserData() {
  const headersList = await headers()
  const isPremium = headersList.get('x-user-tier') === 'premium'

  const user = await getCurrentUser()

  if (isPremium) {
    return await fetchPremiumUserData(user.id)
  }

  return await fetchBasicUserData(user.id)
}
```

### Combining with Static Data

```typescript
async function getPageData() {
  // Mix public (static) and private (user-specific) data
  const [publicData, userData] = await Promise.all([
    getPublicProducts(),    // Cached globally
    getUserPreferences()    // Cached per user
  ])

  return { publicData, userData }
}

'use cache'
async function getPublicProducts() {
  const res = await fetch('https://api.example.com/products')
  return res.json()
}

'use cache: private'
async function getUserPreferences() {
  const user = await getCurrentUser()
  const res = await fetch(`https://api.example.com/preferences/${user.id}`)
  return res.json()
}
```

### Nested Private Caching

```typescript
'use cache: private'
export async function getUserSettings() {
  const user = await getCurrentUser()

  // Each of these is also cached privately
  const [profile, preferences, notifications] = await Promise.all([
    getUserProfile(user.id),
    getUserPreferences(user.id),
    getNotificationSettings(user.id)
  ])

  return { profile, preferences, notifications }
}

'use cache: private'
async function getUserProfile(userId: string) {
  const res = await fetch(`/api/users/${userId}/profile`)
  return res.json()
}

'use cache: private'
async function getUserPreferences(userId: string) {
  const res = await fetch(`/api/users/${userId}/preferences`)
  return res.json()
}

'use cache: private'
async function getNotificationSettings(userId: string) {
  const res = await fetch(`/api/users/${userId}/notifications`)
  return res.json()
}
```

## Performance Optimization Tips

### 1. Batch User-Specific Queries

```typescript
// ❌ Don't make multiple individual cached calls
async function getUserData() {
  const profile = await getCachedProfile()
  const orders = await getCachedOrders()
  const wishlist = await getCachedWishlist()
  return { profile, orders, wishlist }
}

// ✅ Batch fetch and cache together
'use cache: private'
async function getUserData() {
  const user = await getCurrentUser()
  const [profile, orders, wishlist] = await Promise.all([
    fetch(`/api/users/${user.id}/profile`),
    fetch(`/api/users/${user.id}/orders`),
    fetch(`/api/users/${user.id}/wishlist`)
  ])

  return {
    profile: await profile.json(),
    orders: await orders.json(),
    wishlist: await wishlist.json()
  }
}
```

### 2. Cache Hot User Paths

```typescript
// Cache frequently accessed user data
'use cache: private'
export async function getUserEssentials() {
  const user = await getCurrentUser()

  // Cache the most commonly needed user data together
  const [profile, settings, permissions] = await Promise.all([
    fetchUserProfile(user.id),
    fetchUserSettings(user.id),
    fetchUserPermissions(user.id)
  ])

  return { profile, settings, permissions }
}
```

### 3. Optimize Cache Granularity

```typescript
// ❌ Too many small private cache entries
'use cache: private'
async function getUserName() { /* ... */ }

'use cache: private'
async function getUserEmail() { /* ... */ }

'use cache: private'
async function getUserAvatar() { /* ... */ }

// ✅ Group related data
'use cache: private'
async function getUserBasicInfo() {
  const user = await getCurrentUser()
  return {
    name: user.name,
    email: user.email,
    avatar: user.avatar
  }
}
```

## Common Use Cases

### User Dashboard

```typescript
'use cache: private'
export async function getDashboardData() {
  const user = await getCurrentUser()

  const [stats, recentActivity, notifications] = await Promise.all([
    fetch(`/api/users/${user.id}/stats`).then(r => r.json()),
    fetch(`/api/users/${user.id}/activity?limit=10`).then(r => r.json()),
    fetch(`/api/users/${user.id}/notifications?unread=true`).then(r => r.json())
  ])

  return { stats, recentActivity, notifications }
}
```

### Personalized Recommendations

```typescript
'use cache: private'
export async function getRecommendations() {
  const user = await getCurrentUser()

  // Cache personalized recommendations
  const res = await fetch(`/api/recommendations?userId=${user.id}&preferences=${user.preferences}`)
  return res.json()
}
```

### User Settings & Preferences

```typescript
'use cache: private'
export async function getAllUserSettings() {
  const user = await getCurrentUser()

  const res = await fetch(`/api/users/${user.id}/settings`)
  return res.json()
}

// Update settings and invalidate cache
import { revalidateTag } from 'next/cache'

export async function updateUserSettings(settings: UserSettings) {
  const user = await getCurrentUser()

  await fetch(`/api/users/${user.id}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings)
  })

  // Invalidate user's private cache
  revalidateTag(`user-${user.id}-settings`)
}
```

### Shopping Cart

```typescript
'use cache: private'
export async function getShoppingCart() {
  const user = await getCurrentUser()

  const res = await fetch(`/api/cart?userId=${user.id}`)
  return res.json()
}
```

## Cache Invalidation

### Per-User Invalidation

```typescript
import { revalidateTag } from 'next/cache'
import { cacheTag } from 'next/cache'

'use cache: private'
export async function getUserProfile() {
  const user = await getCurrentUser()
  cacheTag(`user-${user.id}`)

  const res = await fetch(`/api/users/${user.id}`)
  return res.json()
}

// Invalidate specific user's cache
export async function updateProfile(data: ProfileData) {
  const user = await getCurrentUser()
  await saveProfile(user.id, data)

  revalidateTag(`user-${user.id}`) // Only invalidates this user's cache
}
```

### Selective Invalidation

```typescript
import { cacheTag } from 'next/cache'

'use cache: private'
export async function getUserData() {
  const user = await getCurrentUser()
  cacheTag(`user-${user.id}-profile`, `user-${user.id}-orders`)

  const [profile, orders] = await Promise.all([
    fetchProfile(user.id),
    fetchOrders(user.id)
  ])

  return { profile, orders }
}

// Invalidate only orders, keep profile cached
export async function addOrder(order: Order) {
  const user = await getCurrentUser()
  await saveOrder(order)

  revalidateTag(`user-${user.id}-orders`) // Profile cache remains
}
```

## Security Considerations

### 1. Never Mix User Data

```typescript
// ✅ Correct - private caching prevents mixing
'use cache: private'
export async function getSensitiveData() {
  const user = await getCurrentUser()
  // Each user gets their own cache entry
  return await fetchSensitiveUserData(user.id)
}

// ❌ Wrong - global caching could mix user data
'use cache'
export async function getSensitiveData() {
  const user = await getCurrentUser()
  // Dangerous! Could cache one user's data and serve to another
  return await fetchSensitiveUserData(user.id)
}
```

### 2. Verify User Authentication

```typescript
'use cache: private'
export async function getProtectedData() {
  const session = await getSession()

  if (!session || !session.user) {
    throw new Error('Unauthorized')
  }

  // Only fetch after verifying authentication
  const res = await fetch(`/api/protected/${session.user.id}`)
  return res.json()
}
```

### 3. Handle Session Expiry

```typescript
'use cache: private'
export async function getUserDataWithValidation() {
  const session = await getSession()

  if (!session || isSessionExpired(session)) {
    redirect('/login')
  }

  const res = await fetch(`/api/users/${session.user.id}`)
  return res.json()
}
```

## Debugging Private Cache

### Verify User Isolation

```typescript
'use cache: private'
export async function debugUserCache() {
  const user = await getCurrentUser()
  const timestamp = new Date().toISOString()

  console.log(`Cache entry for user ${user.id} at ${timestamp}`)

  return await fetchUserData(user.id)
}

// Check logs: each user should have their own cache entry
```

### Monitor Cache Hit Rates

```typescript
let cacheHits = 0
let cacheMisses = 0

'use cache: private'
export async function monitoredGetUserData() {
  const user = await getCurrentUser()

  console.log('Cache MISS - fetching fresh data')
  cacheMisses++

  return await fetchUserData(user.id)
}

// Subsequent calls won't log (cache HIT)
```

## Best Practices

1. **Use for authenticated content**: Always use private caching for user-specific data
2. **Batch user queries**: Fetch related user data together
3. **Tag for invalidation**: Add user-specific cache tags for precise invalidation
4. **Verify authentication**: Always check session validity before fetching
5. **Monitor cache size**: Per-user caching can grow large with many users
6. **Set appropriate lifetimes**: Use shorter cache lifetimes for frequently changing user data
7. **Test user isolation**: Ensure no data leakage between users
8. **Handle edge cases**: Session expiry, logged out users, concurrent updates

## When to Use

Use `'use cache: private'` for:
- User profiles and settings
- Shopping carts and wishlists
- Personalized recommendations
- User-specific dashboards
- Notification lists
- User preferences
- Private content/documents
- Account information

## When NOT to Use

Don't use `'use cache: private'` for:
- Public/shared content (use `'use cache'` instead)
- Real-time data (use client-side fetching)
- Very frequently changing data (consider shorter revalidation)
- Anonymous user tracking (use `'use cache: remote'`)
- One-time operations (no benefit from caching)

## Related

- See `use-cache.md` for global caching
- See `cache-remote.md` for dynamic context caching
- See `cache-lifecycle.md` for cache expiration control
- See `cache-tags.md` for invalidation strategies
