---
name: building-nextjs-applications
description: Provides comprehensive guidance for building Next.js applications including App Router, Pages Router, API routes, data fetching, caching, styling, and deployment. Use when working with Next.js projects, creating pages, implementing routing, fetching data, optimizing performance, or configuring Next.js features.
---

# Building Next.js Applications

This skill provides comprehensive guidance for developing Next.js applications (v16.x). It covers both the modern App Router and legacy Pages Router patterns.

## Table of Contents

1. [App Router](#app-router) - Modern routing with React Server Components
2. [Pages Router](#pages-router) - Legacy routing system
3. [API Reference](#api-reference) - Components, functions, and configuration
4. [Architecture](#architecture) - Compiler, Fast Refresh, accessibility
5. [Patterns](#patterns) - Common implementation patterns
6. [Testing](#testing) - Testing strategies and tools

## Quick Reference

### When to Use App Router vs Pages Router

| Feature | App Router | Pages Router |
|---------|------------|--------------|
| Server Components | Yes | No |
| Streaming | Yes | No |
| Layouts | Nested | \_app.js |
| Data Fetching | async/await in components | getStaticProps/getServerSideProps |
| Caching | use cache directive | ISR |

### Key Concepts

**App Router** (Recommended for new projects):
- File-based routing in `app/` directory
- React Server Components by default
- Streaming and Suspense support
- `use cache`, `use client`, `use server` directives
- Nested layouts and templates

**Pages Router** (Legacy):
- File-based routing in `pages/` directory
- getStaticProps, getStaticPaths, getServerSideProps
- \_app.js and \_document.js customization
- API Routes in `pages/api/`

## App Router

The App Router is the modern routing system supporting React Server Components.

### Getting Started
See: [app-router/getting-started/SKILL.md](app-router/getting-started/SKILL.md)

Key topics:
- Installation and project setup
- Project structure conventions
- Creating layouts and pages
- Linking and navigation
- Server vs Client Components
- Data fetching patterns
- Error handling
- Styling (CSS, Tailwind, CSS Modules)

### Routing
See: [app-router/routing/SKILL.md](app-router/routing/SKILL.md)

Key topics:
- Dynamic routes (`[slug]`, `[...slug]`, `[[...slug]]`)
- Route groups `(folder)`
- Parallel routes `@folder`
- Intercepting routes `(.)`, `(..)`, `(...)`
- Route handlers (`route.ts`)

### Rendering
See: [app-router/rendering/SKILL.md](app-router/rendering/SKILL.md)

Key topics:
- Server Components (default)
- Client Components (`'use client'`)
- Streaming with Suspense
- Partial Prerendering (PPR)
- Cache Components

### Data Fetching
See: [app-router/data-fetching/SKILL.md](app-router/data-fetching/SKILL.md)

Key topics:
- Server-side data fetching
- Parallel and sequential fetching
- Streaming data
- Server Actions (`'use server'`)
- Form handling

### Caching
See: [app-router/caching/SKILL.md](app-router/caching/SKILL.md)

Key topics:
- `use cache` directive
- `cacheLife` and `cacheTag`
- `revalidatePath` and `revalidateTag`
- Client Router Cache
- ISR (Incremental Static Regeneration)

## Pages Router

Legacy routing system maintained for backward compatibility.

### Routing
See: [pages-router/routing/SKILL.md](pages-router/routing/SKILL.md)

Key topics:
- Pages and layouts
- Dynamic routes
- Custom App (`_app.js`)
- Custom Document (`_document.js`)
- API Routes

### Rendering
See: [pages-router/rendering/SKILL.md](pages-router/rendering/SKILL.md)

Key topics:
- Static Site Generation (SSG)
- Server-Side Rendering (SSR)
- Incremental Static Regeneration (ISR)
- Client-Side Rendering (CSR)

### Data Fetching
See: [pages-router/data-fetching/SKILL.md](pages-router/data-fetching/SKILL.md)

Key topics:
- `getStaticProps`
- `getStaticPaths`
- `getServerSideProps`
- Client-side fetching with SWR

## API Reference

### Directives
See: [api-reference/directives/SKILL.md](api-reference/directives/SKILL.md)

- `'use cache'` - Cache function/component output
- `'use cache: private'` - Runtime prefetching of personalized content
- `'use cache: remote'` - Caching in dynamic contexts
- `'use client'` - Mark component as client-side
- `'use server'` - Mark function as Server Action

### Components
See: [api-reference/components/SKILL.md](api-reference/components/SKILL.md)

- `<Font>` - Optimized font loading
- `<Form>` - Enhanced form handling
- `<Image>` - Optimized images
- `<Link>` - Client-side navigation
- `<Script>` - Optimized script loading

### File Conventions
See: [api-reference/file-conventions/SKILL.md](api-reference/file-conventions/SKILL.md)

Core files: `layout.js`, `page.js`, `loading.js`, `error.js`, `not-found.js`, `route.js`, `template.js`, `default.js`

Metadata files: `favicon.ico`, `icon`, `apple-icon`, `opengraph-image`, `twitter-image`, `sitemap.xml`, `robots.txt`, `manifest.json`

### Functions
See: [api-reference/functions/SKILL.md](api-reference/functions/SKILL.md)

Server functions, client hooks, and request/response objects.

### Configuration
See: [api-reference/config/SKILL.md](api-reference/config/SKILL.md)

`next.config.js` options, TypeScript, ESLint configuration.

### CLI
See: [api-reference/cli/SKILL.md](api-reference/cli/SKILL.md)

- `create-next-app` - Project scaffolding
- `next dev` - Development server
- `next build` - Production build
- `next start` - Production server
- `next lint` - Linting

## Architecture

See: [architecture/SKILL.md](architecture/SKILL.md)

- Accessibility features
- Fast Refresh (HMR)
- Next.js Compiler (SWC/Rust)
- Turbopack bundler
- Edge Runtime
- Supported browsers

## Patterns

See: [patterns/SKILL.md](patterns/SKILL.md)

Common implementation patterns:
- Authentication
- Internationalization (i18n)
- Multi-tenancy
- Static exports
- Progressive Web Apps (PWA)
- MDX integration

## Testing

See: [testing/SKILL.md](testing/SKILL.md)

- Vitest (unit testing)
- Jest (unit/snapshot testing)
- Playwright (E2E testing)
- Cypress (E2E/component testing)

## Version Information

This skill covers Next.js v16.x features. Key version-specific features:

**v16.0.0+:**
- Turbopack as default bundler
- Automatic Babel support
- Enhanced caching directives

**v15.x:**
- Stable Turbopack dev support
- Build support (beta)

## External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js GitHub](https://github.com/vercel/next.js)
- [Next.js Learn](https://nextjs.org/learn)
