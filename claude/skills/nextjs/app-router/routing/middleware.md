# Middleware in Next.js App Router

Middleware allows you to run code before a request is completed. Based on the incoming request, you can modify the response by rewriting, redirecting, modifying request/response headers, or responding directly. Middleware runs before cached content and routes are matched.

## Overview

Middleware is defined in a `middleware.ts` file at the root of your project (same level as `app` or in `src`). It runs on every route in your application by default, but you can configure it to match specific paths.

## Basic Setup

### Creating Middleware

```typescript
// middleware.ts (at project root)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Your middleware logic here
  return NextResponse.next()
}
```

### File Location

```
project-root/
  middleware.ts       # Root level
  app/
  public/
  package.json

# OR with src directory
src/
  middleware.ts       # Inside src
  app/
```

**Important:** Only one `middleware.ts` file per project.

## Matching Paths

### Using Config

Specify which paths should run middleware:

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  console.log('Middleware running on:', request.nextUrl.pathname)
  return NextResponse.next()
}

// Runs on specific paths only
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}
```

### Matcher Patterns

**Single path:**
```typescript
export const config = {
  matcher: '/dashboard',
}
```

**Multiple paths:**
```typescript
export const config = {
  matcher: ['/dashboard', '/admin', '/settings'],
}
```

**Dynamic segments:**
```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',    // Matches /dashboard/anything
    '/users/:id',           // Matches /users/123
  ],
}
```

**Exclude paths:**
```typescript
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

**Multiple patterns with exclusions:**
```typescript
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/api/protected/:path*',
  ],
}
```

### Conditional Logic

Use conditional logic within middleware for fine-grained control:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only run logic on specific paths
  if (pathname.startsWith('/dashboard')) {
    // Dashboard-specific logic
  }

  if (pathname.startsWith('/api/')) {
    // API-specific logic
  }

  return NextResponse.next()
}
```

## Common Use Cases

### 1. Authentication

Protect routes by checking authentication:

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')

  if (!token) {
    // Redirect to login if no token
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Continue to the requested page
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*'],
}
```

**With token verification:**

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    await jwtVerify(token, secret)

    return NextResponse.next()
  } catch (error) {
    // Invalid token
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

### 2. Redirects

Redirect users based on conditions:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect old URLs to new ones
  if (pathname === '/old-page') {
    return NextResponse.redirect(new URL('/new-page', request.url))
  }

  // Redirect based on user state
  const isLoggedIn = request.cookies.get('auth-token')
  if (pathname === '/login' && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}
```

### 3. Rewrites

Rewrite URLs without changing the browser URL:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rewrite /blog/* to /posts/*
  if (pathname.startsWith('/blog')) {
    const newPathname = pathname.replace('/blog', '/posts')
    return NextResponse.rewrite(new URL(newPathname, request.url))
  }

  return NextResponse.next()
}
```

**Multi-tenant rewrites:**

```typescript
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')
  const subdomain = hostname?.split('.')[0]

  if (subdomain && subdomain !== 'www') {
    // Rewrite to tenant-specific page
    return NextResponse.rewrite(
      new URL(`/tenant/${subdomain}${request.nextUrl.pathname}`, request.url)
    )
  }

  return NextResponse.next()
}
```

### 4. Header Modification

Add or modify request/response headers:

```typescript
export function middleware(request: NextRequest) {
  // Clone the headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-custom-header', 'custom-value')

  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add response headers
  response.headers.set('x-middleware-cache', 'hit')

  return response
}
```

**Security headers:**

```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  return response
}
```

### 5. Geolocation

Redirect based on user location:

```typescript
export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'US'
  const { pathname } = request.nextUrl

  // Redirect to country-specific page
  if (pathname === '/' && !pathname.includes(`/${country.toLowerCase()}`)) {
    return NextResponse.redirect(
      new URL(`/${country.toLowerCase()}`, request.url)
    )
  }

  return NextResponse.next()
}
```

### 6. Bot Detection

Handle bots differently:

```typescript
export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || ''

  // Detect common bots
  const isBot = /bot|crawler|spider|crawling/i.test(userAgent)

  if (isBot) {
    // Serve static version to bots
    return NextResponse.rewrite(new URL('/static-version', request.url))
  }

  return NextResponse.next()
}
```

### 7. Rate Limiting

Basic rate limiting:

```typescript
// Simple in-memory rate limit (use Redis in production)
const rateLimit = new Map<string, { count: number; resetTime: number }>()

export function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown'
  const now = Date.now()
  const windowMs = 60000 // 1 minute
  const maxRequests = 100

  const userLimit = rateLimit.get(ip)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + windowMs })
    return NextResponse.next()
  }

  if (userLimit.count >= maxRequests) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  userLimit.count++
  return NextResponse.next()
}
```

### 8. A/B Testing

Implement feature flags or A/B tests:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if user has variant cookie
  let variant = request.cookies.get('ab-test-variant')?.value

  // Assign variant if not set
  if (!variant) {
    variant = Math.random() > 0.5 ? 'A' : 'B'
  }

  const response =
    variant === 'B'
      ? NextResponse.rewrite(new URL(`/experiment${pathname}`, request.url))
      : NextResponse.next()

  // Set variant cookie
  response.cookies.set('ab-test-variant', variant, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return response
}

export const config = {
  matcher: '/landing-page',
}
```

### 9. Feature Flags

Control feature access:

```typescript
const FEATURE_FLAGS = {
  newDashboard: ['user1@example.com', 'user2@example.com'],
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userEmail = request.cookies.get('user-email')?.value

  if (pathname.startsWith('/new-dashboard')) {
    if (!userEmail || !FEATURE_FLAGS.newDashboard.includes(userEmail)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}
```

## Response Types

### NextResponse.next()

Continue to the next middleware or route:

```typescript
export function middleware(request: NextRequest) {
  return NextResponse.next()
}
```

### NextResponse.redirect()

Redirect to a different URL:

```typescript
export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL('/new-path', request.url))
}

// Permanent redirect (308)
return NextResponse.redirect(new URL('/new-path', request.url), {
  status: 308,
})
```

### NextResponse.rewrite()

Rewrite to a different URL without changing browser URL:

```typescript
export function middleware(request: NextRequest) {
  return NextResponse.rewrite(new URL('/internal-path', request.url))
}
```

### NextResponse.json()

Return a JSON response directly:

```typescript
export function middleware(request: NextRequest) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}
```

## Accessing Request Data

### URL Information

```typescript
export function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl

  console.log('Path:', pathname)           // /dashboard/users
  console.log('Search:', search)           // ?page=2
  console.log('Params:', searchParams.get('page')) // 2

  return NextResponse.next()
}
```

### Cookies

```typescript
export function middleware(request: NextRequest) {
  // Get cookie
  const token = request.cookies.get('token')

  // Set cookie in response
  const response = NextResponse.next()
  response.cookies.set('visited', 'true', {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
```

### Headers

```typescript
export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')
  const referer = request.headers.get('referer')
  const authorization = request.headers.get('authorization')

  return NextResponse.next()
}
```

### IP Address

```typescript
export function middleware(request: NextRequest) {
  const ip = request.ip || request.headers.get('x-forwarded-for')
  console.log('User IP:', ip)

  return NextResponse.next()
}
```

### Geo Information

```typescript
export function middleware(request: NextRequest) {
  const geo = request.geo

  console.log('Country:', geo?.country)
  console.log('Region:', geo?.region)
  console.log('City:', geo?.city)

  return NextResponse.next()
}
```

## Best Practices

### 1. Keep Middleware Lightweight

Middleware runs on every request, so keep it fast:

```typescript
// ✅ Good - Fast check
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

// ❌ Avoid - Slow database call
export async function middleware(request: NextRequest) {
  const user = await db.user.findUnique(...) // Too slow!
  return NextResponse.next()
}
```

### 2. Use Specific Matchers

Only run middleware where needed:

```typescript
// ✅ Good - Specific paths
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}

// ❌ Avoid - Runs on everything
export const config = {
  matcher: '/:path*',
}
```

### 3. Handle Edge Cases

```typescript
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value

  // Handle missing token
  if (!token) {
    const { pathname } = request.nextUrl

    // Don't redirect login page to login
    if (pathname === '/login') {
      return NextResponse.next()
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
```

### 4. Use Edge Runtime

Middleware always runs on the Edge runtime, so:
- No Node.js APIs available
- Use Web APIs only
- Keep bundle size small

```typescript
// ✅ Good - Web APIs
export function middleware(request: NextRequest) {
  const url = new URL(request.url)
  return NextResponse.next()
}

// ❌ Avoid - Node.js APIs
import fs from 'fs' // Won't work in Edge runtime!
```

### 5. Environment Variables

Use environment variables for configuration:

```typescript
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || []

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return NextResponse.next()
}
```

## Advanced Patterns

### Chaining Middleware Logic

```typescript
// lib/middleware/auth.ts
export function authMiddleware(request: NextRequest) {
  const token = request.cookies.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return null // Continue
}

// lib/middleware/logging.ts
export function loggingMiddleware(request: NextRequest) {
  console.log(`${request.method} ${request.url}`)
  return null // Continue
}

// middleware.ts
import { authMiddleware } from './lib/middleware/auth'
import { loggingMiddleware } from './lib/middleware/logging'

export function middleware(request: NextRequest) {
  // Run logging
  loggingMiddleware(request)

  // Run auth check
  const authResult = authMiddleware(request)
  if (authResult) return authResult

  return NextResponse.next()
}
```

### Role-Based Access

```typescript
const ROLE_PERMISSIONS = {
  admin: ['/admin', '/dashboard', '/settings'],
  user: ['/dashboard'],
  guest: ['/'],
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userRole = request.cookies.get('user-role')?.value as keyof typeof ROLE_PERMISSIONS || 'guest'

  const allowedPaths = ROLE_PERMISSIONS[userRole]
  const hasAccess = allowedPaths.some(path => pathname.startsWith(path))

  if (!hasAccess) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return NextResponse.next()
}
```

## Debugging Middleware

### Logging

```typescript
export function middleware(request: NextRequest) {
  console.log('[Middleware]', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    cookies: request.cookies.getAll(),
  })

  return NextResponse.next()
}
```

### Response Headers

```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  response.headers.set('X-Middleware-Path', request.nextUrl.pathname)
  response.headers.set('X-Middleware-Time', new Date().toISOString())

  return response
}
```

## Summary

Middleware in Next.js App Router provides powerful request interception:

- **File**: `middleware.ts` at project root
- **Execution**: Runs before routes are matched
- **Matchers**: Configure which paths trigger middleware
- **Use Cases**: Auth, redirects, rewrites, headers, geolocation
- **Responses**: next(), redirect(), rewrite(), json()
- **Runtime**: Always runs on Edge runtime
- **Best Practices**: Keep lightweight, use specific matchers

Middleware is essential for implementing cross-cutting concerns like authentication, logging, and request modification in Next.js applications.
