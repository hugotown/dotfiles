---
name: nextjs-file-conventions
description: Documents Next.js file-system conventions including page.js, layout.js, loading.js, error.js, route.js, and metadata files. Use when creating routes, layouts, error boundaries, or configuring SEO metadata.
---

# Next.js File Conventions

This skill provides comprehensive documentation for Next.js App Router file-based conventions. Use this when working with Next.js routing, layouts, error handling, or metadata configuration.

## Coverage

### Core Files
- **page.md** - Page components and route rendering
- **layout.md** - Shared layouts and UI structure
- **template.md** - Re-rendering layouts
- **loading.md** - Loading UI and Suspense boundaries
- **error.md** - Error handling and recovery
- **not-found.md** - 404 pages
- **route.md** - API routes and route handlers
- **default.md** - Parallel route fallbacks

### Special Files
- **middleware.md** - Request interceptors and edge runtime
- **instrumentation.md** - Performance monitoring and observability

### Metadata Files
- **metadata-files.md** - SEO, icons, and static metadata files

### Route Conventions
- **dynamic-routes.md** - Dynamic route segments
- **route-groups.md** - Route organization without affecting URL
- **parallel-routes.md** - Multiple pages in the same layout
- **intercepting-routes.md** - Modal-like routing patterns

## Usage

Reference these files when:
- Creating new routes or pages
- Setting up layouts and nested navigation
- Implementing error boundaries
- Configuring loading states
- Setting up API endpoints
- Managing metadata and SEO
- Using advanced routing patterns

## Quick Reference

```
app/
├── page.tsx              # Home page
├── layout.tsx            # Root layout
├── loading.tsx           # Loading UI
├── error.tsx             # Error boundary
├── not-found.tsx         # 404 page
├── middleware.ts         # Request middleware
├── instrumentation.ts    # Monitoring setup
├── favicon.ico           # Favicon
├── sitemap.xml           # Sitemap
├── robots.txt            # Robots file
├── dashboard/
│   ├── page.tsx          # /dashboard
│   ├── layout.tsx        # Dashboard layout
│   ├── [id]/
│   │   └── page.tsx      # /dashboard/[id]
│   ├── (overview)/       # Route group
│   │   └── page.tsx      # /dashboard
│   ├── @analytics/       # Parallel route
│   │   └── page.tsx
│   └── (..)photo/        # Intercepting route
│       └── page.tsx
└── api/
    └── users/
        └── route.ts      # API endpoint
```
