# middleware.ts

Middleware allows you to run code before a request is completed. Based on the incoming request, you can modify the response by rewriting, redirecting, modifying headers, or setting cookies.

## File Location

Middleware must be placed at the root of your project:

```
project/
├── middleware.ts  ✅ Root of project
├── app/
│   └── middleware.ts  ❌ Not here
└── src/
    └── middleware.ts  ✅ Or in src/ if using src directory
```

## File Signature

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  return NextResponse.next()
}
```

## Middleware Function

The middleware function receives a `NextRequest` object and returns a `NextResponse`.

```ts
export function middleware(request: NextRequest) {
  // Modify request or response
  return NextResponse.next()
}
```

## Config Matcher

Use the `config` export to specify which paths the middleware should run on:

```ts
export const config = {
  matcher: '/about/:path*',
}
```

**Multiple matchers:**

```ts
export const config = {
  matcher: ['/about/:path*', '/dashboard/:path*'],
}
```

**Matcher syntax:**
- `/about/:path*` - matches `/about/a`, `/about/a/b`, etc.
- `/about/:path+` - matches `/about/a`, `/about/a/b`, etc. (requires at least one segment)
- `/about/:path?` - matches `/about`, `/about/a` (optional segment)
- `/blog/:slug` - matches `/blog/hello`, `/blog/world`

## Examples

### Basic Middleware

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  console.log('Middleware running for:', request.url)
  return NextResponse.next()
}
```

### Authentication Middleware

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*'],
}
```

### Redirects

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Redirect old URLs to new URLs
  if (request.nextUrl.pathname.startsWith('/old-path')) {
    return NextResponse.redirect(new URL('/new-path', request.url))
  }

  return NextResponse.next()
}
```

### Rewriting URLs

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Rewrite /docs to /documentation
  if (request.nextUrl.pathname.startsWith('/docs')) {
    return NextResponse.rewrite(new URL('/documentation', request.url))
  }

  return NextResponse.next()
}
```

### Setting Headers

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  response.headers.set('x-custom-header', 'my-custom-value')
  response.headers.set('x-pathname', request.nextUrl.pathname)

  return response
}
```

### Setting Cookies

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Set a cookie
  response.cookies.set('session-id', 'abc123', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  })

  return response
}
```

### Geolocation

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'US'
  const city = request.geo?.city || 'Unknown'

  const response = NextResponse.next()
  response.headers.set('x-geo-country', country)
  response.headers.set('x-geo-city', city)

  return response
}
```

### A/B Testing

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const bucket = request.cookies.get('bucket')

  if (!bucket) {
    const newBucket = Math.random() < 0.5 ? 'a' : 'b'
    const response = NextResponse.next()
    response.cookies.set('bucket', newBucket)
    return response
  }

  return NextResponse.next()
}
```

### Bot Detection

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || ''
  const isBot = /bot|crawler|spider/i.test(userAgent)

  if (isBot) {
    const response = NextResponse.next()
    response.headers.set('x-is-bot', 'true')
    return response
  }

  return NextResponse.next()
}
```

### Rate Limiting

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const rateLimit = new Map()

export function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown'
  const limit = 10 // requests per minute
  const windowMs = 60 * 1000 // 1 minute

  const now = Date.now()
  const userRequests = rateLimit.get(ip) || []

  // Filter out old requests
  const recentRequests = userRequests.filter(
    (timestamp: number) => now - timestamp < windowMs
  )

  if (recentRequests.length >= limit) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  // Add current request
  recentRequests.push(now)
  rateLimit.set(ip, recentRequests)

  return NextResponse.next()
}
```

### Internationalization (i18n)

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['en', 'es', 'fr']
const defaultLocale = 'en'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Check if pathname has locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return NextResponse.next()

  // Get locale from header or cookie
  const locale = request.cookies.get('locale')?.value || defaultLocale

  // Redirect to locale-prefixed URL
  request.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
```

### Conditional Rewrites

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')

  // Multi-tenant application
  if (hostname === 'app1.example.com') {
    return NextResponse.rewrite(new URL('/app1', request.url))
  }

  if (hostname === 'app2.example.com') {
    return NextResponse.rewrite(new URL('/app2', request.url))
  }

  return NextResponse.next()
}
```

### Feature Flags

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const newFeatureEnabled = request.cookies.get('new-feature-enabled')

  if (newFeatureEnabled?.value === 'true') {
    return NextResponse.rewrite(new URL('/new-feature', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/feature',
}
```

### Custom Response

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/health') {
    return new NextResponse(
      JSON.stringify({ status: 'ok', timestamp: Date.now() }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }

  return NextResponse.next()
}
```

## NextRequest API

The `NextRequest` object extends the Web Request API with additional helpers:

```ts
request.cookies        // Read cookies
request.nextUrl        // Extended URL object
request.geo            // Geolocation data
request.ip             // IP address
request.url            // Full URL
request.headers        // Request headers
```

## NextResponse API

The `NextResponse` object extends the Web Response API:

```ts
NextResponse.next()              // Continue to next middleware or route
NextResponse.redirect(url)       // Redirect to URL
NextResponse.rewrite(url)        // Rewrite to URL (internal)
NextResponse.json(data)          // Return JSON response

response.cookies.set(name, value) // Set cookie
response.cookies.delete(name)     // Delete cookie
response.headers.set(name, value) // Set header
```

## Config Matcher Patterns

### Exact Match

```ts
export const config = {
  matcher: '/about',
}
```

### Wildcard

```ts
export const config = {
  matcher: '/blog/:path*', // Matches /blog/a, /blog/a/b, etc.
}
```

### Multiple Paths

```ts
export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*'],
}
```

### Exclude Paths

```ts
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### Conditional Matching

```ts
export const config = {
  matcher: [
    '/admin/:path*',
    {
      source: '/dashboard/:path*',
      has: [{ type: 'header', key: 'x-admin' }],
    },
  ],
}
```

## Runtime

Middleware runs on the Edge Runtime by default:

```ts
// middleware.ts
export const config = {
  runtime: 'edge', // 'edge' or 'nodejs' (experimental)
}
```

## Version History

- **v12.0.0**: Middleware introduced (beta)
- **v12.2.0**: Middleware stable
- **v13.1.0**: Advanced middleware flags
- **v13.4.0**: App Router stable

## Good to Know

- Must be at project root or in `src/`
- Only one `middleware.ts` file per project
- Runs on every matched route
- Runs before cached content and routes are matched
- Executes on Edge Runtime by default
- Cannot use Node.js APIs (use Edge-compatible alternatives)
- Use `config.matcher` to control which routes run middleware
- Middleware runs before rendering - keep it fast
- Can access request headers, cookies, and geolocation
- Can modify response headers and cookies
- Supports redirects and rewrites
- Great for authentication, redirects, rewrites, and headers
