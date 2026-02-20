# Lazy Loading & Code Splitting

Optimize your Next.js application by loading components and modules only when needed.

## Core Concepts

Lazy loading reduces initial JavaScript bundle size by splitting code and loading it on demand.

### Benefits

- Faster initial page load
- Reduced bundle size
- Better performance on slower connections
- Improved Time to Interactive (TTI)

## Dynamic Imports

### Basic Dynamic Import

```tsx
import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(() => import('@/components/HeavyComponent'))

export default function Page() {
  return (
    <div>
      <h1>My Page</h1>
      <DynamicComponent />
    </div>
  )
}
```

### With Named Exports

```tsx
import dynamic from 'next/dynamic'

const DynamicChart = dynamic(
  () => import('@/components/Charts').then((mod) => mod.LineChart)
)

export default function Dashboard() {
  return <DynamicChart data={data} />
}
```

### With Loading State

```tsx
import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  {
    loading: () => <div>Loading...</div>,
  }
)

export default function Page() {
  return <DynamicComponent />
}
```

### Custom Loading Component

```tsx
import dynamic from 'next/dynamic'

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}

const DynamicComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  {
    loading: LoadingSpinner,
  }
)
```

### Disable SSR

For components that rely on browser APIs:

```tsx
import dynamic from 'next/dynamic'

const MapComponent = dynamic(
  () => import('@/components/Map'),
  {
    ssr: false,
    loading: () => <div>Loading map...</div>,
  }
)

export default function Page() {
  return <MapComponent />
}
```

## Conditional Loading

### Load on User Interaction

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const DynamicModal = dynamic(() => import('@/components/Modal'))

export default function Page() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <button onClick={() => setShowModal(true)}>
        Open Modal
      </button>

      {showModal && <DynamicModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
```

### Load on Scroll

```tsx
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const DynamicComments = dynamic(() => import('@/components/Comments'), {
  loading: () => <div>Loading comments...</div>,
})

export default function BlogPost() {
  const [showComments, setShowComments] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      if (scrollPosition > documentHeight * 0.7) {
        setShowComments(true)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div>
      <article>{/* Article content */}</article>
      {showComments && <DynamicComments />}
    </div>
  )
}
```

### Load on Viewport Intersection

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const DynamicGallery = dynamic(() => import('@/components/Gallery'))

export default function Page() {
  const [shouldLoad, setShouldLoad] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (triggerRef.current) {
      observer.observe(triggerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div>
      <div ref={triggerRef}>
        {shouldLoad ? <DynamicGallery /> : <div className="h-96" />}
      </div>
    </div>
  )
}
```

## Route-Based Code Splitting

Next.js automatically code splits by route, but you can optimize further:

### Layout-Level Lazy Loading

```tsx
// app/dashboard/layout.tsx
import dynamic from 'next/dynamic'

const DynamicSidebar = dynamic(() => import('@/components/Sidebar'))
const DynamicHeader = dynamic(() => import('@/components/Header'))

export default function DashboardLayout({ children }) {
  return (
    <div>
      <DynamicHeader />
      <div className="flex">
        <DynamicSidebar />
        <main>{children}</main>
      </div>
    </div>
  )
}
```

### Nested Routes

```tsx
// app/products/[id]/page.tsx
import dynamic from 'next/dynamic'

const DynamicReviews = dynamic(() => import('@/components/Reviews'))
const DynamicRecommendations = dynamic(() => import('@/components/Recommendations'))

export default function ProductPage({ params }) {
  return (
    <div>
      <ProductDetails id={params.id} />
      <DynamicReviews productId={params.id} />
      <DynamicRecommendations productId={params.id} />
    </div>
  )
}
```

## Library Code Splitting

### Heavy Libraries

```tsx
'use client'

import { useState } from 'react'

export default function ChartPage() {
  const [chartData, setChartData] = useState(null)

  const loadChart = async () => {
    // Load Chart.js only when needed
    const { Chart } = await import('chart.js/auto')

    const data = {
      labels: ['Jan', 'Feb', 'Mar'],
      datasets: [{
        label: 'Sales',
        data: [12, 19, 3],
      }],
    }

    setChartData(data)
  }

  return (
    <div>
      <button onClick={loadChart}>Load Chart</button>
      {chartData && <canvas id="myChart" />}
    </div>
  )
}
```

### Date Libraries

```tsx
'use client'

import { useState } from 'react'

export default function DatePicker() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const handleDateSelect = async () => {
    // Load date-fns only when needed
    const { format } = await import('date-fns')
    const formatted = format(new Date(), 'yyyy-MM-dd')
    console.log(formatted)
  }

  return <button onClick={handleDateSelect}>Select Date</button>
}
```

### Editor Components

```tsx
import dynamic from 'next/dynamic'

const DynamicEditor = dynamic(
  () => import('@/components/RichTextEditor'),
  {
    ssr: false,
    loading: () => <div>Loading editor...</div>,
  }
)

export default function EditorPage() {
  return (
    <div>
      <h1>Edit Content</h1>
      <DynamicEditor />
    </div>
  )
}
```

## React.lazy Integration

### Basic React.lazy

```tsx
'use client'

import { Suspense, lazy } from 'react'

const LazyComponent = lazy(() => import('@/components/HeavyComponent'))

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent />
    </Suspense>
  )
}
```

### Multiple Lazy Components

```tsx
'use client'

import { Suspense, lazy } from 'react'

const LazyChart = lazy(() => import('@/components/Chart'))
const LazyTable = lazy(() => import('@/components/Table'))
const LazyMap = lazy(() => import('@/components/Map'))

export default function Dashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Suspense fallback={<div>Loading chart...</div>}>
        <LazyChart />
      </Suspense>

      <Suspense fallback={<div>Loading table...</div>}>
        <LazyTable />
      </Suspense>

      <Suspense fallback={<div>Loading map...</div>}>
        <LazyMap />
      </Suspense>
    </div>
  )
}
```

### Nested Suspense

```tsx
'use client'

import { Suspense, lazy } from 'react'

const LazyContent = lazy(() => import('@/components/Content'))
const LazyComments = lazy(() => import('@/components/Comments'))

export default function BlogPost() {
  return (
    <div>
      <Suspense fallback={<div>Loading post...</div>}>
        <LazyContent />

        <Suspense fallback={<div>Loading comments...</div>}>
          <LazyComments />
        </Suspense>
      </Suspense>
    </div>
  )
}
```

## Advanced Patterns

### Lazy Loading with Props

```tsx
import dynamic from 'next/dynamic'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

const DynamicModal = dynamic<ModalProps>(
  () => import('@/components/Modal')
)

export default function Page() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <button onClick={() => setShowModal(true)}>Open</button>

      {showModal && (
        <DynamicModal
          title="Welcome"
          onClose={() => setShowModal(false)}
        >
          <p>Modal content</p>
        </DynamicModal>
      )}
    </div>
  )
}
```

### Prefetching

```tsx
'use client'

import { useState } from 'react'

export default function Page() {
  const [Component, setComponent] = useState<any>(null)

  const prefetchComponent = () => {
    // Prefetch on hover
    import('@/components/HeavyComponent').then((mod) => {
      setComponent(() => mod.default)
    })
  }

  return (
    <div>
      <button
        onMouseEnter={prefetchComponent}
        onClick={() => setComponent}
      >
        Load Component
      </button>

      {Component && <Component />}
    </div>
  )
}
```

### Progressive Loading

```tsx
'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const Tier1 = dynamic(() => import('@/components/Tier1'))
const Tier2 = dynamic(() => import('@/components/Tier2'))
const Tier3 = dynamic(() => import('@/components/Tier3'))

export default function ProgressivePage() {
  const [loadTier2, setLoadTier2] = useState(false)
  const [loadTier3, setLoadTier3] = useState(false)

  useEffect(() => {
    // Load tier 2 after initial render
    const timer1 = setTimeout(() => setLoadTier2(true), 1000)

    // Load tier 3 after tier 2
    const timer2 = setTimeout(() => setLoadTier3(true), 2000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [])

  return (
    <div>
      <Tier1 />
      {loadTier2 && <Tier2 />}
      {loadTier3 && <Tier3 />}
    </div>
  )
}
```

### Lazy Loading Context Provider

```tsx
'use client'

import { createContext, useContext, useState } from 'react'
import dynamic from 'next/dynamic'

const LazyProviderContext = createContext<any>(null)

export function LazyProvider({ children }: { children: React.ReactNode }) {
  const [components, setComponents] = useState<Map<string, any>>(new Map())

  const loadComponent = async (name: string, path: string) => {
    if (components.has(name)) return components.get(name)

    const module = await import(`@/components/${path}`)
    const Component = module.default

    setComponents(new Map(components.set(name, Component)))
    return Component
  }

  return (
    <LazyProviderContext.Provider value={{ loadComponent, components }}>
      {children}
    </LazyProviderContext.Provider>
  )
}

export function useLazyComponent(name: string, path: string) {
  const { loadComponent, components } = useContext(LazyProviderContext)

  useEffect(() => {
    loadComponent(name, path)
  }, [name, path])

  return components.get(name)
}
```

## Performance Optimization

### Measuring Impact

```tsx
'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  {
    loading: () => {
      console.time('component-load')
      return <div>Loading...</div>
    },
  }
)

export default function Page() {
  useEffect(() => {
    console.timeEnd('component-load')
  }, [])

  return <DynamicComponent />
}
```

### Optimal Loading Strategy

```tsx
import dynamic from 'next/dynamic'

// Critical - no lazy loading
import Header from '@/components/Header'
import Hero from '@/components/Hero'

// Above the fold - lazy with high priority
const DynamicFeatures = dynamic(() => import('@/components/Features'))

// Below the fold - lazy with low priority
const DynamicTestimonials = dynamic(
  () => import('@/components/Testimonials'),
  { ssr: false }
)

// Far below - very lazy
const DynamicFooter = dynamic(
  () => import('@/components/Footer'),
  { ssr: false }
)

export default function HomePage() {
  return (
    <>
      <Header />
      <Hero />
      <DynamicFeatures />
      <DynamicTestimonials />
      <DynamicFooter />
    </>
  )
}
```

## Best Practices

1. **Lazy Load Below the Fold**: Components not visible initially
2. **User Interaction**: Load on click, hover, or scroll
3. **Heavy Libraries**: Import only when needed
4. **Provide Loading States**: Good UX during load
5. **Disable SSR When Needed**: For browser-only components
6. **Route Splitting**: Let Next.js handle automatic route splitting
7. **Measure Impact**: Track bundle size reduction
8. **Progressive Loading**: Load in tiers of importance
9. **Prefetch Strategically**: Anticipate user needs
10. **Avoid Over-Splitting**: Balance between requests and bundle size

## Common Patterns

### Modal

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const DynamicModal = dynamic(() => import('@/components/Modal'))

export default function Page() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      {isOpen && <DynamicModal onClose={() => setIsOpen(false)} />}
    </>
  )
}
```

### Tabs

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const TabContent1 = dynamic(() => import('@/components/tabs/Tab1'))
const TabContent2 = dynamic(() => import('@/components/tabs/Tab2'))
const TabContent3 = dynamic(() => import('@/components/tabs/Tab3'))

export default function Tabs() {
  const [activeTab, setActiveTab] = useState(1)

  return (
    <div>
      <div className="flex gap-4">
        <button onClick={() => setActiveTab(1)}>Tab 1</button>
        <button onClick={() => setActiveTab(2)}>Tab 2</button>
        <button onClick={() => setActiveTab(3)}>Tab 3</button>
      </div>

      {activeTab === 1 && <TabContent1 />}
      {activeTab === 2 && <TabContent2 />}
      {activeTab === 3 && <TabContent3 />}
    </div>
  )
}
```

### Accordion

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const DynamicContent = dynamic(() => import('@/components/AccordionContent'))

export default function Accordion({ items }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div>
      {items.map((item, index) => (
        <div key={index}>
          <button onClick={() => setOpenIndex(index === openIndex ? null : index)}>
            {item.title}
          </button>
          {openIndex === index && <DynamicContent content={item.content} />}
        </div>
      ))}
    </div>
  )
}
```

## Resources

- [Next.js Dynamic Imports](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [React Code Splitting](https://react.dev/reference/react/lazy)
- [Web.dev Code Splitting](https://web.dev/code-splitting/)
