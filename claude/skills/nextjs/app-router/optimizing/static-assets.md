# Static Asset Optimization

Optimize static assets in Next.js for better performance, caching, and delivery.

## Public Folder

The `/public` folder serves static assets at the root URL path.

### Basic Usage

```
/public
  /images
    logo.png
    hero.jpg
  /fonts
    custom-font.woff2
  /documents
    whitepaper.pdf
  favicon.ico
  robots.txt
```

```tsx
// Accessing public assets
import Image from 'next/image'

export default function Page() {
  return (
    <>
      {/* Served from /public/images/logo.png */}
      <Image src="/images/logo.png" alt="Logo" width={200} height={50} />

      {/* Served from /public/documents/whitepaper.pdf */}
      <a href="/documents/whitepaper.pdf">Download PDF</a>
    </>
  )
}
```

### File Organization

```
/public
  /assets
    /images
      /products
      /blog
      /ui
    /videos
    /documents
  /static
    /css
    /js
  favicon.ico
  robots.txt
  sitemap.xml
```

## Asset Optimization

### Image Optimization

Always use `next/image` for images:

```tsx
import Image from 'next/image'

// Good - optimized
<Image
  src="/images/product.jpg"
  alt="Product"
  width={800}
  height={600}
  quality={85}
/>

// Bad - not optimized
<img src="/images/product.jpg" alt="Product" />
```

### Manual Image Optimization

For static images in `/public`:

```bash
# Install optimization tools
npm install -D imagemin imagemin-mozjpeg imagemin-pngquant imagemin-svgo

# Create optimization script
```

```js
// scripts/optimize-images.js
const imagemin = require('imagemin')
const imageminMozjpeg = require('imagemin-mozjpeg')
const imageminPngquant = require('imagemin-pngquant')
const imageminSvgo = require('imagemin-svgo')

(async () => {
  await imagemin(['public/images/**/*.{jpg,png,svg}'], {
    destination: 'public/images/optimized',
    plugins: [
      imageminMozjpeg({ quality: 85 }),
      imageminPngquant({ quality: [0.8, 0.9] }),
      imageminSvgo({
        plugins: [
          { removeViewBox: false },
          { cleanupIDs: false },
        ],
      }),
    ],
  })

  console.log('Images optimized')
})()
```

```json
// package.json
{
  "scripts": {
    "optimize-images": "node scripts/optimize-images.js"
  }
}
```

### SVG Optimization

```tsx
// Option 1: Inline SVG
export default function Logo() {
  return (
    <svg viewBox="0 0 100 100" className="w-8 h-8">
      <circle cx="50" cy="50" r="40" fill="currentColor" />
    </svg>
  )
}

// Option 2: Import as component (requires SVGR)
import Logo from '@/public/logo.svg'

export default function Header() {
  return <Logo className="w-8 h-8" />
}
```

Configure SVGR:

```js
// next.config.js
module.exports = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    return config
  },
}
```

### Font Files

Place font files in `/public/fonts`:

```
/public
  /fonts
    Inter-Regular.woff2
    Inter-Bold.woff2
    RobotoMono-Regular.woff2
```

Reference in CSS:

```css
/* globals.css */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

Or use `next/font/local`:

```tsx
import localFont from 'next/font/local'

const inter = localFont({
  src: [
    {
      path: '../public/fonts/Inter-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Inter-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
})
```

## Caching Strategy

### Next.js Automatic Caching

Next.js automatically adds cache headers to static assets:

```
Cache-Control: public, max-age=31536000, immutable
```

### Custom Headers

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/documents/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400', // 1 day
          },
        ],
      },
    ]
  },
}
```

### Cache Busting

Use query parameters or file hashing:

```tsx
// Query parameter
<link rel="stylesheet" href="/styles/custom.css?v=1.2.3" />

// File hash (manual)
<Image src="/images/logo-abc123.png" alt="Logo" width={200} height={50} />

// next/image handles this automatically
<Image src="/images/logo.png" alt="Logo" width={200} height={50} />
```

## CDN Configuration

### Cloudflare

```js
// next.config.js
module.exports = {
  images: {
    domains: ['your-domain.com'],
    loader: 'cloudflare',
  },
}
```

### AWS CloudFront

```js
// next.config.js
module.exports = {
  assetPrefix: process.env.NODE_ENV === 'production'
    ? 'https://cdn.example.com'
    : '',
}
```

### Custom CDN

```js
// next.config.js
module.exports = {
  assetPrefix: 'https://cdn.example.com',

  async rewrites() {
    return [
      {
        source: '/assets/:path*',
        destination: 'https://cdn.example.com/assets/:path*',
      },
    ]
  },
}
```

## Asset Loading Strategies

### Preloading Critical Assets

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/Inter-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* Preload critical images */}
        <link
          rel="preload"
          href="/images/hero.jpg"
          as="image"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Lazy Loading Non-Critical Assets

```tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function Gallery() {
  const [images, setImages] = useState([])

  useEffect(() => {
    // Load images after initial render
    setImages([
      '/images/gallery-1.jpg',
      '/images/gallery-2.jpg',
      '/images/gallery-3.jpg',
    ])
  }, [])

  return (
    <div>
      {images.map((src, i) => (
        <Image
          key={i}
          src={src}
          alt={`Gallery ${i + 1}`}
          width={400}
          height={300}
          loading="lazy"
        />
      ))}
    </div>
  )
}
```

## Video Optimization

### Self-Hosted Videos

```tsx
export default function VideoPlayer() {
  return (
    <video
      controls
      preload="metadata" // Only load metadata initially
      poster="/images/video-poster.jpg"
      className="w-full"
    >
      <source src="/videos/demo.mp4" type="video/mp4" />
      <source src="/videos/demo.webm" type="video/webm" />
      Your browser does not support the video tag.
    </video>
  )
}
```

### Lazy Load Videos

```tsx
'use client'

import { useEffect, useRef } from 'react'

export default function LazyVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && videoRef.current) {
            videoRef.current.load()
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.25 }
    )

    if (videoRef.current) {
      observer.observe(videoRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <video
      ref={videoRef}
      controls
      preload="none"
      poster="/images/video-poster.jpg"
    >
      <source data-src="/videos/demo.mp4" type="video/mp4" />
    </video>
  )
}
```

### Video Streaming

For large videos, use external services:

```tsx
export default function StreamingVideo() {
  return (
    <div className="aspect-video">
      <iframe
        src="https://www.youtube.com/embed/VIDEO_ID"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  )
}
```

## Document Files

### PDF Optimization

```tsx
export default function DocumentDownload() {
  return (
    <div>
      {/* Direct download */}
      <a
        href="/documents/whitepaper.pdf"
        download
        className="btn"
      >
        Download PDF
      </a>

      {/* Open in new tab */}
      <a
        href="/documents/whitepaper.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="btn"
      >
        View PDF
      </a>
    </div>
  )
}
```

### Inline PDF Viewer

```tsx
export default function PDFViewer() {
  return (
    <iframe
      src="/documents/whitepaper.pdf"
      className="w-full h-screen"
      title="PDF Viewer"
    />
  )
}
```

## Robots.txt

```txt
# public/robots.txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://example.com/sitemap.xml
```

Dynamic robots.txt:

```tsx
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    sitemap: 'https://example.com/sitemap.xml',
  }
}
```

## Sitemap

```tsx
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts()

  const postUrls = posts.map((post) => ({
    url: `https://example.com/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://example.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://example.com/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...postUrls,
  ]
}
```

## Environment-Specific Assets

### Development vs Production

```tsx
const assetUrl = process.env.NODE_ENV === 'production'
  ? 'https://cdn.example.com'
  : ''

export default function Image() {
  return (
    <img src={`${assetUrl}/images/logo.png`} alt="Logo" />
  )
}
```

### Configuration

```js
// next.config.js
module.exports = {
  env: {
    ASSET_PREFIX: process.env.NODE_ENV === 'production'
      ? 'https://cdn.example.com'
      : '',
  },
}
```

## Compression

### Enable Compression

```js
// next.config.js
module.exports = {
  compress: true, // Enabled by default in production
}
```

### Brotli Compression

Most hosting platforms handle this automatically, but for custom servers:

```js
// server.js (custom server)
const compression = require('compression')
const express = require('express')
const next = require('next')

const app = next({ dev: process.env.NODE_ENV !== 'production' })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = express()

  server.use(compression())

  server.all('*', (req, res) => {
    return handle(req, res)
  })

  server.listen(3000)
})
```

## Best Practices

1. **Use next/image**: For automatic image optimization
2. **Organize Assets**: Keep public folder well-structured
3. **Optimize Before Upload**: Compress images and videos before adding to public
4. **Set Cache Headers**: Configure long cache for static assets
5. **Use CDN**: Serve static assets from CDN in production
6. **Preload Critical Assets**: Improve initial page load
7. **Lazy Load Non-Critical**: Defer loading of below-fold assets
8. **Version Assets**: Use cache busting for updated files
9. **Compress Files**: Enable gzip/brotli compression
10. **Monitor Size**: Keep track of total asset size

## Performance Monitoring

### Bundle Analysis

```bash
npm install @next/bundle-analyzer
```

```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // Your config
})
```

```json
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  }
}
```

### Asset Size Tracking

```bash
# Check public folder size
du -sh public/*

# Check specific asset types
du -sh public/images/*
du -sh public/fonts/*
```

## Resources

- [Next.js Static File Serving](https://nextjs.org/docs/app/building-your-application/optimizing/static-assets)
- [Web.dev Asset Optimization](https://web.dev/fast/#optimize-your-images)
- [CDN Best Practices](https://web.dev/content-delivery-networks/)
