---
name: getting-started-with-nextjs-app-router
description: Guides through Next.js App Router setup including installation, project structure, layouts, pages, navigation, and core concepts. Use when starting a new Next.js project, setting up routing, or learning App Router fundamentals.
---

# Getting Started with Next.js App Router

This skill provides comprehensive guidance on starting with Next.js App Router, covering everything from installation to core concepts.

## Topics Covered

- [Installation](./installation.md) - Setting up a new Next.js project
- [Project Structure](./project-structure.md) - Understanding the app directory structure
- [Layouts and Pages](./layouts-and-pages.md) - Creating layouts and pages
- [Linking and Navigating](./linking-and-navigating.md) - Client-side navigation
- [Server and Client Components](./server-and-client-components.md) - Component types and when to use them
- [Data Fetching](./data-fetching.md) - Fetching data in Server Components
- [Caching and Revalidating](./caching-and-revalidating.md) - Cache strategies and revalidation
- [Error Handling](./error-handling.md) - Handling errors gracefully
- [Styling](./styling.md) - Styling approaches in Next.js
- [Images and Fonts](./images-and-fonts.md) - Optimizing images and fonts
- [Metadata](./metadata.md) - SEO and metadata management

## Quick Start

For a new Next.js project:

```bash
npx create-next-app@latest my-app
cd my-app
npm run dev
```

## When to Use This Skill

- Starting a new Next.js project
- Migrating from Pages Router to App Router
- Learning Next.js fundamentals
- Setting up routing and navigation
- Understanding Server and Client Components
- Implementing data fetching patterns
- Configuring caching strategies
- Setting up error handling
- Optimizing images and fonts

## Best Practices

1. **Use Server Components by default** - Only use Client Components when needed
2. **Colocate related files** - Keep components, styles, and tests together
3. **Implement proper error boundaries** - Use error.js and not-found.js
4. **Optimize images** - Always use next/image for better performance
5. **Configure metadata** - Set proper SEO metadata for all pages
6. **Use TypeScript** - Enable type safety from the start
7. **Implement caching strategies** - Understand revalidation patterns
8. **Follow file conventions** - Use page.js, layout.js, loading.js, etc.
