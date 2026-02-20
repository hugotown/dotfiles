---
name: using-nextjs-directives
description: Documents Next.js directives including use cache, use client, and use server for controlling rendering and caching behavior. Use when implementing Server Components, Client Components, Server Actions, or caching strategies.
---

# Next.js Directives

This skill provides comprehensive documentation for Next.js directives that control rendering, caching, and execution contexts in Next.js applications.

## Available Directives

### Caching Directives
- **use cache** - Cache function or component outputs
- **use cache private** - Cache content per-user with personalization
- **use cache remote** - Cache with dynamic contexts like geolocation

### Component & Execution Directives
- **use client** - Declare Client Components for browser-side interactivity
- **use server** - Define Server Actions for secure server-side operations

## When to Use This Skill

Use this skill when you need to:
- Implement caching strategies in Next.js applications
- Optimize performance with granular caching control
- Create interactive Client Components
- Build secure Server Actions for data mutations
- Understand component boundaries and rendering contexts
- Configure per-user or geolocation-based caching

## Quick Reference

```typescript
// Caching
'use cache'
'use cache private'
'use cache remote'

// Component/Execution Context
'use client'
'use server'
```

## Related Documentation

- [use cache](./use-cache.md) - Function and component caching
- [use cache private](./use-cache-private.md) - Per-user caching
- [use cache remote](./use-cache-remote.md) - Dynamic context caching
- [use client](./use-client.md) - Client Component declaration
- [use server](./use-server.md) - Server Actions

## Key Concepts

### Server vs Client Components
- **Server Components** (default): Render on the server, reduce bundle size
- **Client Components**: Enable interactivity, use browser APIs

### Caching Granularity
- **Function-level**: Cache specific function outputs
- **Component-level**: Cache entire component renders
- **Private**: Per-user personalized caching
- **Remote**: Edge-aware caching with dynamic contexts

### Best Practices
1. Use Server Components by default
2. Apply `'use client'` only at component boundaries
3. Cache expensive operations with `'use cache'`
4. Use `'use cache private'` for personalized content
5. Secure mutations with `'use server'` Server Actions
