---
name: optimizing-nextjs-applications
description: Documents Next.js optimization techniques including images, fonts, scripts, metadata, static assets, lazy loading, and bundle analysis. Use when optimizing performance, reducing bundle size, or improving Core Web Vitals.
---

# Optimizing Next.js Applications

This skill provides comprehensive guidance on optimizing Next.js applications using the App Router. It covers all major optimization areas to improve performance, reduce bundle size, and enhance Core Web Vitals.

## Overview

Performance optimization in Next.js involves multiple dimensions:

- **Asset Optimization**: Images, fonts, and static assets
- **Script Management**: Third-party scripts and loading strategies
- **Code Splitting**: Lazy loading and dynamic imports
- **SEO**: Metadata and structured data optimization
- **Monitoring**: Bundle analysis and Core Web Vitals tracking

## Key Optimization Areas

### 1. Image Optimization
The `next/image` component provides automatic image optimization with features like:
- Automatic format selection (WebP, AVIF)
- Responsive images with srcset
- Lazy loading by default
- Priority loading for above-the-fold images
- Blur placeholders

See [images.md](./images.md) for detailed implementation.

### 2. Font Optimization
The `next/font` system optimizes web fonts:
- Automatic font subsetting
- Zero layout shift
- Self-hosting Google Fonts
- Variable font support

See [fonts.md](./fonts.md) for detailed implementation.

### 3. Script Optimization
The `next/script` component manages third-party scripts:
- Loading strategy control (beforeInteractive, afterInteractive, lazyOnload)
- Automatic script deduplication
- Inline script optimization

See [scripts.md](./scripts.md) for detailed implementation.

### 4. Metadata & SEO
Built-in metadata API for SEO optimization:
- Static and dynamic metadata
- Open Graph and Twitter Cards
- JSON-LD structured data
- Sitemap and robots.txt generation

See [metadata.md](./metadata.md) for detailed implementation.

### 5. Static Assets
Efficient static asset management:
- Public folder best practices
- Asset optimization strategies
- CDN configuration
- Cache headers

See [static-assets.md](./static-assets.md) for detailed implementation.

### 6. Lazy Loading
Code splitting and lazy loading strategies:
- Dynamic imports
- React.lazy integration
- Component-level lazy loading
- Route-based code splitting

See [lazy-loading.md](./lazy-loading.md) for detailed implementation.

### 7. Bundle Analysis
Tools and techniques for bundle optimization:
- @next/bundle-analyzer setup
- Identifying large dependencies
- Tree shaking optimization
- Code splitting strategies

See [bundle-analysis.md](./bundle-analysis.md) for detailed implementation.

### 8. Core Web Vitals
Optimizing for Google's Core Web Vitals:
- Largest Contentful Paint (LCP)
- First Input Delay (FID) / Interaction to Next Paint (INP)
- Cumulative Layout Shift (CLS)
- Measurement and monitoring

See [core-web-vitals.md](./core-web-vitals.md) for detailed implementation.

## Quick Start

1. **Identify Performance Issues**: Use Lighthouse, WebPageTest, or Next.js built-in analytics
2. **Prioritize Optimizations**: Focus on Core Web Vitals first
3. **Implement Incrementally**: Start with high-impact, low-effort optimizations
4. **Measure Impact**: Validate improvements with real metrics

## Best Practices

1. **Use Built-in Components**: Prefer `next/image`, `next/font`, and `next/script` over custom solutions
2. **Enable Static Optimization**: Maximize static generation where possible
3. **Minimize JavaScript**: Use Server Components by default, Client Components only when needed
4. **Optimize Dependencies**: Regularly audit and update dependencies
5. **Monitor Continuously**: Set up performance monitoring in production

## Performance Checklist

- [ ] Images optimized with `next/image`
- [ ] Fonts loaded with `next/font`
- [ ] Third-party scripts using `next/script`
- [ ] Metadata properly configured
- [ ] Components lazy loaded where appropriate
- [ ] Bundle analyzed and optimized
- [ ] Core Web Vitals meeting thresholds
- [ ] Static assets cached appropriately

## Resources

- [Next.js Optimization Documentation](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web.dev Performance Guide](https://web.dev/performance/)
- [Core Web Vitals](https://web.dev/vitals/)
