# Static Exports in Next.js

Complete guide to generating static HTML exports from Next.js applications, including configuration, deployment strategies, and handling dynamic features.

## Table of Contents

1. [Static Export Basics](#static-export-basics)
2. [Configuration](#configuration)
3. [Dynamic Routes](#dynamic-routes)
4. [Image Optimization](#image-optimization)
5. [API Routes Limitations](#api-routes-limitations)
6. [Environment Variables](#environment-variables)
7. [Deployment Strategies](#deployment-strategies)
8. [Best Practices](#best-practices)

## Static Export Basics

Static exports generate standalone HTML files that can be hosted on any static hosting service without requiring a Node.js server.

### When to Use Static Exports

- Documentation sites
- Marketing websites
- Blogs
- Portfolio sites
- Landing pages
- Sites with infrequent updates
- When you need to host on S3, GitHub Pages, or similar

### When NOT to Use Static Exports

- Dynamic user-generated content
- Real-time applications
- Applications requiring server-side authentication
- Sites with frequent data updates
- Applications using ISR (Incremental Static Regeneration)

## Configuration

### Basic Setup

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',

  // Optional: Change the output directory (default is 'out')
  distDir: 'dist',

  // Optional: Add a base path
  basePath: '/my-app',

  // Optional: Configure trailing slashes
  trailingSlash: true,
}

module.exports = nextConfig
```

### Build Command

```bash
# Build the static export
npm run build

# The static files will be in the 'out' directory
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "export": "next build",
    "serve": "npx serve@latest out"
  }
}
```

## Dynamic Routes

### Generate Static Paths

For dynamic routes, you must provide all possible paths at build time.

```typescript
// app/blog/[slug]/page.tsx
import { getAllPosts, getPostBySlug } from '@/lib/posts'

// Generate static paths for all blog posts
export async function generateStaticParams() {
  const posts = await getAllPosts()

  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export default async function BlogPost({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPostBySlug(params.slug)

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  )
}
```

### Nested Dynamic Routes

```typescript
// app/blog/[category]/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getAllPosts()

  return posts.map((post) => ({
    category: post.category,
    slug: post.slug,
  }))
}

export default async function CategoryPost({
  params,
}: {
  params: { category: string; slug: string }
}) {
  const post = await getPost(params.category, params.slug)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>Category: {params.category}</p>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  )
}
```

### Catch-All Routes

```typescript
// app/docs/[...slug]/page.tsx
export async function generateStaticParams() {
  const docPaths = await getAllDocPaths()

  return docPaths.map((path) => ({
    slug: path.split('/'),
  }))
}

export default async function DocsPage({
  params,
}: {
  params: { slug: string[] }
}) {
  const doc = await getDoc(params.slug.join('/'))

  return (
    <div>
      <h1>{doc.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: doc.content }} />
    </div>
  )
}
```

## Image Optimization

Static exports don't support Next.js Image Optimization API by default. Here are solutions:

### Option 1: Use Unoptimized Images

```javascript
// next.config.js
module.exports = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}
```

```typescript
// Usage remains the same
import Image from 'next/image'

<Image
  src="/images/photo.jpg"
  width={800}
  height={600}
  alt="Description"
/>
```

### Option 2: Custom Image Loader

```javascript
// next.config.js
module.exports = {
  output: 'export',
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
}
```

```typescript
// lib/image-loader.ts
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}) {
  const params = [
    'f_auto',
    'c_limit',
    `w_${width}`,
    `q_${quality || 'auto'}`,
  ]
  return `https://res.cloudinary.com/demo/image/upload/${params.join(',')}${src}`
}
```

### Option 3: Third-Party Image CDN

```typescript
// next.config.js
module.exports = {
  output: 'export',
  images: {
    loader: 'cloudinary',
    path: 'https://res.cloudinary.com/demo/image/upload/',
  },
}
```

### Option 4: Static Image Export

Pre-optimize images at build time:

```bash
npm install sharp
```

```typescript
// scripts/optimize-images.ts
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const inputDir = './public/images'
const outputDir = './public/images/optimized'

async function optimizeImages() {
  const files = fs.readdirSync(inputDir)

  for (const file of files) {
    if (/\.(jpg|jpeg|png)$/i.test(file)) {
      await sharp(path.join(inputDir, file))
        .resize(1920, null, {
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toFile(path.join(outputDir, file))

      console.log(`Optimized: ${file}`)
    }
  }
}

optimizeImages()
```

## API Routes Limitations

API Routes are NOT supported in static exports. Here are alternatives:

### Option 1: Client-Side API Calls

```typescript
// app/posts/page.tsx
'use client'

import { useEffect, useState } from 'react'

export default function PostsPage() {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    fetch('https://api.example.com/posts')
      .then((res) => res.json())
      .then((data) => setPosts(data))
  }, [])

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
        </article>
      ))}
    </div>
  )
}
```

### Option 2: Pre-Fetch at Build Time

```typescript
// app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts')
  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  )
}
```

### Option 3: Separate API Server

Deploy API routes separately:

```typescript
// Separate Express API or serverless functions
// Deploy to Vercel, Netlify Functions, AWS Lambda, etc.

// Client calls external API
const response = await fetch('https://api.yoursite.com/posts')
```

### Option 4: Use External CMS/API

```typescript
// lib/contentful.ts
import { createClient } from 'contentful'

const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
})

export async function getPosts() {
  const entries = await client.getEntries({
    content_type: 'blogPost',
  })

  return entries.items
}
```

## Environment Variables

### Build-Time Variables

Only `NEXT_PUBLIC_` prefixed variables are available in static exports:

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

```typescript
// Can be used in components
const apiUrl = process.env.NEXT_PUBLIC_API_URL

// This will be inlined at build time
fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`)
```

### Runtime Configuration Alternative

For values that change per environment:

```typescript
// public/config.js
window.ENV = {
  API_URL: 'https://api.example.com',
  GA_ID: 'G-XXXXXXXXXX',
}
```

```html
<!-- app/layout.tsx -->
<Script src="/config.js" strategy="beforeInteractive" />
```

```typescript
// Access in components
declare global {
  interface Window {
    ENV: {
      API_URL: string
      GA_ID: string
    }
  }
}

const apiUrl = window.ENV?.API_URL
```

## Deployment Strategies

### 1. GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_BASE_PATH: /repo-name

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
```

```javascript
// next.config.js for GitHub Pages
const isProd = process.env.NODE_ENV === 'production'

module.exports = {
  output: 'export',
  basePath: isProd ? '/repo-name' : '',
  images: {
    unoptimized: true,
  },
}
```

### 2. Netlify

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "out"

[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404
```

### 3. AWS S3 + CloudFront

```bash
# Install AWS CLI
npm install -g aws-cli

# Build
npm run build

# Upload to S3
aws s3 sync out/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

```javascript
// scripts/deploy-s3.js
const AWS = require('aws-sdk')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})

const bucketName = 'your-bucket-name'
const distDir = './out'

async function uploadDirectory(dir, prefix = '') {
  const files = fs.readdirSync(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      await uploadDirectory(filePath, path.join(prefix, file))
    } else {
      const fileContent = fs.readFileSync(filePath)
      const key = path.join(prefix, file).replace(/\\/g, '/')

      await s3
        .putObject({
          Bucket: bucketName,
          Key: key,
          Body: fileContent,
          ContentType: mime.lookup(filePath) || 'application/octet-stream',
        })
        .promise()

      console.log(`Uploaded: ${key}`)
    }
  }
}

uploadDirectory(distDir)
```

### 4. Vercel (as Static Site)

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "out"
}
```

### 5. Custom Server (nginx)

```nginx
# /etc/nginx/sites-available/your-site
server {
    listen 80;
    server_name example.com;
    root /var/www/your-site/out;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Handle client-side routing
    location / {
        try_files $uri $uri.html $uri/ =404;
    }

    # Custom 404 page
    error_page 404 /404.html;
}
```

## Advanced Features

### Custom 404 Page

```typescript
// app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">Go Home</a>
    </div>
  )
}
```

### Sitemap Generation

```typescript
// scripts/generate-sitemap.ts
import fs from 'fs'
import { getAllPosts } from '@/lib/posts'

async function generateSitemap() {
  const baseUrl = 'https://example.com'
  const posts = await getAllPosts()

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${posts
    .map(
      (post) => `
  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${post.date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join('')}
</urlset>`

  fs.writeFileSync('public/sitemap.xml', sitemap)
  console.log('Sitemap generated!')
}

generateSitemap()
```

```json
// package.json
{
  "scripts": {
    "build": "npm run generate-sitemap && next build",
    "generate-sitemap": "tsx scripts/generate-sitemap.ts"
  }
}
```

### RSS Feed Generation

```typescript
// scripts/generate-rss.ts
import fs from 'fs'
import { getAllPosts } from '@/lib/posts'

async function generateRSS() {
  const posts = await getAllPosts()
  const baseUrl = 'https://example.com'

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>My Blog</title>
    <link>${baseUrl}</link>
    <description>My awesome blog</description>
    <language>en</language>
    ${posts
      .map(
        (post) => `
    <item>
      <title>${post.title}</title>
      <link>${baseUrl}/blog/${post.slug}</link>
      <description>${post.excerpt}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <guid>${baseUrl}/blog/${post.slug}</guid>
    </item>`
      )
      .join('')}
  </channel>
</rss>`

  fs.writeFileSync('public/rss.xml', rss)
  console.log('RSS feed generated!')
}

generateRSS()
```

## Best Practices

### 1. Optimize Build Performance

```javascript
// next.config.js
module.exports = {
  output: 'export',

  // Only export necessary pages
  experimental: {
    optimizeCss: true,
  },

  // Reduce bundle size
  swcMinify: true,
}
```

### 2. Handle Client-Side Navigation

```typescript
// components/Link.tsx
import NextLink from 'next/link'

export default function Link({
  href,
  children,
  ...props
}: {
  href: string
  children: React.ReactNode
  [key: string]: any
}) {
  // Ensure trailing slash if configured
  const normalizedHref = href.endsWith('/') ? href : `${href}/`

  return (
    <NextLink href={normalizedHref} {...props}>
      {children}
    </NextLink>
  )
}
```

### 3. Asset Optimization

```javascript
// next.config.js
module.exports = {
  output: 'export',

  // Optimize fonts
  optimizeFonts: true,

  // Configure image domains for external images
  images: {
    unoptimized: true,
    domains: ['example.com', 'cdn.example.com'],
  },
}
```

### 4. Error Handling

```typescript
// app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h1>Something went wrong!</h1>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### 5. Loading States

```typescript
// app/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
    </div>
  )
}
```

## Common Pitfalls

1. **Forgot to add `output: 'export'`**: Build will succeed but won't generate static files
2. **Using API routes**: They won't work in static exports
3. **Dynamic routes without `generateStaticParams`**: Pages won't be generated
4. **Server-side only features**: ISR, middleware, server actions won't work
5. **Image optimization**: Requires configuration for static exports
6. **Environment variables**: Only `NEXT_PUBLIC_` variables work
7. **Trailing slashes**: Configure based on hosting requirements
8. **Base path**: Remember to set for subdirectory deployments

## Testing Static Export

```bash
# Build the static export
npm run build

# Serve locally to test
npx serve@latest out

# Or use http-server
npx http-server out -p 3000

# Test with different base path
npx serve@latest out -p 3000 --single
```

## Comparison: Static Export vs SSR

| Feature | Static Export | SSR |
|---------|--------------|-----|
| Hosting | Any static host | Requires Node.js server |
| Build Time | Slower (generates all pages) | Faster |
| Request Time | Instant | Slower (renders on request) |
| API Routes | Not supported | Supported |
| ISR | Not supported | Supported |
| Dynamic Data | Client-side only | Server-side |
| Cost | Very low | Higher |
| Scalability | Excellent | Good |
| SEO | Excellent | Excellent |

## Resources

- [Next.js Static Exports Documentation](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Deployment Options](https://nextjs.org/docs/deployment)
- [Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
