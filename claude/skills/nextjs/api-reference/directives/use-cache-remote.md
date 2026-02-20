# use cache remote

The `'use cache remote'` directive enables caching with dynamic contexts such as geolocation, device type, or other edge-computed values. This is particularly useful for edge-optimized applications that need to cache content based on request context.

## Syntax

```typescript
'use cache remote'
```

Must be placed at the **top** of a function or component file, before any imports.

## Use Cases

### 1. Geolocation-Based Content

Cache content based on user's geographic location.

```typescript
// app/lib/localized-content.ts
'use cache remote'

interface LocalizedContent {
  currency: string
  language: string
  featuredProducts: Product[]
  regionalPromotions: Promotion[]
}

export async function getLocalizedContent(
  country: string,
  region?: string
): Promise<LocalizedContent> {
  const currencyMap = {
    'US': 'USD',
    'GB': 'GBP',
    'EU': 'EUR',
    'JP': 'JPY'
  }

  const products = await db.product.findMany({
    where: {
      availableInCountries: { has: country }
    },
    take: 10
  })

  const promotions = await db.promotion.findMany({
    where: {
      targetCountries: { has: country },
      active: true
    }
  })

  return {
    currency: currencyMap[country as keyof typeof currencyMap] || 'USD',
    language: getLanguageForCountry(country),
    featuredProducts: products,
    regionalPromotions: promotions
  }
}

// Usage in middleware or edge function
export async function middleware(request: NextRequest) {
  const country = request.geo?.country || 'US'
  const region = request.geo?.region

  // This will be cached per country/region combination
  const content = await getLocalizedContent(country, region)

  // Store in headers for use in components
  const response = NextResponse.next()
  response.headers.set('x-user-country', country)
  return response
}
```

### 2. Device-Specific Rendering

Cache different renders based on device type.

```typescript
'use cache remote'

interface DeviceOptimizedContent {
  layout: 'mobile' | 'tablet' | 'desktop'
  imageSize: 'sm' | 'md' | 'lg'
  features: string[]
}

export async function getDeviceOptimizedContent(
  deviceType: 'mobile' | 'tablet' | 'desktop',
  category: string
): Promise<DeviceOptimizedContent> {
  const imageSizes = {
    mobile: 'sm',
    tablet: 'md',
    desktop: 'lg'
  } as const

  const featuresByDevice = {
    mobile: ['touch-optimized', 'simplified-nav'],
    tablet: ['touch-optimized', 'split-view'],
    desktop: ['full-featured', 'multi-column']
  }

  const content = await db.content.findMany({
    where: {
      category,
      deviceTypes: { has: deviceType }
    }
  })

  return {
    layout: deviceType,
    imageSize: imageSizes[deviceType],
    features: featuresByDevice[deviceType],
    content
  }
}
```

### 3. Edge-Computed Pricing

Cache pricing based on location, currency, and time.

```typescript
'use cache remote'

interface PricingContext {
  country: string
  currency: string
  timezone: string
}

interface PricingData {
  basePrice: number
  convertedPrice: number
  taxes: number
  shipping: number
  total: number
  applicableDiscounts: Discount[]
}

export async function getDynamicPricing(
  productId: string,
  context: PricingContext
): Promise<PricingData> {
  const product = await db.product.findUnique({
    where: { id: productId }
  })

  if (!product) {
    throw new Error('Product not found')
  }

  // Get live exchange rates
  const exchangeRate = await getExchangeRate('USD', context.currency)

  // Calculate location-based taxes
  const taxRate = await getTaxRate(context.country)

  // Get shipping cost
  const shippingCost = await getShippingCost(productId, context.country)

  // Check for time-based or location-based discounts
  const discounts = await db.discount.findMany({
    where: {
      productId,
      validCountries: { has: context.country },
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() }
    }
  })

  const convertedPrice = product.basePrice * exchangeRate
  const taxes = convertedPrice * taxRate
  const total = convertedPrice + taxes + shippingCost

  return {
    basePrice: product.basePrice,
    convertedPrice,
    taxes,
    shipping: shippingCost,
    total,
    applicableDiscounts: discounts
  }
}
```

### 4. Timezone-Aware Content

```typescript
'use cache remote'

interface TimeBasedContent {
  greeting: string
  featuredContent: Content[]
  availableSupport: boolean
  nextEventTime: Date | null
}

export async function getTimeBasedContent(
  timezone: string,
  userId?: string
): Promise<TimeBasedContent> {
  const now = new Date()
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const hour = localTime.getHours()

  // Time-appropriate greeting
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 18 ? 'Good afternoon' :
    'Good evening'

  // Show content relevant to current time
  const featuredContent = await db.content.findMany({
    where: {
      OR: [
        { scheduledFor: null },
        {
          scheduledFor: {
            lte: localTime
          },
          expiresAt: {
            gte: localTime
          }
        }
      ]
    },
    orderBy: { priority: 'desc' },
    take: 5
  })

  // Check if support is available in this timezone
  const supportHours = { start: 9, end: 17 }
  const availableSupport = hour >= supportHours.start && hour < supportHours.end

  // Get next scheduled event in user's timezone
  const nextEvent = await db.event.findFirst({
    where: {
      startTime: { gte: localTime },
      timezone: timezone
    },
    orderBy: { startTime: 'asc' }
  })

  return {
    greeting,
    featuredContent,
    availableSupport,
    nextEventTime: nextEvent?.startTime || null
  }
}
```

### 5. A/B Testing at the Edge

```typescript
'use cache remote'

interface Experiment {
  variantId: string
  config: Record<string, any>
  tracking: {
    experimentId: string
    assignedAt: Date
  }
}

export async function getExperimentVariant(
  experimentId: string,
  userId: string,
  context: { country: string; deviceType: string }
): Promise<Experiment> {
  // Check if user is already assigned to a variant
  let assignment = await db.experimentAssignment.findUnique({
    where: {
      experimentId_userId: {
        experimentId,
        userId
      }
    }
  })

  if (!assignment) {
    // Get experiment configuration
    const experiment = await db.experiment.findUnique({
      where: { id: experimentId },
      include: { variants: true }
    })

    if (!experiment) {
      throw new Error('Experiment not found')
    }

    // Filter variants by context
    const eligibleVariants = experiment.variants.filter(variant =>
      (!variant.targetCountries || variant.targetCountries.includes(context.country)) &&
      (!variant.targetDevices || variant.targetDevices.includes(context.deviceType))
    )

    // Assign variant (weighted random)
    const variant = selectVariant(eligibleVariants)

    // Store assignment
    assignment = await db.experimentAssignment.create({
      data: {
        experimentId,
        userId,
        variantId: variant.id,
        context
      }
    })
  }

  const variant = await db.variant.findUnique({
    where: { id: assignment.variantId }
  })

  return {
    variantId: variant!.id,
    config: variant!.config,
    tracking: {
      experimentId,
      assignedAt: assignment.createdAt
    }
  }
}
```

## Best Practices

### 1. Extract Context from Request

```typescript
'use cache remote'

import { headers } from 'next/headers'

export async function getContextAwareContent() {
  const headersList = await headers()

  const context = {
    country: headersList.get('x-vercel-ip-country') || 'US',
    region: headersList.get('x-vercel-ip-country-region') || '',
    city: headersList.get('x-vercel-ip-city') || '',
    timezone: headersList.get('x-vercel-ip-timezone') || 'UTC'
  }

  const content = await db.content.findMany({
    where: {
      targetCountries: { has: context.country }
    }
  })

  return {
    context,
    content
  }
}
```

### 2. Use Middleware for Context Propagation

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'US'
  const region = request.geo?.region || ''
  const city = request.geo?.city || ''

  // Add to headers for use in components
  const response = NextResponse.next()
  response.headers.set('x-user-country', country)
  response.headers.set('x-user-region', region)
  response.headers.set('x-user-city', city)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### 3. Cache Control Headers

```typescript
'use cache remote'

export async function getRegionalData(country: string) {
  const data = await fetchRegionalData(country)

  return {
    data,
    cacheControl: {
      // Cache at edge for 1 hour
      maxAge: 3600,
      // Serve stale while revalidating
      staleWhileRevalidate: 86400
    }
  }
}
```

### 4. Fallback for Unknown Contexts

```typescript
'use cache remote'

const DEFAULT_COUNTRY = 'US'
const SUPPORTED_COUNTRIES = ['US', 'GB', 'DE', 'FR', 'JP']

export async function getLocalizedProduct(
  productId: string,
  country?: string
) {
  const targetCountry = country && SUPPORTED_COUNTRIES.includes(country)
    ? country
    : DEFAULT_COUNTRY

  const product = await db.product.findUnique({
    where: { id: productId }
  })

  const localization = await db.productLocalization.findFirst({
    where: {
      productId,
      country: targetCountry
    }
  }) || await db.productLocalization.findFirst({
    where: {
      productId,
      country: DEFAULT_COUNTRY
    }
  })

  return {
    ...product,
    ...localization
  }
}
```

## Common Pitfalls to Avoid

### 1. Don't Over-Segment Cache

```typescript
// Bad - too many cache segments
'use cache remote'
export async function getContent(
  country: string,
  region: string,
  city: string,
  postalCode: string,
  language: string,
  device: string
) {
  // Too granular - cache will rarely hit
}

// Good - meaningful segments only
'use cache remote'
export async function getContent(
  country: string,
  language: string
) {
  // Reasonable granularity
}
```

### 2. Handle Missing Geo Data

```typescript
// Bad - crashes when geo data unavailable
'use cache remote'
export async function getLocalContent(country: string, city: string) {
  return await db.content.findMany({
    where: { city } // city might be undefined
  })
}

// Good - provide defaults
'use cache remote'
export async function getLocalContent(
  country: string = 'US',
  city?: string
) {
  return await db.content.findMany({
    where: {
      country,
      ...(city && { city })
    }
  })
}
```

### 3. Avoid Sensitive Context Caching

```typescript
// Bad - caching with IP address
'use cache remote'
export async function trackUser(ipAddress: string) {
  // Privacy concern - don't cache with PII
}

// Good - use anonymized context
'use cache remote'
export async function getAnonymizedMetrics(country: string) {
  // Aggregate, anonymized data only
}
```

### 4. Monitor Cache Hit Rates

```typescript
'use cache remote'

export async function getOptimizedContent(
  country: string,
  locale: string
) {
  // Log cache performance
  const cacheKey = `content-${country}-${locale}`
  console.log(`Cache lookup: ${cacheKey}`)

  const content = await db.content.findMany({
    where: {
      countries: { has: country },
      locale
    }
  })

  return content
}
```

## Performance Considerations

- **Edge Distribution**: Cached at edge locations closest to users
- **Cache Granularity**: Balance between hit rate and personalization
- **Network Latency**: Reduce by caching at edge with regional context
- **Memory Usage**: Monitor cache size across edge locations

## TypeScript Support

```typescript
'use cache remote'

interface GeoContext {
  country: string
  region?: string
  city?: string
  timezone: string
}

interface LocalizedResponse<T> {
  data: T
  context: GeoContext
  cacheMetadata: {
    key: string
    ttl: number
  }
}

export async function getGeoContent<T>(
  context: GeoContext,
  fetcher: (ctx: GeoContext) => Promise<T>
): Promise<LocalizedResponse<T>> {
  const data = await fetcher(context)

  return {
    data,
    context,
    cacheMetadata: {
      key: `geo-${context.country}-${context.timezone}`,
      ttl: 3600
    }
  }
}
```

## Related Directives

- [use cache](./use-cache.md) - Standard caching
- [use cache private](./use-cache-private.md) - Per-user caching
- [use client](./use-client.md) - Client Components
