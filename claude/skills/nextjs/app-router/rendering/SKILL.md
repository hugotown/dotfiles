---
name: understanding-nextjs-rendering
description: Explains Next.js rendering strategies including Server Components, Client Components, streaming, Partial Prerendering (PPR), and Cache Components. Use when optimizing rendering performance or choosing rendering strategies.
---

# Next.js App Router Rendering

This skill provides comprehensive guidance on Next.js App Router rendering strategies, helping you make informed decisions about how to render your components for optimal performance and user experience.

## Overview

Next.js 13+ with the App Router introduces a new rendering paradigm built on React Server Components. Understanding these rendering strategies is crucial for building performant applications.

## Key Concepts

### Server Components (Default)
React components that render on the server by default. They can fetch data directly, access backend resources, and keep sensitive logic secure.

**Learn more:** [server-components.md](./server-components.md)

### Client Components
Components that run in the browser, enabling interactivity, state management, and browser APIs.

**Learn more:** [client-components.md](./client-components.md)

### Composition Patterns
Strategies for combining Server and Client Components effectively, managing boundaries, and passing data.

**Learn more:** [composition-patterns.md](./composition-patterns.md)

### Streaming
Progressive rendering technique that sends UI to the client in chunks, improving perceived performance.

**Learn more:** [streaming.md](./streaming.md)

### Partial Prerendering (PPR)
Experimental feature that combines static and dynamic rendering in a single route, delivering a static shell with dynamic holes.

**Learn more:** [partial-prerendering.md](./partial-prerendering.md)

### Cache Components
Using the 'use cache' directive to cache component output while mixing static and dynamic content.

**Learn more:** [cache-components.md](./cache-components.md)

## Decision Guide

### When to Use Server Components
- Fetching data from APIs or databases
- Accessing backend resources directly
- Keeping sensitive information secure (API keys, tokens)
- Reducing client-side JavaScript bundle size
- SEO-critical content

### When to Use Client Components
- Interactive UI elements (buttons, forms)
- Event handlers (onClick, onChange)
- State and lifecycle hooks (useState, useEffect)
- Browser-only APIs (localStorage, geolocation)
- Custom hooks that depend on state or browser APIs

### When to Use Streaming
- Large data fetching operations
- Multiple independent data sources
- Improving Time to First Byte (TTFB)
- Progressive content revelation

### When to Consider PPR
- Routes with mixed static/dynamic content
- Improving perceived performance
- Reducing server load for partially static pages

## Performance Implications

| Strategy | Initial Load | Interactivity | Bundle Size | Server Load |
|----------|--------------|---------------|-------------|-------------|
| Server Components | Fast | None | Minimal | Higher |
| Client Components | Slower | Full | Larger | Lower |
| Streaming | Progressive | Delayed | Varies | Higher |
| PPR | Very Fast | Delayed | Minimal | Lower |

## Quick Reference

```tsx
// Server Component (default)
async function ServerComponent() {
  const data = await fetch('...')
  return <div>{data}</div>
}

// Client Component
'use client'
function ClientComponent() {
  const [state, setState] = useState()
  return <button onClick={...}>Click</button>
}

// Streaming with Suspense
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>

// Cache Component
'use cache'
async function CachedComponent() {
  const data = await fetch('...')
  return <div>{data}</div>
}
```

## Next Steps

1. Review each rendering strategy in detail
2. Understand composition patterns for mixing strategies
3. Implement streaming for improved perceived performance
4. Explore PPR for advanced optimization
5. Use cache directives strategically

## Resources

- [Next.js Server Components Documentation](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Next.js Streaming Documentation](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
