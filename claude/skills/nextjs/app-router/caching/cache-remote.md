# use cache: remote

The `'use cache: remote'` directive enables caching in dynamic contexts where traditional caching might not work, such as edge runtime or serverless functions with dynamic data.

## Overview

Remote caching allows you to cache content that depends on dynamic runtime contexts like request headers, cookies, or geolocation, while still maintaining cache efficiency across distributed edge locations.

## Basic Usage

### Caching with Dynamic Headers

```typescript
// app/lib/geo-data.ts
import { headers } from 'next/headers'

'use cache: remote'

export async function getGeoLocalizedContent() {
  const headersList = await headers()
  const country = headersList.get('x-vercel-ip-country') || 'US'

  const res = await fetch(`https://api.example.com/content/${country}`)
  return res.json()
}
```

### Caching with Cookies

```typescript
// app/lib/localized-content.ts
import { cookies } from 'next/headers'

'use cache: remote'

export async function getLocalizedContent() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'en'

  const res = await fetch(`https://api.example.com/content?locale=${locale}`)
  return res.json()
}
```

### Edge Runtime Caching

```typescript
// app/lib/edge-data.ts
export const runtime = 'edge'

'use cache: remote'

export async function getEdgeCachedData() {
  // Cached at edge locations close to users
  const res = await fetch('https://api.example.com/data')
  return res.json()
}
```

## Cache Behavior

### Remote Cache Characteristics
- Cache entries are distributed across edge locations
- Cache keys include dynamic runtime context (headers, cookies, etc.)
- Separate cache entries for different contexts
- Optimized for globally distributed applications

### Cache Key Generation
Remote cache keys are based on:
- Request headers
- Cookies
- Geographic location
- Function arguments
- User agent

```typescript
import { headers } from 'next/headers'

'use cache: remote'

export async function getContextualData() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')
  const country = headersList.get('x-vercel-ip-country')

  // Cached separately per country and user agent combination
  const res = await fetch(`https://api.example.com/data?country=${country}`)
  return res.json()
}
```

## Advanced Patterns

### Geolocation-Based Caching

```typescript
import { headers } from 'next/headers'

'use cache: remote'

export async function getRegionalPricing() {
  const headersList = await headers()
  const country = headersList.get('x-vercel-ip-country')
  const region = headersList.get('x-vercel-ip-country-region')

  const res = await fetch(`/api/pricing?country=${country}&region=${region}`)
  return res.json()
}
```

### Device-Type Caching

```typescript
import { headers } from 'next/headers'

'use cache: remote'

export async function getDeviceOptimizedContent() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''

  const isMobile = /mobile/i.test(userAgent)
  const deviceType = isMobile ? 'mobile' : 'desktop'

  const res = await fetch(`/api/content?device=${deviceType}`)
  return res.json()
}
```

### A/B Testing with Remote Cache

```typescript
import { cookies } from 'next/headers'

'use cache: remote'

export async function getABTestContent() {
  const cookieStore = await cookies()
  const variant = cookieStore.get('ab-test-variant')?.value || 'A'

  // Cached separately for each variant
  const res = await fetch(`/api/content?variant=${variant}`)
  return res.json()
}
```

### Feature Flags with Remote Cache

```typescript
import { cookies } from 'next/headers'

'use cache: remote'

export async function getFeatureFlagContent() {
  const cookieStore = await cookies()
  const features = cookieStore.get('enabled-features')?.value || ''

  const res = await fetch(`/api/content?features=${features}`)
  return res.json()
}
```

### Multi-Language Caching

```typescript
import { headers } from 'next/headers'

'use cache: remote'

export async function getTranslatedContent() {
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language') || 'en'
  const primaryLang = acceptLanguage.split(',')[0]

  const res = await fetch(`/api/content?lang=${primaryLang}`)
  return res.json()
}
```

## Edge Runtime Optimization

### Edge-Optimized Data Fetching

```typescript
export const runtime = 'edge'

'use cache: remote'

export async function getEdgeOptimizedData() {
  // Automatically cached at nearest edge location
  const [products, categories] = await Promise.all([
    fetch('https://api.example.com/products').then(r => r.json()),
    fetch('https://api.example.com/categories').then(r => r.json())
  ])

  return { products, categories }
}
```

### Edge with Dynamic Imports

```typescript
export const runtime = 'edge'

'use cache: remote'

export async function getEdgeProcessedData() {
  // Heavy computation cached at edge
  const data = await fetch('https://api.example.com/raw-data').then(r => r.json())

  // Process data at edge
  const processed = data.map(item => ({
    ...item,
    processed: true,
    timestamp: Date.now()
  }))

  return processed
}
```

### Geographic Data Distribution

```typescript
import { headers } from 'next/headers'

export const runtime = 'edge'

'use cache: remote'

export async function getRegionalData() {
  const headersList = await headers()
  const region = headersList.get('x-vercel-ip-country') || 'US'

  // Cached at regional edge locations
  const res = await fetch(`https://api.example.com/regional/${region}`)
  return res.json()
}
```

## Performance Optimization Tips

### 1. Minimize Cache Key Variance

```typescript
// ❌ Too many cache variations
'use cache: remote'
export async function getTooSpecificData() {
  const headersList = await headers()
  const fullUserAgent = headersList.get('user-agent')
  // Creates unique cache per exact user agent string
  return fetch(`/api/data?ua=${fullUserAgent}`)
}

// ✅ Reduce cache key variance
'use cache: remote'
export async function getOptimizedData() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''
  const deviceType = /mobile/i.test(userAgent) ? 'mobile' : 'desktop'
  // Only 2 cache variations: mobile or desktop
  return fetch(`/api/data?device=${deviceType}`)
}
```

### 2. Group Context-Dependent Data

```typescript
// ✅ Batch context-dependent fetches
'use cache: remote'
export async function getBatchedContextData() {
  const headersList = await headers()
  const country = headersList.get('x-vercel-ip-country')

  // Single cached entry per country with all needed data
  const [pricing, shipping, taxes] = await Promise.all([
    fetch(`/api/pricing/${country}`).then(r => r.json()),
    fetch(`/api/shipping/${country}`).then(r => r.json()),
    fetch(`/api/taxes/${country}`).then(r => r.json())
  ])

  return { pricing, shipping, taxes }
}
```

### 3. Edge Location Awareness

```typescript
export const runtime = 'edge'

'use cache: remote'

export async function getEdgeAwareData() {
  const headersList = await headers()
  const edgeRegion = headersList.get('x-vercel-edge-region')

  console.log(`Serving from edge region: ${edgeRegion}`)

  // Optimize based on edge location
  const res = await fetch('https://api.example.com/data', {
    headers: {
      'X-Edge-Region': edgeRegion || 'default'
    }
  })

  return res.json()
}
```

## Common Use Cases

### CDN-Style Content Delivery

```typescript
import { headers } from 'next/headers'

'use cache: remote'

export async function getCDNContent(path: string) {
  const headersList = await headers()
  const acceptEncoding = headersList.get('accept-encoding')

  // Serve compressed content based on client capabilities
  const supportsWebP = acceptEncoding?.includes('webp')

  const res = await fetch(`/api/content${path}?format=${supportsWebP ? 'webp' : 'jpg'}`)
  return res.json()
}
```

### Dynamic Pricing by Region

```typescript
import { headers } from 'next/headers'

'use cache: remote'

export async function getDynamicPricing(productId: string) {
  const headersList = await headers()
  const country = headersList.get('x-vercel-ip-country')
  const currency = getCurrencyForCountry(country)

  const res = await fetch(`/api/products/${productId}/price?currency=${currency}`)
  return res.json()
}

function getCurrencyForCountry(country: string | null): string {
  const currencyMap: Record<string, string> = {
    'US': 'USD',
    'GB': 'GBP',
    'EU': 'EUR',
    'JP': 'JPY'
  }
  return currencyMap[country || 'US'] || 'USD'
}
```

### Personalized Anonymous Content

```typescript
import { cookies } from 'next/headers'

'use cache: remote'

export async function getAnonymousPersonalization() {
  const cookieStore = await cookies()
  const preferences = cookieStore.get('preferences')?.value

  // Cache personalized content without user authentication
  const res = await fetch(`/api/content?prefs=${preferences}`)
  return res.json()
}
```

### Time-Zone Aware Content

```typescript
import { headers } from 'next/headers'

'use cache: remote'

export async function getTimeZoneContent() {
  const headersList = await headers()
  const timezone = headersList.get('x-vercel-ip-timezone')

  const res = await fetch(`/api/content?tz=${timezone}`)
  return res.json()
}
```

## Cache Invalidation

### Remote Cache Invalidation

```typescript
import { revalidateTag, cacheTag } from 'next/cache'

'use cache: remote'

export async function getRemoteTaggedData() {
  const headersList = await headers()
  const country = headersList.get('x-vercel-ip-country')

  cacheTag(`content-${country}`)

  const res = await fetch(`/api/content/${country}`)
  return res.json()
}

// Invalidate specific region's cache
export async function invalidateRegionCache(country: string) {
  revalidateTag(`content-${country}`)
}
```

### Global Remote Cache Invalidation

```typescript
import { revalidateTag, cacheTag } from 'next/cache'

'use cache: remote'

export async function getGlobalRemoteData() {
  cacheTag('global-content')

  const res = await fetch('/api/global-content')
  return res.json()
}

// Invalidate all remote caches
export async function invalidateAllRemoteCaches() {
  revalidateTag('global-content')
}
```

## Debugging Remote Cache

### Log Cache Context

```typescript
'use cache: remote'

export async function debugRemoteCache() {
  const headersList = await headers()
  const context = {
    country: headersList.get('x-vercel-ip-country'),
    city: headersList.get('x-vercel-ip-city'),
    region: headersList.get('x-vercel-ip-country-region'),
    timezone: headersList.get('x-vercel-ip-timezone')
  }

  console.log('Remote cache context:', context)

  return await fetchData(context)
}
```

### Monitor Edge Performance

```typescript
export const runtime = 'edge'

'use cache: remote'

export async function monitorEdgeCache() {
  const start = Date.now()

  const data = await fetch('/api/data').then(r => r.json())

  const duration = Date.now() - start
  console.log(`Edge fetch completed in ${duration}ms`)

  return data
}
```

## Best Practices

1. **Minimize cache key variance**: Group similar contexts to improve cache hit rates
2. **Use for edge-compatible data**: Perfect for CDN-style content delivery
3. **Consider geographic distribution**: Leverage edge locations for global performance
4. **Tag for invalidation**: Use cache tags for precise cache control
5. **Monitor cache hit rates**: Track performance across different regions/contexts
6. **Balance specificity vs. hit rate**: More specific keys = lower hit rates
7. **Test across contexts**: Verify caching works correctly for different headers/cookies
8. **Use with edge runtime**: Maximize performance with edge deployment

## When to Use

Use `'use cache: remote'` for:
- Geolocation-based content
- Multi-language/localization
- Device-specific content
- A/B test variants
- Feature flag-dependent content
- Edge runtime functions
- CDN-style content delivery
- Dynamic but cacheable content

## When NOT to Use

Don't use `'use cache: remote'` for:
- Simple static content (use `'use cache'` instead)
- User-authenticated content (use `'use cache: private'` instead)
- Real-time data (no caching)
- Context-independent data (use regular `'use cache'`)
- Very high variance contexts (too many cache entries)

## Related

- See `use-cache.md` for global caching
- See `cache-private.md` for user-specific caching
- See `cache-lifecycle.md` for cache expiration control
- See `cache-tags.md` for invalidation strategies
- See `client-cache.md` for client-side caching
