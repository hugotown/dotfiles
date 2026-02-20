---
name: fetching-data-in-nextjs
description: Covers data fetching patterns in Next.js App Router including server-side fetching, Server Actions, form handling, and data mutations. Use when fetching data, handling forms, or implementing CRUD operations.
---

# Next.js App Router Data Fetching

This skill provides comprehensive guidance on data fetching patterns in Next.js App Router, covering server-side data fetching, Server Actions, form handling, and data mutations.

## Contents

- [Server-Side Fetching](./server-fetching.md) - fetch in Server Components, caching, revalidation
- [Parallel & Sequential Fetching](./parallel-sequential.md) - Promise.all patterns, waterfall avoidance
- [Server Actions](./server-actions.md) - 'use server', form actions, mutations, error handling
- [Forms](./forms.md) - Form component, progressive enhancement, validation, optimistic updates
- [Streaming Data](./streaming-data.md) - Loading states, progressive loading, skeleton UIs
- [Revalidation](./revalidation.md) - Time-based, on-demand, revalidatePath, revalidateTag

## When to Use This Skill

Use this skill when:
- Fetching data in Next.js App Router applications
- Implementing CRUD operations
- Handling form submissions
- Setting up data caching and revalidation strategies
- Optimizing data loading patterns
- Implementing progressive enhancement
- Building server-driven UIs

## Key Concepts

### Server Components by Default
Next.js App Router uses Server Components by default, enabling:
- Direct database queries
- Secure API calls with secrets
- Zero client-side JavaScript for data fetching
- Improved performance and SEO

### Server Actions
Server Actions provide a powerful way to:
- Handle form submissions
- Perform data mutations
- Implement progressive enhancement
- Handle errors gracefully

### Caching & Revalidation
Next.js provides multiple caching layers:
- Request memoization
- Data Cache
- Full Route Cache
- Router Cache

## Getting Started

Start with [Server-Side Fetching](./server-fetching.md) to understand the basics, then explore specific patterns based on your use case.
