---
name: styling-nextjs-applications
description: Documents styling approaches in Next.js including CSS Modules, Tailwind CSS, CSS-in-JS libraries, Sass, and global styles. Use when implementing styles, choosing styling solutions, or optimizing CSS.
---

# Styling Next.js Applications

This skill provides comprehensive guidance on styling Next.js applications using the App Router. It covers all major styling approaches and best practices for modern Next.js development.

## Available Styling Approaches

Next.js supports multiple styling solutions, each with its own strengths:

### 1. CSS Modules
- **File**: `css-modules.md`
- **Use for**: Component-scoped styles, type-safe styling with TypeScript
- **Benefits**: Zero runtime overhead, automatic class name scoping, great for large teams

### 2. Tailwind CSS
- **File**: `tailwind-css.md`
- **Use for**: Utility-first styling, rapid development, design systems
- **Benefits**: Small bundle sizes, consistent design tokens, excellent DX

### 3. Global CSS
- **File**: `global-css.md`
- **Use for**: App-wide styles, CSS variables, reset/normalize styles
- **Benefits**: Simple setup, good for foundational styles

### 4. CSS-in-JS
- **File**: `css-in-js.md`
- **Use for**: Dynamic styles, component libraries, theme-dependent styling
- **Benefits**: Full JavaScript capabilities, runtime theming

### 5. Sass/SCSS
- **File**: `sass.md`
- **Use for**: Complex stylesheets, variables, mixins, and nesting
- **Benefits**: Powerful preprocessing, backward compatibility

### 6. Styling Patterns
- **File**: `styling-patterns.md`
- **Use for**: Advanced patterns like responsive design, theming, animations
- **Benefits**: Best practices and proven patterns

## Quick Start

### Choosing a Styling Approach

```typescript
// For component-scoped styles with zero runtime
import styles from './button.module.css'

// For utility-first approach
className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"

// For dynamic, theme-dependent styles
const StyledButton = styled.button`
  background: ${props => props.theme.primary};
`
```

## Performance Considerations

1. **CSS Modules** - Best performance, no runtime overhead
2. **Tailwind CSS** - Excellent with PurgeCSS, minimal runtime
3. **Sass** - No runtime overhead, compile-time processing
4. **CSS-in-JS** - Runtime overhead, use with Server Components carefully
5. **Global CSS** - Minimal overhead but can cause specificity issues

## Server vs Client Components

- **Server Components**: Prefer CSS Modules, Tailwind, or Sass (no runtime)
- **Client Components**: All approaches work, CSS-in-JS requires `'use client'`

## Best Practices

1. **Colocate styles** with components
2. **Use CSS variables** for theming
3. **Leverage Next.js optimizations** (automatic CSS bundling)
4. **Minimize runtime** styling for better performance
5. **Use TypeScript** for type-safe styling where possible
6. **Follow accessibility** guidelines (contrast, focus states)
7. **Optimize for production** (purge unused styles, minify)

## Common Patterns

### Combining Approaches

You can mix styling solutions in the same project:

```typescript
// layout.tsx - Global styles and Tailwind
import './globals.css'

// Component - CSS Modules for scoped styles
import styles from './card.module.css'

// Another component - Tailwind utilities
<div className="flex items-center gap-4">
```

### Dark Mode Support

All approaches support dark mode:
- Tailwind: `dark:` variant
- CSS Modules: `@media (prefers-color-scheme: dark)`
- CSS-in-JS: ThemeProvider with dark theme

## When to Use This Skill

- Setting up styling in a new Next.js project
- Migrating from Pages Router to App Router
- Choosing between different styling approaches
- Implementing responsive designs
- Setting up theming and dark mode
- Optimizing CSS performance
- Troubleshooting styling issues in Server/Client Components

## Related Documentation

- [Next.js Styling Docs](https://nextjs.org/docs/app/building-your-application/styling)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [CSS Modules](https://github.com/css-modules/css-modules)

## Notes

- App Router has different styling constraints than Pages Router
- Server Components cannot use CSS-in-JS without `'use client'`
- Next.js automatically optimizes and bundles CSS
- Font optimization is available through `next/font`
