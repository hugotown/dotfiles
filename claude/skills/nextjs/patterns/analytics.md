# Analytics in Next.js

Complete guide to implementing analytics in Next.js applications, including Web Vitals tracking, custom metrics, and third-party analytics integration.

## Table of Contents

1. [Web Vitals](#web-vitals)
2. [Google Analytics](#google-analytics)
3. [Custom Analytics](#custom-analytics)
4. [Event Tracking](#event-tracking)
5. [Performance Monitoring](#performance-monitoring)
6. [Third-Party Integrations](#third-party-integrations)
7. [Privacy and GDPR](#privacy-and-gdpr)
8. [Best Practices](#best-practices)

## Web Vitals

### Built-in Web Vitals Reporting

```typescript
// app/layout.tsx
import { Analytics } from '@/components/Analytics'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

```typescript
// components/Analytics.tsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function Analytics() {
  useReportWebVitals((metric) => {
    console.log(metric)

    // Send to analytics endpoint
    const body = JSON.stringify(metric)
    const url = '/api/analytics'

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body)
    } else {
      fetch(url, { body, method: 'POST', keepalive: true })
    }
  })

  return null
}
```

### Web Vitals Metrics

```typescript
// types/web-vitals.ts
export type Metric = {
  id: string           // Unique ID for the metric
  name: string         // Metric name (CLS, FCP, FID, LCP, TTFB, INP)
  value: number        // Metric value
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number        // Delta between current and previous value
  navigationType: string
}

// Core Web Vitals
// - LCP (Largest Contentful Paint): < 2.5s (good), > 4s (poor)
// - FID (First Input Delay): < 100ms (good), > 300ms (poor)
// - CLS (Cumulative Layout Shift): < 0.1 (good), > 0.25 (poor)
// - INP (Interaction to Next Paint): < 200ms (good), > 500ms (poor)

// Other Metrics
// - FCP (First Contentful Paint)
// - TTFB (Time to First Byte)
```

### Analytics API Route

```typescript
// app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const metric = await request.json()

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Web Vital:', metric)
  }

  // Send to analytics service
  try {
    await sendToAnalytics(metric)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to track metric' },
      { status: 500 }
    )
  }
}

async function sendToAnalytics(metric: any) {
  // Example: Send to Google Analytics
  if (process.env.GA_MEASUREMENT_ID) {
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: metric.id,
        events: [{
          name: metric.name,
          params: {
            value: metric.value,
            metric_rating: metric.rating,
            metric_delta: metric.delta,
          },
        }],
      }),
    })
  }

  // Example: Send to custom analytics
  // await customAnalytics.track(metric)
}
```

## Google Analytics

### Google Analytics 4 (GA4)

```bash
npm install @next/third-parties
```

```typescript
// app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
      </body>
    </html>
  )
}
```

### Custom GA4 Implementation

```typescript
// lib/gtag.ts
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url: string) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('config', GA_TRACKING_ID, {
      page_path: url,
    })
  }
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({
  action,
  category,
  label,
  value,
}: {
  action: string
  category: string
  label?: string
  value?: number
}) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event',
      targetId: string,
      config?: any
    ) => void
  }
}
```

```typescript
// components/GoogleAnalytics.tsx
'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import * as gtag from '@/lib/gtag'

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '')
      gtag.pageview(url)
    }
  }, [pathname, searchParams])

  if (!gtag.GA_TRACKING_ID) {
    return null
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gtag.GA_TRACKING_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gtag.GA_TRACKING_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  )
}
```

### Track Events

```typescript
// components/Button.tsx
'use client'

import * as gtag from '@/lib/gtag'

export default function Button() {
  const handleClick = () => {
    gtag.event({
      action: 'click',
      category: 'Button',
      label: 'CTA Button',
      value: 1,
    })

    // Your button logic
  }

  return <button onClick={handleClick}>Click Me</button>
}
```

## Custom Analytics

### Build Custom Analytics System

```typescript
// lib/analytics.ts
class Analytics {
  private endpoint = '/api/analytics/events'

  track(eventName: string, properties?: Record<string, any>) {
    const event = {
      name: eventName,
      properties,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
    }

    this.send(event)
  }

  page(pageName?: string) {
    this.track('page_view', {
      page: pageName || document.title,
      path: window.location.pathname,
    })
  }

  identify(userId: string, traits?: Record<string, any>) {
    this.track('identify', {
      userId,
      traits,
    })
  }

  private send(event: any) {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.endpoint, JSON.stringify(event))
    } else {
      fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true,
      }).catch(console.error)
    }
  }
}

export const analytics = new Analytics()
```

### Analytics Context

```typescript
// components/AnalyticsProvider.tsx
'use client'

import { createContext, useContext, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { analytics } from '@/lib/analytics'

const AnalyticsContext = createContext(analytics)

export function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  useEffect(() => {
    analytics.page()
  }, [pathname])

  return (
    <AnalyticsContext.Provider value={analytics}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export const useAnalytics = () => useContext(AnalyticsContext)
```

### Usage in Components

```typescript
// app/page.tsx
'use client'

import { useAnalytics } from '@/components/AnalyticsProvider'

export default function HomePage() {
  const analytics = useAnalytics()

  const handleAction = () => {
    analytics.track('button_clicked', {
      button: 'hero_cta',
      location: 'homepage',
    })
  }

  return <button onClick={handleAction}>Get Started</button>
}
```

## Event Tracking

### Click Tracking

```typescript
// hooks/useClickTracking.ts
import { useAnalytics } from '@/components/AnalyticsProvider'

export function useClickTracking(eventName: string, properties?: Record<string, any>) {
  const analytics = useAnalytics()

  return () => {
    analytics.track(eventName, properties)
  }
}

// Usage
import { useClickTracking } from '@/hooks/useClickTracking'

export default function Component() {
  const trackClick = useClickTracking('feature_clicked', {
    feature: 'dark_mode_toggle',
  })

  return <button onClick={trackClick}>Toggle Dark Mode</button>
}
```

### Form Tracking

```typescript
// hooks/useFormTracking.ts
import { useAnalytics } from '@/components/AnalyticsProvider'

export function useFormTracking(formName: string) {
  const analytics = useAnalytics()

  const trackStart = () => {
    analytics.track('form_started', { form: formName })
  }

  const trackComplete = () => {
    analytics.track('form_completed', { form: formName })
  }

  const trackError = (field: string, error: string) => {
    analytics.track('form_error', {
      form: formName,
      field,
      error,
    })
  }

  return { trackStart, trackComplete, trackError }
}

// Usage
import { useFormTracking } from '@/hooks/useFormTracking'

export default function SignupForm() {
  const { trackStart, trackComplete, trackError } = useFormTracking('signup')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await submitForm()
      trackComplete()
    } catch (error) {
      trackError('general', error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} onFocus={trackStart}>
      {/* form fields */}
    </form>
  )
}
```

### Scroll Tracking

```typescript
// hooks/useScrollTracking.ts
import { useEffect } from 'react'
import { useAnalytics } from '@/components/AnalyticsProvider'

export function useScrollTracking(thresholds: number[] = [25, 50, 75, 100]) {
  const analytics = useAnalytics()

  useEffect(() => {
    const trackedDepths = new Set<number>()

    const handleScroll = () => {
      const scrollPercent =
        (window.scrollY + window.innerHeight) /
        document.documentElement.scrollHeight * 100

      thresholds.forEach((threshold) => {
        if (scrollPercent >= threshold && !trackedDepths.has(threshold)) {
          trackedDepths.add(threshold)
          analytics.track('scroll_depth', {
            depth: threshold,
            path: window.location.pathname,
          })
        }
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [analytics, thresholds])
}
```

## Performance Monitoring

### Performance Observer

```typescript
// lib/performance.ts
export function observePerformance() {
  if (typeof window === 'undefined') return

  // Observe long tasks
  const longTaskObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      analytics.track('long_task', {
        duration: entry.duration,
        startTime: entry.startTime,
      })
    }
  })

  longTaskObserver.observe({ entryTypes: ['longtask'] })

  // Observe resource timing
  const resourceObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const resource = entry as PerformanceResourceTiming

      if (resource.duration > 1000) {
        analytics.track('slow_resource', {
          name: resource.name,
          duration: resource.duration,
          type: resource.initiatorType,
        })
      }
    }
  })

  resourceObserver.observe({ entryTypes: ['resource'] })
}
```

### Navigation Timing

```typescript
// lib/navigation-timing.ts
export function reportNavigationTiming() {
  if (typeof window === 'undefined') return

  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

    analytics.track('navigation_timing', {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      download: navigation.responseEnd - navigation.responseStart,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
      domComplete: navigation.domComplete - navigation.fetchStart,
      loadComplete: navigation.loadEventEnd - navigation.fetchStart,
    })
  })
}
```

## Third-Party Integrations

### Vercel Analytics

```bash
npm install @vercel/analytics
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Plausible Analytics

```typescript
// components/PlausibleAnalytics.tsx
'use client'

import Script from 'next/script'

export default function PlausibleAnalytics() {
  return (
    <Script
      defer
      data-domain={process.env.NEXT_PUBLIC_DOMAIN}
      src="https://plausible.io/js/script.js"
    />
  )
}
```

### Mixpanel

```bash
npm install mixpanel-browser
```

```typescript
// lib/mixpanel.ts
import mixpanel from 'mixpanel-browser'

mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN!, {
  debug: process.env.NODE_ENV === 'development',
  track_pageview: true,
  persistence: 'localStorage',
})

export { mixpanel }
```

```typescript
// components/MixpanelProvider.tsx
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { mixpanel } from '@/lib/mixpanel'

export default function MixpanelProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  useEffect(() => {
    mixpanel.track_pageview()
  }, [pathname])

  return <>{children}</>
}
```

### Segment

```bash
npm install @segment/analytics-next
```

```typescript
// lib/segment.ts
import { AnalyticsBrowser } from '@segment/analytics-next'

export const analytics = AnalyticsBrowser.load({
  writeKey: process.env.NEXT_PUBLIC_SEGMENT_WRITE_KEY!,
})
```

## Privacy and GDPR

### Cookie Consent

```typescript
// components/CookieConsent.tsx
'use client'

import { useState, useEffect } from 'react'

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      setShowBanner(true)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    setShowBanner(false)

    // Initialize analytics
    initializeAnalytics()
  }

  const declineCookies = () => {
    localStorage.setItem('cookie-consent', 'declined')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50">
      <div className="container mx-auto flex items-center justify-between">
        <p>
          We use cookies to improve your experience. By using our site, you
          agree to our cookie policy.
        </p>
        <div className="flex gap-4">
          <button
            onClick={declineCookies}
            className="px-4 py-2 border border-white rounded"
          >
            Decline
          </button>
          <button
            onClick={acceptCookies}
            className="px-4 py-2 bg-white text-gray-900 rounded"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Conditional Analytics Loading

```typescript
// lib/analytics.ts
export function initializeAnalytics() {
  const consent = localStorage.getItem('cookie-consent')

  if (consent === 'accepted') {
    // Initialize Google Analytics
    if (process.env.NEXT_PUBLIC_GA_ID) {
      initGA()
    }

    // Initialize Mixpanel
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      initMixpanel()
    }
  }
}

export function hasAnalyticsConsent(): boolean {
  return localStorage.getItem('cookie-consent') === 'accepted'
}
```

### Do Not Track

```typescript
// lib/dnt.ts
export function respectDoNotTrack(): boolean {
  if (typeof window === 'undefined') return true

  const dnt = navigator.doNotTrack || (window as any).doNotTrack || (navigator as any).msDoNotTrack

  return dnt === '1' || dnt === 'yes'
}

// Usage
if (!respectDoNotTrack()) {
  analytics.track('page_view')
}
```

## Best Practices

### 1. Debounce Tracking Events

```typescript
// lib/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Usage
const trackSearch = debounce((query: string) => {
  analytics.track('search', { query })
}, 500)
```

### 2. Batch Events

```typescript
// lib/analytics-batch.ts
class BatchAnalytics {
  private queue: any[] = []
  private flushInterval = 5000 // 5 seconds
  private maxBatchSize = 10

  constructor() {
    setInterval(() => this.flush(), this.flushInterval)
  }

  track(event: any) {
    this.queue.push(event)

    if (this.queue.length >= this.maxBatchSize) {
      this.flush()
    }
  }

  private async flush() {
    if (this.queue.length === 0) return

    const events = [...this.queue]
    this.queue = []

    await fetch('/api/analytics/batch', {
      method: 'POST',
      body: JSON.stringify({ events }),
    })
  }
}

export const batchAnalytics = new BatchAnalytics()
```

### 3. Error Boundary with Analytics

```typescript
// components/ErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'
import { analytics } from '@/lib/analytics'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    analytics.track('error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>
    }

    return this.props.children
  }
}
```

## Common Pitfalls

1. **Tracking too many events**: Focus on meaningful metrics
2. **Not respecting privacy**: Implement consent management
3. **Blocking page load**: Load analytics asynchronously
4. **Tracking PII**: Never track personally identifiable information
5. **Not testing tracking**: Verify events in development
6. **Missing error handling**: Gracefully handle analytics failures
7. **Not documenting events**: Maintain event taxonomy
8. **Duplicate tracking**: Ensure events are tracked once

## Resources

- [Next.js Analytics Documentation](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)
- [Web Vitals](https://web.dev/vitals/)
- [Google Analytics 4](https://developers.google.com/analytics/devguides/collection/ga4)
- [Vercel Analytics](https://vercel.com/docs/analytics)
- [Plausible Analytics](https://plausible.io/docs)
