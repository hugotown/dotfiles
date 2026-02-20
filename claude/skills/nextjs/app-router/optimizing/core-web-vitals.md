# Core Web Vitals Optimization

Optimize for Google's Core Web Vitals to improve user experience and search rankings.

## Understanding Core Web Vitals

### The Three Metrics

1. **Largest Contentful Paint (LCP)**: Loading performance
   - Target: < 2.5 seconds
   - Measures when the largest content element becomes visible

2. **First Input Delay (FID) / Interaction to Next Paint (INP)**: Interactivity
   - FID Target: < 100 milliseconds
   - INP Target: < 200 milliseconds
   - Measures responsiveness to user interactions

3. **Cumulative Layout Shift (CLS)**: Visual stability
   - Target: < 0.1
   - Measures unexpected layout shifts

## Measuring Core Web Vitals

### Built-in Next.js Analytics

```tsx
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### Web Vitals Library

```bash
npm install web-vitals
```

```tsx
// app/web-vitals.tsx
'use client'

import { useEffect } from 'react'
import { onCLS, onFID, onLCP, onFCP, onTTFB, onINP } from 'web-vitals'

export function WebVitals() {
  useEffect(() => {
    onCLS(console.log)
    onFID(console.log)
    onLCP(console.log)
    onFCP(console.log)
    onTTFB(console.log)
    onINP(console.log)
  }, [])

  return null
}
```

```tsx
// app/layout.tsx
import { WebVitals } from './web-vitals'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <WebVitals />
      </body>
    </html>
  )
}
```

### Send to Analytics

```tsx
// app/web-vitals.tsx
'use client'

import { useEffect } from 'react'
import { onCLS, onFID, onLCP, onINP } from 'web-vitals'

function sendToAnalytics(metric) {
  // Send to Google Analytics
  if (window.gtag) {
    window.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      value: Math.round(metric.value),
      event_label: metric.id,
      non_interaction: true,
    })
  }

  // Or send to custom endpoint
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify(metric),
  })
}

export function WebVitals() {
  useEffect(() => {
    onCLS(sendToAnalytics)
    onFID(sendToAnalytics)
    onLCP(sendToAnalytics)
    onINP(sendToAnalytics)
  }, [])

  return null
}
```

## Optimizing LCP (Largest Contentful Paint)

### 1. Optimize Images

```tsx
import Image from 'next/image'

// Bad - no optimization
<img src="/hero.jpg" alt="Hero" />

// Good - with next/image
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // Critical for LCP!
  quality={85}
/>
```

### 2. Preload Critical Resources

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/inter.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* Preload hero image */}
        <link
          rel="preload"
          href="/images/hero.jpg"
          as="image"
          imageSrcSet="/images/hero-400.jpg 400w, /images/hero-800.jpg 800w"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### 3. Server Components

Use Server Components for faster initial paint:

```tsx
// app/page.tsx - Server Component by default
export default async function Page() {
  const data = await fetchData() // Fetched on server

  return (
    <div>
      <h1>{data.title}</h1>
      <p>{data.content}</p>
    </div>
  )
}
```

### 4. Optimize Fonts

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Prevents invisible text
  preload: true,
})

export default function RootLayout({ children }) {
  return (
    <html className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### 5. Remove Render-Blocking Resources

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* Non-critical CSS - load async */}
        <link
          rel="stylesheet"
          href="/styles/non-critical.css"
          media="print"
          onLoad="this.media='all'"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### 6. Static Generation

Use static generation for better LCP:

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export default async function BlogPost({ params }) {
  const post = await getPost(params.slug)

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

## Optimizing FID/INP (Interactivity)

### 1. Minimize JavaScript

```tsx
// Bad - large client component
'use client'

import { useState } from 'react'
import HeavyLibrary from 'heavy-library'

export default function Page() {
  const [state, setState] = useState(null)
  return <HeavyLibrary />
}

// Good - server component with small client islands
export default function Page() {
  return (
    <div>
      <ServerContent />
      <SmallClientButton />
    </div>
  )
}
```

### 2. Code Splitting

```tsx
import dynamic from 'next/dynamic'

// Lazy load heavy interactive components
const DynamicChart = dynamic(() => import('@/components/Chart'), {
  loading: () => <p>Loading chart...</p>,
})

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <DynamicChart />
    </div>
  )
}
```

### 3. Optimize Third-Party Scripts

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      {/* Load after page is interactive */}
      <Script
        src="https://example.com/widget.js"
        strategy="afterInteractive"
      />

      {/* Or load during idle time */}
      <Script
        src="https://example.com/analytics.js"
        strategy="lazyOnload"
      />
    </>
  )
}
```

### 4. Debounce/Throttle Handlers

```tsx
'use client'

import { useState, useCallback } from 'react'

// Custom debounce hook
function useDebounce(callback, delay) {
  const [timeoutId, setTimeoutId] = useState(null)

  return useCallback(
    (...args) => {
      if (timeoutId) clearTimeout(timeoutId)

      const id = setTimeout(() => {
        callback(...args)
      }, delay)

      setTimeoutId(id)
    },
    [callback, delay, timeoutId]
  )
}

export default function SearchInput() {
  const handleSearch = useCallback((query) => {
    // Heavy search operation
    console.log('Searching for:', query)
  }, [])

  const debouncedSearch = useDebounce(handleSearch, 300)

  return (
    <input
      type="text"
      onChange={(e) => debouncedSearch(e.target.value)}
      placeholder="Search..."
    />
  )
}
```

### 5. Web Workers for Heavy Computation

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function DataProcessor() {
  const [result, setResult] = useState(null)

  useEffect(() => {
    const worker = new Worker(new URL('./worker.js', import.meta.url))

    worker.postMessage({ data: largeDataset })

    worker.onmessage = (e) => {
      setResult(e.data)
    }

    return () => worker.terminate()
  }, [])

  return <div>{result}</div>
}
```

```js
// worker.js
self.onmessage = (e) => {
  const { data } = e.data

  // Heavy computation
  const result = processData(data)

  self.postMessage(result)
}
```

### 6. React Transitions

```tsx
'use client'

import { useState, useTransition } from 'react'

export default function FilteredList({ items }) {
  const [filter, setFilter] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleFilterChange = (e) => {
    const value = e.target.value

    startTransition(() => {
      setFilter(value)
    })
  }

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <input
        type="text"
        onChange={handleFilterChange}
        placeholder="Filter..."
      />

      {isPending ? (
        <p>Updating...</p>
      ) : (
        <ul>
          {filteredItems.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

## Optimizing CLS (Cumulative Layout Shift)

### 1. Image Dimensions

```tsx
import Image from 'next/image'

// Bad - no dimensions, causes layout shift
<Image src="/image.jpg" alt="Image" />

// Good - with dimensions
<Image
  src="/image.jpg"
  alt="Image"
  width={800}
  height={600}
/>

// Or with fill and sized container
<div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
  <Image
    src="/image.jpg"
    alt="Image"
    fill
    style={{ objectFit: 'cover' }}
  />
</div>
```

### 2. Font Loading

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Prevents invisible text AND layout shift
  adjustFontFallback: true, // Matches fallback font metrics
})

export default function RootLayout({ children }) {
  return (
    <html className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### 3. Reserve Space for Dynamic Content

```tsx
// Bad - no space reserved
{isLoading ? null : <Content />}

// Good - space reserved
<div style={{ minHeight: '400px' }}>
  {isLoading ? <Skeleton /> : <Content />}
</div>
```

### 4. Avoid Inserting Content Above Existing

```tsx
// Bad - prepending content
const [items, setItems] = useState([])

const addItem = (item) => {
  setItems([item, ...items]) // Shifts everything down!
}

// Good - appending content
const addItem = (item) => {
  setItems([...items, item]) // No shift
}

// Or notify user and let them choose to load
const [newItems, setNewItems] = useState([])

return (
  <div>
    {newItems.length > 0 && (
      <button onClick={() => {
        setItems([...newItems, ...items])
        setNewItems([])
      }}>
        Load {newItems.length} new items
      </button>
    )}

    <List items={items} />
  </div>
)
```

### 5. Skeleton Screens

```tsx
// components/skeleton.tsx
export function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  )
}

// Usage
import { Suspense } from 'react'
import { Skeleton } from '@/components/skeleton'

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <AsyncContent />
    </Suspense>
  )
}
```

### 6. Aspect Ratio Containers

```tsx
// For videos, iframes, images
export function VideoPlayer({ src }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        allowFullScreen
      />
    </div>
  )
}
```

### 7. Ads and Embeds

```tsx
// Reserve space for ads
export function AdSlot() {
  return (
    <div
      style={{
        width: '300px',
        height: '250px',
        backgroundColor: '#f0f0f0',
      }}
    >
      {/* Ad content loads here */}
    </div>
  )
}
```

## Monitoring in Production

### Real User Monitoring (RUM)

```tsx
// app/rum.tsx
'use client'

import { useEffect } from 'react'
import { onCLS, onFID, onLCP, onINP } from 'web-vitals'

export function RUM() {
  useEffect(() => {
    const sendToRUM = (metric) => {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
        pathname: window.location.pathname,
      })

      // Use sendBeacon for reliability
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/rum', body)
      } else {
        fetch('/api/rum', {
          method: 'POST',
          body,
          keepalive: true,
        })
      }
    }

    onCLS(sendToRUM)
    onFID(sendToRUM)
    onLCP(sendToRUM)
    onINP(sendToRUM)
  }, [])

  return null
}
```

```tsx
// app/api/rum/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const metric = await request.json()

  // Log to your analytics service
  console.log('Core Web Vital:', metric)

  // Store in database, send to analytics, etc.

  return NextResponse.json({ success: true })
}
```

### Performance Observer

```tsx
'use client'

import { useEffect } from 'react'

export function PerformanceMonitor() {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log(`${entry.name}: ${entry.duration}ms`)

        // Send to analytics
        if (entry.duration > 1000) {
          console.warn('Slow operation detected:', entry.name)
        }
      }
    })

    observer.observe({
      entryTypes: ['measure', 'navigation', 'resource'],
    })

    return () => observer.disconnect()
  }, [])

  return null
}
```

## Testing Tools

1. **Chrome DevTools**: Lighthouse panel
2. **PageSpeed Insights**: https://pagespeed.web.dev/
3. **Web Vitals Extension**: Chrome extension for real-time metrics
4. **WebPageTest**: https://www.webpagetest.org/
5. **Vercel Analytics**: Built-in for Vercel deployments

## Best Practices Summary

### LCP Optimization
- [ ] Use `next/image` with `priority` for above-fold images
- [ ] Preload critical resources
- [ ] Use Server Components by default
- [ ] Optimize fonts with `next/font`
- [ ] Enable static generation where possible
- [ ] Minimize render-blocking resources

### FID/INP Optimization
- [ ] Minimize JavaScript bundle size
- [ ] Use code splitting and lazy loading
- [ ] Optimize third-party scripts
- [ ] Debounce/throttle event handlers
- [ ] Use web workers for heavy computation
- [ ] Implement React transitions for updates

### CLS Optimization
- [ ] Always specify image dimensions
- [ ] Use `font-display: swap` with matched fallbacks
- [ ] Reserve space for dynamic content
- [ ] Use skeleton screens
- [ ] Implement aspect ratio containers
- [ ] Avoid inserting content above existing content

## Common Issues & Solutions

### Issue: Large LCP

**Solution**: Preload critical images and fonts

```tsx
<link rel="preload" href="/hero.jpg" as="image" />
<link rel="preload" href="/font.woff2" as="font" crossOrigin="anonymous" />
```

### Issue: High FID/INP

**Solution**: Defer non-critical JavaScript

```tsx
<Script src="/widget.js" strategy="lazyOnload" />
```

### Issue: Layout Shifts

**Solution**: Reserve space and use placeholders

```tsx
<div style={{ minHeight: '400px' }}>
  <Suspense fallback={<Skeleton />}>
    <Content />
  </Suspense>
</div>
```

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [Next.js Analytics](https://nextjs.org/analytics)
- [Chrome UX Report](https://developers.google.com/web/tools/chrome-user-experience-report)
- [PageSpeed Insights](https://pagespeed.web.dev/)
