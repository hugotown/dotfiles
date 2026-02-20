# cacheLife - Cache Lifecycle Management

The `cacheLife` API controls cache expiration and stale-while-revalidate behavior in Next.js App Router, allowing you to define how long cached content remains fresh and when it should be revalidated.

## Overview

`cacheLife` provides fine-grained control over cache duration and revalidation strategy. It implements a stale-while-revalidate pattern, serving stale content while fetching fresh data in the background.

## Basic Usage

### Using Named Profiles

```typescript
import { cacheLife } from 'next/cache'

'use cache'

export async function getProducts() {
  cacheLife('hours')

  const res = await fetch('https://api.example.com/products')
  return res.json()
}
```

### Available Built-in Profiles

Next.js provides several built-in cache life profiles:

```typescript
// 'seconds' - Short-lived cache
cacheLife('seconds')  // 60s stale, 3600s revalidate

// 'minutes' - Medium-lived cache
cacheLife('minutes')  // 300s (5min) stale, 3600s (1hr) revalidate

// 'hours' - Long-lived cache
cacheLife('hours')    // 3600s (1hr) stale, 86400s (24hr) revalidate

// 'days' - Very long-lived cache
cacheLife('days')     // 86400s (24hr) stale, 604800s (7 days) revalidate

// 'weeks' - Maximum duration cache
cacheLife('weeks')    // 604800s (7 days) stale, 2592000s (30 days) revalidate
```

### Custom Cache Durations

```typescript
import { cacheLife } from 'next/cache'

'use cache'

export async function getCustomCachedData() {
  cacheLife({
    stale: 60,        // Content is fresh for 60 seconds
    revalidate: 3600, // Revalidate after 1 hour
    expire: 86400     // Hard expiration after 24 hours
  })

  const res = await fetch('https://api.example.com/data')
  return res.json()
}
```

## Cache Lifecycle Phases

### 1. Fresh Phase (0 to `stale` seconds)
- Content is considered fresh
- Served directly from cache
- No revalidation occurs

```typescript
'use cache'

export async function getFreshData() {
  cacheLife({
    stale: 300 // Fresh for 5 minutes
  })

  return await fetchData()
}
```

### 2. Stale-While-Revalidate Phase (`stale` to `revalidate` seconds)
- Stale content is served immediately
- Revalidation happens in background
- Next request gets fresh content

```typescript
'use cache'

export async function getSWRData() {
  cacheLife({
    stale: 60,       // Fresh for 1 minute
    revalidate: 3600 // Revalidate for up to 1 hour
  })

  return await fetchData()
}
```

### 3. Expiration Phase (after `expire` seconds)
- Cache entry is completely invalid
- Must fetch fresh data
- User waits for new fetch

```typescript
'use cache'

export async function getExpiringData() {
  cacheLife({
    stale: 300,
    revalidate: 3600,
    expire: 86400 // Hard expiration after 24 hours
  })

  return await fetchData()
}
```

## Advanced Patterns

### Time-of-Day Based Caching

```typescript
'use cache'

export async function getTimeBasedData() {
  const now = new Date()
  const hour = now.getHours()

  // Shorter cache during business hours
  if (hour >= 9 && hour <= 17) {
    cacheLife({
      stale: 60,
      revalidate: 300
    })
  } else {
    cacheLife({
      stale: 3600,
      revalidate: 86400
    })
  }

  return await fetchData()
}
```

### Data Freshness Requirements

```typescript
// Real-time data - very short cache
'use cache'
export async function getStockPrices() {
  cacheLife({
    stale: 5,     // Fresh for 5 seconds
    revalidate: 30 // Revalidate up to 30 seconds
  })

  return await fetchStockPrices()
}

// Semi-static data - medium cache
'use cache'
export async function getArticles() {
  cacheLife('hours')

  return await fetchArticles()
}

// Static content - long cache
'use cache'
export async function getArchiveContent() {
  cacheLife('weeks')

  return await fetchArchive()
}
```

### Conditional Cache Lifecycles

```typescript
import { headers } from 'next/headers'

'use cache'

export async function getConditionalCache() {
  const headersList = await headers()
  const isPremium = headersList.get('x-user-tier') === 'premium'

  // Premium users get fresher data
  if (isPremium) {
    cacheLife({
      stale: 30,
      revalidate: 300
    })
  } else {
    cacheLife('hours')
  }

  return await fetchData()
}
```

### Combining with Other Cache Directives

```typescript
import { cacheLife, cacheTag } from 'next/cache'

'use cache'

export async function getFullyCachedData() {
  cacheLife('hours')
  cacheTag('products', 'homepage')

  const res = await fetch('https://api.example.com/products')
  return res.json()
}
```

## Optimization Strategies

### 1. Layer Cache Durations

```typescript
// Long cache for base data
'use cache'
async function getBaseProducts() {
  cacheLife('days')
  return await fetch('/api/products/base').then(r => r.json())
}

// Short cache for pricing
'use cache'
async function getCurrentPricing() {
  cacheLife('minutes')
  return await fetch('/api/pricing').then(r => r.json())
}

// Combine in page
export async function getPageData() {
  const [products, pricing] = await Promise.all([
    getBaseProducts(),  // Cached for days
    getCurrentPricing() // Cached for minutes
  ])

  return { products, pricing }
}
```

### 2. Progressive Enhancement

```typescript
'use cache'

export async function getProgressiveData() {
  cacheLife({
    stale: 60,       // Quick initial response
    revalidate: 3600, // Background updates for 1 hour
    expire: 86400    // Full refresh daily
  })

  return await fetchData()
}
```

### 3. Cache Warming

```typescript
'use cache'

export async function warmCache() {
  cacheLife({
    stale: 3600,      // Keep warm for 1 hour
    revalidate: 7200  // Refresh every 2 hours
  })

  // Pre-fetch expensive data
  const data = await fetchExpensiveData()
  return data
}

// Call during build or via cron
```

## Custom Cache Profiles

### Define Custom Profiles

```typescript
// next.config.js
module.exports = {
  experimental: {
    cacheLife: {
      custom: {
        stale: 120,      // 2 minutes
        revalidate: 600, // 10 minutes
        expire: 3600     // 1 hour
      },
      realtime: {
        stale: 1,
        revalidate: 10,
        expire: 60
      },
      permanent: {
        stale: 2592000,    // 30 days
        revalidate: 31536000, // 1 year
        expire: 31536000   // 1 year
      }
    }
  }
}
```

### Use Custom Profiles

```typescript
import { cacheLife } from 'next/cache'

'use cache'

export async function useCustomProfile() {
  cacheLife('custom')

  return await fetchData()
}

'use cache'

export async function useRealtimeProfile() {
  cacheLife('realtime')

  return await fetchLiveData()
}

'use cache'

export async function usePermanentProfile() {
  cacheLife('permanent')

  return await fetchStaticContent()
}
```

## Performance Optimization Tips

### 1. Match Cache Duration to Data Volatility

```typescript
// High volatility - short cache
'use cache'
export async function getHighVolatilityData() {
  cacheLife('seconds')
  return await fetchVolatileData()
}

// Low volatility - long cache
'use cache'
export async function getLowVolatilityData() {
  cacheLife('days')
  return await fetchStableData()
}
```

### 2. Use Stale-While-Revalidate for UX

```typescript
'use cache'

export async function getUXOptimizedData() {
  cacheLife({
    stale: 30,       // Instant response for 30s
    revalidate: 3600, // Background updates for 1 hour
    expire: 86400    // Hard limit at 24 hours
  })

  // Users always get instant response
  // Data stays reasonably fresh
  return await fetchData()
}
```

### 3. Avoid Over-Caching

```typescript
// ❌ Wrong - cache too long for frequently changing data
'use cache'
export async function getUserNotifications() {
  cacheLife('weeks') // User might miss notifications!
  return await fetchNotifications()
}

// ✅ Correct - appropriate cache duration
'use cache'
export async function getUserNotifications() {
  cacheLife('seconds') // Fresh notifications
  return await fetchNotifications()
}
```

## Monitoring Cache Performance

### Log Cache Behavior

```typescript
'use cache'

export async function monitoredCache() {
  const start = Date.now()

  cacheLife({
    stale: 60,
    revalidate: 3600
  })

  const data = await fetchData()
  const duration = Date.now() - start

  console.log(`Cache fetch duration: ${duration}ms`)

  return data
}
```

### Track Cache Freshness

```typescript
'use cache'

export async function trackedCache() {
  cacheLife('hours')

  const data = await fetchData()

  return {
    ...data,
    cachedAt: new Date().toISOString(),
    cacheProfile: 'hours'
  }
}
```

## Common Patterns by Use Case

### E-commerce Product Catalog

```typescript
'use cache'
export async function getProductCatalog() {
  cacheLife({
    stale: 300,      // Fresh for 5 minutes
    revalidate: 3600, // Update in background for 1 hour
    expire: 86400    // Full refresh daily
  })

  return await fetchProducts()
}
```

### News/Blog Content

```typescript
'use cache'
export async function getArticles() {
  cacheLife({
    stale: 600,      // Fresh for 10 minutes
    revalidate: 3600, // Background updates for 1 hour
    expire: 604800   // Expire after 1 week
  })

  return await fetchArticles()
}
```

### User Analytics Dashboard

```typescript
'use cache'
export async function getAnalytics() {
  cacheLife({
    stale: 300,      // 5 minute fresh data
    revalidate: 1800, // Revalidate for 30 minutes
    expire: 7200     // Expire after 2 hours
  })

  return await fetchAnalytics()
}
```

### Static Reference Data

```typescript
'use cache'
export async function getCountries() {
  cacheLife('weeks') // Rarely changes

  return await fetchCountries()
}
```

## Debugging Cache Lifecycle

### Test Different Phases

```typescript
'use cache'

export async function debugCacheLifecycle() {
  cacheLife({
    stale: 10,    // 10 second fresh phase
    revalidate: 30, // 30 second SWR phase
    expire: 60    // 60 second expiration
  })

  const timestamp = new Date().toISOString()
  console.log(`Fetched at: ${timestamp}`)

  return {
    data: await fetchData(),
    timestamp
  }
}

// Test:
// 0-10s: Cache hit, no log
// 10-30s: Cache hit with log (background revalidation)
// 30-60s: Similar to 10-30s
// 60s+: Cache miss, full refetch
```

## Best Practices

1. **Match duration to data volatility**: Short cache for frequently changing data
2. **Use stale-while-revalidate**: Better UX with instant responses
3. **Set reasonable expiration**: Prevent serving extremely stale data
4. **Use named profiles**: Start with built-ins, create custom as needed
5. **Monitor cache effectiveness**: Track hit rates and freshness
6. **Consider user expectations**: Balance freshness vs. performance
7. **Layer cache durations**: Different lifetimes for different data types
8. **Document cache decisions**: Explain why specific durations were chosen

## When to Use

Use `cacheLife` when you need to:
- Control how long data stays fresh
- Implement stale-while-revalidate pattern
- Balance data freshness with performance
- Set hard expiration limits
- Optimize for different data volatility levels
- Create predictable cache behavior

## Related

- See `use-cache.md` for basic caching
- See `cache-tags.md` for invalidation strategies
- See `isr.md` for time-based revalidation patterns
- See `cache-private.md` for user-specific caching
