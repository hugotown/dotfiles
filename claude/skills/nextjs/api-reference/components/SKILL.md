---
name: using-nextjs-components
description: Documents built-in Next.js components including Image, Link, Font, Form, and Script for optimized rendering and navigation. Use when adding images, links, fonts, forms, or third-party scripts to your application.
---

# Next.js Built-in Components

This skill provides comprehensive documentation for Next.js built-in components that enable optimized rendering, navigation, and resource loading in your application.

## Components Covered

- **Image** (`next/image`) - Optimized image component with automatic lazy loading, responsive images, and modern format support
- **Link** (`next/link`) - Client-side navigation with automatic prefetching
- **Font** (`next/font`) - Optimized font loading with Google Fonts and local fonts support
- **Form** - Progressive enhancement for forms with Server Actions integration
- **Script** (`next/script`) - Optimized third-party script loading with various strategies

## When to Use This Skill

Use this skill when you need to:
- Add optimized images to your Next.js application
- Implement client-side navigation between pages
- Load and optimize web fonts
- Create forms with progressive enhancement
- Add third-party scripts with optimal loading strategies

## Component Files

Each component has detailed documentation in separate files:

- [image.md](./image.md) - Complete Image component reference
- [link.md](./link.md) - Complete Link component reference
- [font.md](./font.md) - Complete Font optimization reference
- [form.md](./form.md) - Complete Form component reference
- [script.md](./script.md) - Complete Script component reference

## Quick Start

```jsx
// Import components
import Image from 'next/image'
import Link from 'next/link'
import { Inter } from 'next/font/google'
import Script from 'next/script'

// Use in your component
export default function Page() {
  return (
    <>
      <Image src="/hero.jpg" alt="Hero" width={800} height={600} />
      <Link href="/about">About</Link>
      <Script src="https://example.com/script.js" strategy="afterInteractive" />
    </>
  )
}
```

## Best Practices

1. **Always use next/image** instead of `<img>` for automatic optimization
2. **Use next/link** for all internal navigation to enable prefetching
3. **Optimize fonts** with next/font to prevent layout shift
4. **Choose appropriate script strategies** based on script criticality
5. **Leverage progressive enhancement** with the Form component

## Performance Considerations

All these components are designed with performance in mind:
- Automatic code splitting
- Lazy loading by default
- Optimized resource hints
- Reduced layout shift
- Improved Core Web Vitals
