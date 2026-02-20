# Security in Next.js

Complete guide to implementing security best practices in Next.js applications, including CSP, security headers, CORS, input sanitization, and rate limiting.

## Table of Contents

1. [Security Headers](#security-headers)
2. [Content Security Policy (CSP)](#content-security-policy-csp)
3. [CORS Configuration](#cors-configuration)
4. [Input Sanitization](#input-sanitization)
5. [Rate Limiting](#rate-limiting)
6. [Authentication Security](#authentication-security)
7. [API Security](#api-security)
8. [Best Practices](#best-practices)

## Security Headers

### Configuring Security Headers

```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
]

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}
```

### Middleware Security Headers

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  }

  return response
}

export const config = {
  matcher: '/:path*',
}
```

### Header Descriptions

- **Strict-Transport-Security (HSTS)**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-XSS-Protection**: Enables browser XSS protection
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Controls browser features

## Content Security Policy (CSP)

### Basic CSP Configuration

```javascript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.vercel-insights.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
}
```

### Nonce-Based CSP

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export function middleware(request: NextRequest) {
  const nonce = crypto.randomBytes(16).toString('base64')

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `

  const response = NextResponse.next()

  response.headers.set(
    'Content-Security-Policy',
    cspHeader.replace(/\s{2,}/g, ' ').trim()
  )

  // Pass nonce to the request so we can use it in components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
    headers: response.headers,
  })
}
```

```typescript
// app/layout.tsx
import { headers } from 'next/headers'
import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = headers().get('x-nonce') || ''

  return (
    <html lang="en">
      <head>
        <Script
          nonce={nonce}
          src="https://example.com/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### CSP Violation Reporting

```javascript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self';
  style-src 'self';
  img-src 'self' data:;
  report-uri /api/csp-report;
  report-to csp-endpoint;
`

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
          {
            key: 'Report-To',
            value: JSON.stringify({
              group: 'csp-endpoint',
              max_age: 10886400,
              endpoints: [{ url: '/api/csp-report' }],
            }),
          },
        ],
      },
    ]
  },
}
```

```typescript
// app/api/csp-report/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const report = await request.json()

  console.error('CSP Violation:', JSON.stringify(report, null, 2))

  // Send to error tracking service
  // await sendToSentry(report)

  return NextResponse.json({ received: true })
}
```

## CORS Configuration

### API Route CORS

```typescript
// app/api/[...route]/route.ts
import { NextRequest, NextResponse } from 'next/server'

const allowedOrigins = [
  'https://example.com',
  'https://www.example.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean) as string[]

function corsHeaders(origin: string | null) {
  const isAllowedOrigin = origin && allowedOrigins.includes(origin)

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {},
    { headers: corsHeaders(request.headers.get('origin')) }
  )
}

export async function GET(request: NextRequest) {
  // Your logic here
  const data = { message: 'Hello World' }

  return NextResponse.json(
    data,
    { headers: corsHeaders(request.headers.get('origin')) }
  )
}
```

### CORS Middleware

```typescript
// lib/cors.ts
import { NextRequest, NextResponse } from 'next/server'

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://example.com',
]

export function cors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin')

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  } else {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0])
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  )
  response.headers.set('Access-Control-Max-Age', '86400')

  return response
}
```

### Credentials and CORS

```typescript
// app/api/auth/route.ts
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })

  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set(
    'Access-Control-Allow-Origin',
    request.headers.get('origin') || ''
  )

  return response
}
```

## Input Sanitization

### Server-Side Validation

```typescript
// lib/validation.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// Schema validation
export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().max(150),
})

// HTML sanitization
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p'],
    ALLOWED_ATTR: ['href'],
  })
}

// SQL injection prevention (use parameterized queries)
export function sanitizeSql(input: string): string {
  // Never build SQL strings manually
  // Use ORM or parameterized queries instead
  throw new Error('Use parameterized queries instead')
}

// Path traversal prevention
export function sanitizePath(path: string): string {
  // Remove any path traversal attempts
  return path.replace(/\.\./g, '').replace(/^\/+/, '')
}
```

### API Route Validation

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { userSchema, sanitizeHtml } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validatedData = userSchema.parse(body)

    // Sanitize HTML content if present
    if (body.bio) {
      validatedData.bio = sanitizeHtml(body.bio)
    }

    // Process validated and sanitized data
    const user = await createUser(validatedData)

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### XSS Prevention

```typescript
// lib/xss.ts
import DOMPurify from 'isomorphic-dompurify'

export function preventXSS(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
}

// For React, use dangerouslySetInnerHTML carefully
export function SafeHTML({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html)

  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}
```

### SQL Injection Prevention

```typescript
// lib/db.ts
import { prisma } from '@/lib/prisma'

// ✅ Good: Parameterized query
export async function getUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
  })
}

// ❌ Bad: String concatenation
export async function getUserByEmailBad(email: string) {
  // NEVER DO THIS
  return await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`
}

// ✅ Good: Use parameterized queries even with raw SQL
export async function getUserByEmailRaw(email: string) {
  return await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`
  // Prisma automatically parameterizes tagged template literals
}
```

## Rate Limiting

### Simple Rate Limiter

```typescript
// lib/rate-limit.ts
import { LRUCache } from 'lru-cache'

type Options = {
  uniqueTokenPerInterval?: number
  interval?: number
}

export default function rateLimit(options?: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  })

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0]
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount)
        }
        tokenCount[0] += 1

        const currentUsage = tokenCount[0]
        const isRateLimited = currentUsage >= limit

        return isRateLimited ? reject() : resolve()
      }),
  }
}
```

### API Route Rate Limiting

```typescript
// app/api/limited/route.ts
import { NextRequest, NextResponse } from 'next/server'
import rateLimit from '@/lib/rate-limit'

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500,
})

export async function GET(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1'

  try {
    await limiter.check(10, ip) // 10 requests per minute

    return NextResponse.json({ message: 'Success' })
  } catch {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }
}
```

### Advanced Rate Limiting with Redis

```typescript
// lib/redis-rate-limit.ts
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function rateLimit(
  identifier: string,
  limit: number,
  window: number
): Promise<{ success: boolean; remaining: number }> {
  const key = `rate-limit:${identifier}`
  const now = Date.now()
  const windowStart = now - window

  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart)

  // Count requests in current window
  const count = await redis.zcard(key)

  if (count >= limit) {
    return { success: false, remaining: 0 }
  }

  // Add current request
  await redis.zadd(key, { score: now, member: `${now}` })
  await redis.expire(key, Math.ceil(window / 1000))

  return { success: true, remaining: limit - count - 1 }
}
```

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/redis-rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1'

  const { success, remaining } = await rateLimit(
    ip,
    10, // 10 requests
    60 * 1000 // per minute
  )

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60',
        },
      }
    )
  }

  // Process request
  return NextResponse.json(
    { message: 'Success' },
    {
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': remaining.toString(),
      },
    }
  )
}
```

## Authentication Security

### Secure Password Hashing

```typescript
// lib/password.ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain a special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

### Session Security

```typescript
// lib/session.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)

  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return token
}

export async function getSession() {
  const token = cookies().get('session')?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export function destroySession() {
  cookies().delete('session')
}
```

### CSRF Protection

```typescript
// lib/csrf.ts
import crypto from 'crypto'
import { cookies } from 'next/headers'

export function generateCsrfToken(): string {
  const token = crypto.randomBytes(32).toString('hex')

  cookies().set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60, // 1 hour
  })

  return token
}

export function verifyCsrfToken(token: string): boolean {
  const cookieToken = cookies().get('csrf-token')?.value
  return token === cookieToken
}
```

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyCsrfToken } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  const csrfToken = request.headers.get('x-csrf-token')

  if (!csrfToken || !verifyCsrfToken(csrfToken)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  // Process request
  return NextResponse.json({ success: true })
}
```

## API Security

### API Key Authentication

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api')) {
    const apiKey = request.headers.get('x-api-key')

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

### JWT Authentication

```typescript
// lib/jwt.ts
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function createToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}
```

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwt'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json(
      { error: 'Missing token' },
      { status: 401 }
    )
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    )
  }

  return NextResponse.json({ user: payload })
}
```

### Request Size Limiting

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const MAX_REQUEST_SIZE = 10 * 1024 * 1024 // 10MB

export async function middleware(request: NextRequest) {
  if (request.method === 'POST' || request.method === 'PUT') {
    const contentLength = request.headers.get('content-length')

    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      )
    }
  }

  return NextResponse.next()
}
```

## Best Practices

### 1. Environment Variables

```bash
# .env.local
JWT_SECRET=your-super-secret-key-min-32-chars
API_KEY=your-api-key
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Never commit secrets
# Use different secrets for each environment
# Rotate secrets regularly
```

### 2. Error Handling

```typescript
// app/api/error-handling/route.ts
export async function POST(request: NextRequest) {
  try {
    // Process request
    const data = await processRequest()
    return NextResponse.json(data)
  } catch (error) {
    // Log the error internally
    console.error('Error processing request:', error)

    // Return generic error to client
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    )
    // Never expose internal error details
  }
}
```

### 3. Logging and Monitoring

```typescript
// lib/logger.ts
export function logSecurityEvent(event: string, details: any) {
  const log = {
    timestamp: new Date().toISOString(),
    event,
    details,
    severity: 'security',
  }

  // Send to logging service
  console.error(JSON.stringify(log))

  // Send to security monitoring
  // await sendToSentry(log)
}
```

### 4. Dependency Security

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Use Snyk for continuous monitoring
npx snyk test
```

### 5. HTTPS Only

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          }
        ],
      },
    ]
  },
}
```

## Common Security Pitfalls

1. **Exposing secrets in client code**: Use server-only code
2. **No input validation**: Always validate and sanitize
3. **Missing rate limiting**: Implement on all public endpoints
4. **Weak passwords**: Enforce strong password policies
5. **No CSRF protection**: Implement CSRF tokens
6. **Insecure cookies**: Use httpOnly, secure, sameSite
7. **SQL injection**: Use parameterized queries
8. **Missing security headers**: Configure all security headers
9. **No HTTPS**: Always use HTTPS in production
10. **Logging sensitive data**: Never log passwords or tokens

## Security Checklist

- [ ] Security headers configured
- [ ] CSP implemented
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] Rate limiting implemented
- [ ] Passwords properly hashed
- [ ] CSRF protection enabled
- [ ] HTTPS enforced
- [ ] Dependencies regularly updated
- [ ] Error messages don't expose internals
- [ ] Secrets managed securely
- [ ] Authentication implemented correctly
- [ ] Session management secure
- [ ] File uploads validated
- [ ] SQL injection prevented

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/pages/building-your-application/configuring/security)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
