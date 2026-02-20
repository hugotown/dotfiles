---
name: understanding-nextjs-architecture
description: Documents Next.js architecture including the compiler, Fast Refresh, Turbopack bundler, Edge Runtime, and accessibility features. Use when understanding build process, debugging, or optimizing performance.
---

# Understanding Next.js Architecture

This skill provides comprehensive documentation of Next.js's core architectural components, enabling you to understand, debug, and optimize Next.js applications effectively.

## Overview

Next.js is built on several key architectural components that work together to provide a fast, efficient, and developer-friendly framework:

- **Compiler**: SWC-based Rust compiler for fast transformations
- **Fast Refresh**: Hot module replacement with state preservation
- **Turbopack**: Next-generation incremental bundler
- **Edge Runtime**: Lightweight runtime for edge computing
- **Accessibility**: Built-in a11y features and best practices
- **Browser Support**: Cross-browser compatibility strategy

## Components

### [Compiler](./compiler.md)
Learn about Next.js's SWC-based compiler, its performance benefits, minification strategies, and code transformations.

### [Fast Refresh](./fast-refresh.md)
Understand how Fast Refresh works, including hot module replacement, state preservation, and error recovery mechanisms.

### [Turbopack](./turbopack.md)
Explore the incremental bundler architecture, webpack comparison, and configuration options.

### [Edge Runtime](./edge-runtime.md)
Discover Edge functions, supported APIs, limitations, and optimal use cases for edge computing.

### [Accessibility](./accessibility.md)
Review built-in accessibility features, route announcements, and focus management patterns.

### [Supported Browsers](./supported-browsers.md)
Understand browser compatibility targets, polyfill strategies, and browserslist configuration.

## When to Use This Skill

Use this skill when you need to:

- Understand how Next.js builds and bundles applications
- Debug compilation or bundling issues
- Optimize build performance
- Configure development environment settings
- Implement edge functions
- Ensure accessibility compliance
- Troubleshoot browser compatibility issues
- Make informed architectural decisions

## Quick Reference

### Common Tasks

**Check compiler configuration:**
```bash
# View Next.js config
cat next.config.js
```

**Enable Turbopack (Next.js 13+):**
```bash
next dev --turbo
```

**Analyze bundle:**
```bash
npm install @next/bundle-analyzer
```

**Test edge functions locally:**
```bash
next dev
# Edge functions run automatically in dev mode
```

## Related Skills

- Next.js Routing
- Next.js Data Fetching
- Next.js Optimization
- React Performance

## Resources

- [Next.js Architecture Documentation](https://nextjs.org/docs/architecture)
- [SWC Documentation](https://swc.rs/)
- [Turbopack Documentation](https://turbo.build/pack)
- [Vercel Edge Runtime](https://edge-runtime.vercel.app/)
