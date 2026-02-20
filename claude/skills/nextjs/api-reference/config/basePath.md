# Base Path Configuration

The `basePath` configuration allows you to deploy a Next.js application under a sub-path of a domain. This is useful when your application is not served from the root of the domain.

## Basic Configuration

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/docs',
}

module.exports = nextConfig
```

**Result:**
- App served at `https://example.com/docs`
- All routes automatically prefixed with `/docs`
- `/about` becomes `/docs/about`
- `/blog/post` becomes `/docs/blog/post`

## How Base Path Works

### Automatic Path Prefixing

All Next.js features automatically include the base path:

```typescript
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  return (
    <div>
      {/* Link automatically adds /docs prefix */}
      <Link href="/about">About</Link>
      {/* Renders: <a href="/docs/about">About</a> */}

      {/* Image paths also prefixed */}
      <Image src="/logo.png" alt="Logo" width={200} height={100} />
      {/* Fetches from: /docs/logo.png */}

      {/* Router methods use base path */}
      <button onClick={() => router.push('/contact')}>
        Contact
      </button>
      {/* Navigates to: /docs/contact */}
    </div>
  )
}
```

### Public Directory

Static files in `public/` are automatically served with base path:

```
public/
  images/
    logo.png

// Accessible at: /docs/images/logo.png
```

### API Routes

API routes are also prefixed:

```typescript
// pages/api/users.ts or app/api/users/route.ts

// Accessible at: /docs/api/users
```

## Configuration Examples

### Simple Base Path

```javascript
const nextConfig = {
  basePath: '/app',
}
```

### Environment-Specific Base Path

```javascript
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
}
```

```bash
# .env.production
NEXT_PUBLIC_BASE_PATH=/production

# .env.development
NEXT_PUBLIC_BASE_PATH=
```

### Conditional Base Path

```javascript
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  basePath: isProd ? '/my-app' : '',
}
```

## Usage in Code

### Links

```typescript
import Link from 'next/link'

// Automatic prefix
<Link href="/about">About</Link>
// Renders: /docs/about

// With base path
<Link href="/blog/post-1">Post</Link>
// Renders: /docs/blog/post-1
```

### Router

```typescript
import { useRouter } from 'next/navigation'

export default function Component() {
  const router = useRouter()

  // All paths automatically prefixed
  router.push('/dashboard')     // Goes to /docs/dashboard
  router.replace('/login')      // Goes to /docs/login
  router.prefetch('/settings')  // Prefetches /docs/settings

  return <div>...</div>
}
```

### Image Component

```typescript
import Image from 'next/image'

// Static images
<Image src="/hero.jpg" alt="Hero" width={800} height={600} />
// Loads from: /docs/hero.jpg

// Remote images (not affected by basePath)
<Image
  src="https://example.com/image.jpg"
  alt="Remote"
  width={400}
  height={300}
/>
```

### Fetch Requests

```typescript
// Client-side fetch
async function fetchData() {
  // Need to manually add base path
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  const res = await fetch(`${basePath}/api/data`)
  return res.json()
}

// Or use absolute URL
async function fetchData() {
  const res = await fetch('/api/data')
  // Note: This won't automatically include basePath
  // Use window.location.origin for full URL
  const res = await fetch(`${window.location.origin}/api/data`)
  return res.json()
}
```

### Head Component

```typescript
import Head from 'next/head'

<Head>
  {/* Manually add basePath for static assets in head */}
  <link rel="icon" href="/docs/favicon.ico" />
  <link rel="stylesheet" href="/docs/styles/global.css" />
</Head>
```

## Base Path with Other Features

### With Asset Prefix

```javascript
const nextConfig = {
  basePath: '/docs',
  assetPrefix: 'https://cdn.example.com',
}
```

**Result:**
- Pages served from: `/docs/*`
- Static assets from: `https://cdn.example.com/docs/_next/*`

### With Internationalization

```javascript
const nextConfig = {
  basePath: '/docs',
  i18n: {
    locales: ['en', 'fr', 'de'],
    defaultLocale: 'en',
  },
}
```

**Result:**
- English: `/docs/about`
- French: `/docs/fr/about`
- German: `/docs/de/about`

### With Trailing Slash

```javascript
const nextConfig = {
  basePath: '/docs',
  trailingSlash: true,
}
```

**Result:**
- `/docs/about/`
- `/docs/blog/post-1/`

### With Redirects

```javascript
const nextConfig = {
  basePath: '/docs',
  async redirects() {
    return [
      {
        source: '/old-page',
        destination: '/new-page',
        permanent: true,
      },
    ]
  },
}
```

**Result:**
- `/docs/old-page` → `/docs/new-page`

### With Rewrites

```javascript
const nextConfig = {
  basePath: '/docs',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.example.com/:path*',
      },
    ]
  },
}
```

## Accessing Without Base Path

Sometimes you need to bypass the base path:

### Links

```typescript
import Link from 'next/link'

// Won't work - still adds basePath
<Link href="/external">External</Link>

// Use <a> tag for non-basePath links
<a href="/admin">Admin</a>

// Or use full URL
<a href="https://example.com/admin">Admin</a>
```

### In Configuration

```javascript
const nextConfig = {
  basePath: '/docs',
  async redirects() {
    return [
      {
        source: '/api/external',
        destination: '/admin/api',
        basePath: false, // Don't include basePath
        permanent: false,
      },
    ]
  },
}
```

## Static Export with Base Path

```javascript
const nextConfig = {
  basePath: '/my-app',
  output: 'export',
  images: {
    unoptimized: true,
  },
}
```

Build:

```bash
npm run build
```

Output structure:

```
out/
  my-app/
    index.html
    about.html
    _next/
```

Deploy the `out/my-app` directory to serve from `/my-app` path.

## GitHub Pages Example

```javascript
const isProd = process.env.NODE_ENV === 'production'
const repoName = 'my-repo'

const nextConfig = {
  basePath: isProd ? `/${repoName}` : '',
  output: 'export',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
```

## Complete Examples

### Multi-Environment Configuration

```javascript
const getBasePath = () => {
  if (process.env.VERCEL_ENV === 'production') {
    return ''
  }
  if (process.env.VERCEL_ENV === 'preview') {
    return '/preview'
  }
  return '/dev'
}

const nextConfig = {
  basePath: getBasePath(),
}

module.exports = nextConfig
```

### Monorepo App

```javascript
const nextConfig = {
  basePath: '/admin',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
        basePath: false,
      },
    ]
  },
}
```

### Documentation Site

```javascript
const nextConfig = {
  basePath: '/docs',
  trailingSlash: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
}
```

## Best Practices

1. **Use environment variables**: Dynamic base paths for different environments
2. **Test thoroughly**: Verify all links and assets work
3. **Document for team**: Make base path configuration clear
4. **Use with asset prefix**: For CDN deployments
5. **Handle external links**: Use `<a>` tags, not `<Link>`
6. **Test in production**: Base path behavior in build vs dev
7. **Update meta tags**: Include base path in canonical URLs

## Common Patterns

### Development vs Production

```javascript
const nextConfig = {
  basePath: process.env.NODE_ENV === 'production' ? '/app' : '',
}
```

### With Custom Domain Routing

```javascript
const nextConfig = {
  basePath: '/portal',
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'admin.example.com' }],
          destination: '/admin/:path*',
        },
      ],
    }
  },
}
```

## Common Issues

### Assets Not Loading

Make sure public files include base path:

```typescript
// Wrong
<img src="/logo.png" />

// Correct
<img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.png`} />

// Better: Use Next.js Image
<Image src="/logo.png" alt="Logo" width={200} height={100} />
```

### API Calls Failing

```typescript
// Wrong
fetch('/api/users')

// Correct
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
fetch(`${basePath}/api/users`)

// Or use absolute URL
fetch(`${window.location.origin}/api/users`)
```

### Meta Tags

```typescript
import Head from 'next/head'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

<Head>
  <link rel="canonical" href={`https://example.com${basePath}/page`} />
  <meta property="og:image" content={`https://example.com${basePath}/og-image.jpg`} />
</Head>
```

### Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Base path is automatically handled
  const url = request.nextUrl.clone()

  // Paths already include basePath
  if (url.pathname.startsWith('/admin')) {
    // This matches /docs/admin if basePath is /docs
    return NextResponse.redirect(url.origin + '/login')
  }

  return NextResponse.next()
}
```

## Testing Base Path

### Local Testing

```bash
# Build with base path
npm run build

# Start server
npm start

# Access at: http://localhost:3000/docs
```

### Using Different Base Paths

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:docs": "NEXT_PUBLIC_BASE_PATH=/docs next dev",
    "dev:app": "NEXT_PUBLIC_BASE_PATH=/app next dev",
    "build": "next build",
    "build:docs": "NEXT_PUBLIC_BASE_PATH=/docs next build"
  }
}
```

## Deployment

### Vercel

Set environment variable in dashboard:

```
NEXT_PUBLIC_BASE_PATH=/my-app
```

### Docker

```dockerfile
ENV NEXT_PUBLIC_BASE_PATH=/app
```

### Static Hosting

Ensure files are in correct subdirectory matching base path.

## Validation

Next.js validates base path:

```javascript
// Valid
basePath: '/docs'
basePath: '/my-app'

// Invalid
basePath: 'docs'      // Must start with /
basePath: '/docs/'    // Must not end with /
basePath: ''          // Use undefined or omit
basePath: '/'         // Use undefined or omit
```
