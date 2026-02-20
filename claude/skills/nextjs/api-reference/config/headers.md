# Headers Configuration

Headers allow you to set custom HTTP headers on responses for incoming requests. Configure headers in `next.config.js`.

## Basic Headers

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Custom-Header',
            value: 'my-custom-value',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

## Header Object Structure

```typescript
{
  source: string          // Path pattern to match
  headers: Array<{        // Headers to set
    key: string           // Header name
    value: string         // Header value
  }>
  basePath?: false        // Don't include basePath (default: true)
  locale?: false          // Don't include locale (default: true)
  has?: HasMatcher[]      // Additional conditions
  missing?: HasMatcher[]  // Inverse of has
}
```

## Security Headers

### Complete Security Headers Setup

```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        // Content Security Policy
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.example.com",
        },
        // XSS Protection
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        // Frame Options
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
        // Content Type Options
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        // Referrer Policy
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        // Permissions Policy
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
        // Strict Transport Security
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ]
}
```

### Content Security Policy (CSP)

```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' blob: data:",
            "font-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests",
          ].join('; '),
        },
      ],
    },
  ]
}
```

### CSP with Nonce (Next.js 13+)

```javascript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
  `

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim())

  return response
}
```

## CORS Headers

### Allow All Origins

```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
        {
          key: 'Access-Control-Allow-Methods',
          value: 'GET,POST,PUT,DELETE,OPTIONS',
        },
        {
          key: 'Access-Control-Allow-Headers',
          value: 'Content-Type, Authorization',
        },
      ],
    },
  ]
}
```

### Specific Origins

```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: 'https://example.com',
        },
        {
          key: 'Access-Control-Allow-Credentials',
          value: 'true',
        },
        {
          key: 'Access-Control-Allow-Methods',
          value: 'GET,POST,PUT,DELETE,OPTIONS',
        },
        {
          key: 'Access-Control-Allow-Headers',
          value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
        },
      ],
    },
  ]
}
```

## Cache Headers

### Static Assets

```javascript
async headers() {
  return [
    {
      source: '/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ]
}
```

### API Responses

```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
        {
          key: 'Pragma',
          value: 'no-cache',
        },
        {
          key: 'Expires',
          value: '0',
        },
      ],
    },
  ]
}
```

### Conditional Caching

```javascript
async headers() {
  return [
    {
      source: '/products/:id',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=3600, stale-while-revalidate=86400',
        },
      ],
    },
  ]
}
```

## Path Matching

### Exact Match

```javascript
{
  source: '/about',
  headers: [
    { key: 'X-Page', value: 'about' },
  ],
}
```

### Path Parameters

```javascript
{
  source: '/blog/:slug',
  headers: [
    { key: 'X-Blog-Post', value: ':slug' },
  ],
}
```

### Catch-all

```javascript
{
  source: '/docs/:path*',
  headers: [
    { key: 'X-Docs-Path', value: ':path*' },
  ],
}
```

### Regex Matching

```javascript
{
  source: '/api/v:version(\\d+)/:path*',
  headers: [
    { key: 'X-API-Version', value: ':version' },
  ],
}
```

## Conditional Headers

### Header-based

```javascript
{
  source: '/admin/:path*',
  has: [
    {
      type: 'header',
      key: 'x-admin-token',
    },
  ],
  headers: [
    { key: 'X-Admin-Access', value: 'granted' },
  ],
}
```

### Cookie-based

```javascript
{
  source: '/:path*',
  has: [
    {
      type: 'cookie',
      key: 'authorized',
      value: 'true',
    },
  ],
  headers: [
    { key: 'X-Authorized', value: 'true' },
  ],
}
```

### Query-based

```javascript
{
  source: '/search',
  has: [
    {
      type: 'query',
      key: 'format',
      value: 'json',
    },
  ],
  headers: [
    { key: 'Content-Type', value: 'application/json' },
  ],
}
```

## Common Header Patterns

### API Headers

```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Cache-Control',
          value: 'no-store',
        },
      ],
    },
  ]
}
```

### Image Headers

```javascript
async headers() {
  return [
    {
      source: '/:all*(svg|jpg|jpeg|png|gif|webp|avif)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
      ],
    },
  ]
}
```

### Font Headers

```javascript
async headers() {
  return [
    {
      source: '/:all*(woff|woff2|eot|ttf|otf)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
      ],
    },
  ]
}
```

## Complete Example

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },

      // HTTPS-only in production
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },

      // API CORS headers
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGIN || '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },

      // Static asset caching
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },

      // Image caching
      {
        source: '/:all*(jpg|jpeg|gif|png|svg|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

## Environment-Based Headers

```javascript
const isDevelopment = process.env.NODE_ENV === 'development'

async headers() {
  const baseHeaders = [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    },
  ]

  const productionHeaders = [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ]

  return isDevelopment ? baseHeaders : [...baseHeaders, ...productionHeaders]
}
```

## Best Practices

1. **Set security headers globally**: Apply to all routes
2. **Use specific paths for CORS**: Don't expose all routes
3. **Cache static assets**: Long cache times for immutable files
4. **Don't cache dynamic content**: Prevent stale data
5. **Test CSP thoroughly**: Can break functionality if too strict
6. **Use HTTPS in production**: Required for HSTS
7. **Document custom headers**: Explain purpose in comments

## Common Security Headers Reference

| Header | Purpose | Recommended Value |
|--------|---------|------------------|
| Content-Security-Policy | Prevent XSS, injection attacks | Customized policy |
| X-Frame-Options | Prevent clickjacking | SAMEORIGIN or DENY |
| X-Content-Type-Options | Prevent MIME sniffing | nosniff |
| Referrer-Policy | Control referrer information | strict-origin-when-cross-origin |
| Permissions-Policy | Control browser features | Restrict unused features |
| Strict-Transport-Security | Force HTTPS | max-age=63072000; includeSubDomains |

## Testing Headers

```bash
# Check headers with curl
curl -I http://localhost:3000

# Check specific header
curl -I http://localhost:3000 | grep "X-Frame-Options"

# Check with httpie
http HEAD http://localhost:3000
```

## Performance Considerations

1. **Headers add minimal overhead**: Don't worry about count
2. **Cache-Control improves performance**: Reduces server load
3. **CSP can block resources**: Test thoroughly
4. **CORS preflight**: OPTIONS requests for cross-origin
