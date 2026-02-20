# NextRequest

`NextRequest` extends the Web Request API with additional convenience methods for Next.js-specific functionality.

## Import

```typescript
import { NextRequest } from 'next/server'
```

## Properties

### `cookies`
Read-only cookies from the request.

```typescript
request.cookies.get('name')
request.cookies.getAll()
request.cookies.has('name')
```

### `nextUrl`
Extended URL object with Next.js-specific properties.

```typescript
request.nextUrl.pathname
request.nextUrl.searchParams
request.nextUrl.origin
request.nextUrl.href
request.nextUrl.basePath
request.nextUrl.locale
```

### `geo`
Geolocation information (when deployed on Vercel).

```typescript
request.geo?.city
request.geo?.country
request.geo?.region
request.geo?.latitude
request.geo?.longitude
```

### `ip`
IP address of the request.

```typescript
request.ip
```

## Usage Examples

### Basic Route Handler

```typescript
// app/api/hello/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Hello' })
}
```

### Read Cookies

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = request.cookies.get('session')

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ sessionId: session.value })
}
```

### Access URL Information

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  return NextResponse.json({
    pathname,
    query
  })
}
```

### Read Query Parameters

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '10'

  return NextResponse.json({
    page: parseInt(page),
    limit: parseInt(limit)
  })
}
```

### Geolocation

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const country = request.geo?.country || 'Unknown'
  const city = request.geo?.city || 'Unknown'

  return NextResponse.json({
    country,
    city,
    message: `Hello from ${city}, ${country}!`
  })
}
```

### Get Client IP

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const ip = request.ip || 'Unknown'

  return NextResponse.json({ ip })
}
```

### Read Headers

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')
  const authorization = request.headers.get('authorization')

  return NextResponse.json({
    userAgent,
    hasAuth: !!authorization
  })
}
```

### Read Request Body

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  return NextResponse.json({
    received: body
  })
}
```

### Form Data

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const name = formData.get('name')
  const email = formData.get('email')

  return NextResponse.json({
    name,
    email
  })
}
```

### Middleware Usage

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Redirect if not authenticated
  if (pathname.startsWith('/dashboard')) {
    const session = request.cookies.get('session')

    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}
```

### Conditional Redirect

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const country = request.geo?.country

  // Redirect users from specific countries
  if (country === 'CN') {
    return NextResponse.redirect(new URL('/cn', request.url))
  }

  return NextResponse.next()
}
```

### API Authentication

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing authorization' },
      { status: 401 }
    )
  }

  const token = authHeader.substring(7)
  const user = await verifyToken(token)

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    )
  }

  return NextResponse.json({ user })
}
```

### Rate Limiting by IP

```typescript
import { NextRequest, NextResponse } from 'next/server'

const rateLimits = new Map<string, number>()

export async function POST(request: NextRequest) {
  const ip = request.ip || 'unknown'
  const count = rateLimits.get(ip) || 0

  if (count > 10) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  rateLimits.set(ip, count + 1)

  return NextResponse.json({ success: true })
}
```

### Parse Request URL

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { nextUrl } = request

  return NextResponse.json({
    href: nextUrl.href,
    origin: nextUrl.origin,
    pathname: nextUrl.pathname,
    search: nextUrl.search,
    searchParams: Object.fromEntries(nextUrl.searchParams)
  })
}
```

### Clone Request

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Clone request to read body multiple times
  const clonedRequest = request.clone()

  const body1 = await request.json()
  const body2 = await clonedRequest.json()

  return NextResponse.json({ body1, body2 })
}
```

### Check Request Method

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function handler(request: NextRequest) {
  if (request.method === 'GET') {
    return NextResponse.json({ data: 'GET response' })
  }

  if (request.method === 'POST') {
    const body = await request.json()
    return NextResponse.json({ data: 'POST response', body })
  }

  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
```

## NextRequest Properties Reference

### `cookies`
```typescript
request.cookies.get('name')      // Get single cookie
request.cookies.getAll()         // Get all cookies
request.cookies.has('name')      // Check if exists
request.cookies.set('name', 'value') // Set cookie (for NextResponse)
request.cookies.delete('name')   // Delete cookie (for NextResponse)
```

### `nextUrl`
```typescript
request.nextUrl.pathname         // "/api/users"
request.nextUrl.search           // "?page=1"
request.nextUrl.searchParams     // URLSearchParams object
request.nextUrl.origin           // "https://example.com"
request.nextUrl.href             // Full URL
request.nextUrl.basePath         // Base path if configured
request.nextUrl.locale           // Locale if i18n enabled
request.nextUrl.clone()          // Clone URL
```

### `geo` (Vercel only)
```typescript
request.geo.city                 // "San Francisco"
request.geo.country              // "US"
request.geo.region               // "CA"
request.geo.latitude             // "37.7749"
request.geo.longitude            // "-122.4194"
```

### Standard Request Properties
```typescript
request.method                   // "GET", "POST", etc.
request.headers                  // Headers object
request.url                      // Full URL string
request.body                     // ReadableStream
request.bodyUsed                 // boolean
request.cache                    // RequestCache
request.credentials              // RequestCredentials
request.destination              // RequestDestination
request.integrity                // string
request.keepalive                // boolean
request.mode                     // RequestMode
request.redirect                 // RequestRedirect
request.referrer                 // string
request.referrerPolicy           // ReferrerPolicy
request.signal                   // AbortSignal
```

## Best Practices

1. **Always Validate Input**
   ```typescript
   const body = await request.json()

   if (!body.email || !body.password) {
     return NextResponse.json(
       { error: 'Missing fields' },
       { status: 400 }
     )
   }
   ```

2. **Use Type Safety**
   ```typescript
   interface LoginRequest {
     email: string
     password: string
   }

   const body: LoginRequest = await request.json()
   ```

3. **Handle Errors**
   ```typescript
   try {
     const body = await request.json()
     // Process body
   } catch (error) {
     return NextResponse.json(
       { error: 'Invalid JSON' },
       { status: 400 }
     )
   }
   ```

4. **Check Authentication Early**
   ```typescript
   const session = request.cookies.get('session')

   if (!session) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
   }
   ```

5. **Use Geo Safely**
   ```typescript
   // Geo is only available on Vercel
   const country = request.geo?.country || 'Unknown'
   ```

## Important Notes

- Extends Web Request API
- Available in Route Handlers and Middleware
- `geo` property only available when deployed on Vercel
- `ip` may not be available in all environments
- `nextUrl` provides parsed URL with Next.js extensions
- Cookies are read-only in requests (use NextResponse to set)
- Request body can only be read once (use `clone()` if needed)

## Related

- [NextResponse](./NextResponse.md) - Extended Response object
- [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) - API routes
- [Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware) - Request interception
