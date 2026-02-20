---
name: caching-in-nextjs
description: Explains Next.js caching mechanisms including use cache directive, cache lifecycles, invalidation strategies, and Client Router Cache. Use when optimizing performance, implementing ISR, or managing cache invalidation.
---

# Next.js App Router Caching

This skill provides comprehensive guidance on Next.js App Router caching mechanisms, helping you optimize performance and manage cache invalidation effectively.

## Coverage

This skill covers the following caching mechanisms in Next.js App Router:

### Core Caching Directives
- **use cache**: Function and component-level caching
- **use cache: private**: Personalized content caching
- **use cache: remote**: Dynamic context caching

### Cache Management
- **cacheLife**: Cache expiration and stale-while-revalidate
- **cacheTag**: Tag-based cache invalidation
- **Client Router Cache**: Browser-side routing cache

### Advanced Patterns
- **Incremental Static Regeneration (ISR)**: On-demand and time-based revalidation
- **Cache invalidation**: revalidateTag and revalidatePath patterns

## Files

- `use-cache.md` - Basic 'use cache' directive usage
- `cache-private.md` - Private caching for personalized content
- `cache-remote.md` - Remote caching for dynamic contexts
- `cache-lifecycle.md` - Cache lifecycle management with cacheLife
- `cache-tags.md` - Tag-based invalidation with cacheTag
- `client-cache.md` - Client-side Router Cache configuration
- `isr.md` - Incremental Static Regeneration patterns

## When to Use This Skill

Use this skill when you need to:
- Optimize Next.js application performance through caching
- Implement server-side caching for functions or components
- Set up personalized content caching
- Configure cache expiration and revalidation
- Implement tag-based cache invalidation
- Configure client-side router cache behavior
- Set up Incremental Static Regeneration (ISR)
- Debug caching issues or unexpected cache behavior

## Quick Start

For most common caching scenarios:

1. **Static content**: Use `use cache` directive
2. **Personalized content**: Use `use cache: private`
3. **Dynamic contexts**: Use `use cache: remote`
4. **Cache invalidation**: Use `cacheTag` and `revalidateTag`
5. **Time-based refresh**: Configure `cacheLife` with stale times

Refer to individual files for detailed implementation examples and best practices.
